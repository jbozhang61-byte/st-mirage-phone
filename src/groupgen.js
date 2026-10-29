/** 根据正文剧情新建群组 / 吧 / 频道，并生成第一批内容。 */
import { h, sheet, toast } from './render.js';
import { generateText, importantStoryContext, memoryContext, userName } from './st.js';
import { getCast } from './store.js';
import { extractJson } from './prompts.js';

function storyText() {
    const memory = memoryContext(12).map(item => String(item.text || '').slice(0, 600)).filter(Boolean).join('\n');
    const story = importantStoryContext(40, 340).map(line => (line.isUser ? userName() : line.name) + '：' + line.text).join('\n');
    return [memory ? '记忆库 / 摘要：\n' + memory : '', story ? '最近剧情：\n' + story : ''].filter(Boolean).join('\n\n');
}

export function groupFallback(kind, name, style) {
    const cast = getCast().map(person => person.name);
    const people = cast.length ? cast : ['旧城的人', '路过的人', '夜班的人'];
    const tone = style || '平常说话';
    if (kind === 'tieba') {
        return {
            posts: [
                { title: '有人在' + name + '吗', text: '刚看到这里，想问问大家平时都在做什么。', author: people[0], replies: 18, likes: 7 },
                { title: name + '的规矩', text: '新人先看这里，说话按「' + tone + '」来就行。', author: people[1 % people.length], replies: 9, likes: 4 },
                { title: '今天发生的事', text: '街上好像不太对劲，有人知道吗？', author: people[2 % people.length], replies: 26, likes: 11 },
            ],
        };
    }
    const messages = [
        { author: people[0], text: '群建好了，先报个到。', time: '刚刚' },
        { author: people[1 % people.length], text: '在。今天还顺利吗？', time: '刚刚' },
        { author: people[2 % people.length], text: '我刚看到消息，晚点细说。', time: '刚刚' },
        { author: people[0], text: '说话都按「' + tone + '」来，别太见外。', time: '刚刚' },
    ];
    if (kind === 'discord') {
        return { channels: [{ name: '综合', messages }] };
    }
    return { messages };
}

export async function generateGroup({ kind = 'telegram', name, style = '', note = '' } = {}) {
    const cast = getCast().map(person => person.name);
    const story = storyText();
    const system = '你在为一段故事世界里的手机社区生成内容。人物、地点、关系必须和剧情一致，用中文。只输出 JSON。';
    const shape = kind === 'tieba'
        ? '{"posts":[{"title":"帖子标题","text":"帖子正文","author":"发帖人","replies":18,"likes":7}]}'
        : kind === 'discord'
            ? '{"channels":[{"name":"频道名","messages":[{"author":"名字","text":"消息","time":"21:02"}]}]}'
            : '{"messages":[{"author":"名字","text":"消息","time":"21:02"}]}';
    const prompt = [
        story ? '最近的剧情：\n' + story : '',
        cast.length ? '世界里的人：' + cast.join('、') : '',
        '新建的群组/吧：' + name,
        '说话语言风格：' + (style || '自然、像真人'),
        note ? '补充设定：' + note : '',
        kind === 'tieba' ? '生成 4 个帖子，标题和内容都要像这个吧里的人发的。' : '生成 6 条群聊消息，像刚建群时的真人聊天。',
        '只输出：' + shape,
    ].filter(Boolean).join('\n');
    try {
        const raw = await generateText({ system, prompt, length: 1000, json: true });
        const json = extractJson(raw) || {};
        if (kind === 'tieba' && Array.isArray(json.posts) && json.posts.length) return json;
        if (kind === 'discord' && Array.isArray(json.channels) && json.channels.length) return json;
        if (Array.isArray(json.messages) && json.messages.length) return json;
    } catch { /* 用兜底 */ }
    return groupFallback(kind, name, style);
}

export async function generateMore({ kind = 'telegram', name, style = '', count = 4, note = '' } = {}) {
    const cast = getCast().map(person => person.name);
    const story = storyText();
    const system = '你在为一段故事世界里的手机社区继续生成内容。人物、地点、关系必须和剧情一致，用中文，只输出 JSON。';
    const shape = kind === 'tieba'
        ? '{"posts":[{"title":"帖子标题","text":"帖子正文","author":"发帖人","replies":18,"likes":7}]}'
        : '{"messages":[{"author":"名字","text":"消息","time":"21:02"}]}';
    const prompt = [
        story ? '最近的剧情：\n' + story : '',
        cast.length ? '世界里的人：' + cast.join('、') : '',
        (kind === 'tieba' ? '贴吧：' : '群聊：') + name,
        '说话语言风格：' + (style || '自然、像真人'),
        note ? '补充：' + note : '',
        '再生成 ' + count + ' 条新内容，不要和已有内容重复。',
        '只输出：' + shape,
    ].filter(Boolean).join('\n');
    try {
        const raw = await generateText({ system, prompt, length: 900, json: true });
        const json = extractJson(raw) || {};
        if (kind === 'tieba' && Array.isArray(json.posts) && json.posts.length) return { posts: json.posts.slice(0, count) };
        if (Array.isArray(json.messages) && json.messages.length) return { messages: json.messages.slice(0, count) };
    } catch { /* 用兜底 */ }
    const base = groupFallback(kind, name, style);
    if (kind === 'tieba') return { posts: (base.posts || []).slice(0, count) };
    const messages = base.messages || base.channels?.[0]?.messages || [];
    return { messages: messages.slice(0, count) };
}

export function openGroupCreate({ title = '新建群组', kind = 'telegram', onCreate } = {}) {
    const name = h('input', { class: 'mp-input', type: 'text', placeholder: '群组 / 吧 / 服务器名字' });
    const style = h('input', { class: 'mp-input', type: 'text', placeholder: '说话风格，例如：学生、老师、古风、夜班工人' });
    const note = h('textarea', { class: 'mp-input', rows: '3', placeholder: '这个群和正文的关系，例如：主角学校里的同学群' });
    const button = h('button', { class: 'mp-btn primary small', type: 'button', text: '创建' });
    const dialog = sheet({
        title,
        content: h('div', { class: 'mp-field-list' },
            h('div', {}, h('label', { text: '名字' }), name),
            h('div', {}, h('label', { text: '说话语言风格' }), style),
            h('div', {}, h('label', { text: '和正文的关系' }), note),
            h('div', { class: 'mp-st-hint', text: '会根据酒馆最近正文生成第一批内容。' }),
        ),
        actions: button,
    });
    const submit = async () => {
        const value = name.value.trim();
        if (!value || button.dataset.busy === '1') return;
        button.dataset.busy = '1';
        button.disabled = true;
        button.textContent = '生成中…';
        try {
            const styleValue = style.value.trim();
            let data = null;
            try {
                data = await Promise.race([
                    generateGroup({ kind, name: value, style: styleValue, note: note.value.trim() }),
                    new Promise(resolve => setTimeout(() => resolve(null), 8000)),
                ]);
            } catch { /* 用本地内容 */ }
            if (!data) data = groupFallback(kind, value, styleValue);
            await onCreate?.({ name: value, style: styleValue, data });
            dialog.close();
            toast('已创建');
        } catch (error) {
            const message = String(error?.message || '创建失败');
            console.warn('[幻镜手机] 新建群组失败', error);
            toast(message, 3000);
        } finally {
            button.dataset.busy = '';
            button.disabled = false;
            button.textContent = '创建';
        }
    };
    button.addEventListener('click', submit);
    button.onclick = submit;
    return dialog;
}