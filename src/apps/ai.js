/** 手机里的 AI 助手：按正文、记忆库、私聊和其它 App 回答。 */
import { h, icon, avatar, toast } from '../render.js';
import { getData, getFeed, saveNow } from '../store.js';
import { generateText, importantStoryContext, memoryContext, userName, currentCharacter } from '../st.js';
import { phoneStateSummary } from '../prompts.js';
import { recentOtherChats } from '../ai.js';

export function mountAI(host, { nav }) {
    nav.setChrome?.('dark');
    const body = h('div', { class: 'mp-aiapp__body' });
    const el = h('div', { class: 'mp-aiapp' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, 'AI', h('small', { text: 'ASSISTANT' })),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '新对话', onclick: () => reset() }, icon('plus')),
        ),
        body,
    );
    host.appendChild(el);
    let busy = false;

    function data() {
        const current = getData();
        current.aiApp = current.aiApp && typeof current.aiApp === 'object' ? current.aiApp : { messages: [] };
        current.aiApp.messages = Array.isArray(current.aiApp.messages) ? current.aiApp.messages : [];
        return current.aiApp;
    }

    function context() {
        const current = getData();
        const memory = memoryContext(12).map(item => String(item.text || '').slice(0, 500)).filter(Boolean).join('\n');
        const story = importantStoryContext(40, 360).map(line => (line.isUser ? userName() : line.name) + '：' + line.text).join('\n');
        const phone = phoneStateSummary({
            threads: current.threads,
            user: userName(),
            hearts: getFeed('heart')?.items || [],
            selfProfile: current.heartSelf || null,
            worldProfile: current.worldInfo || null,
            extras: recentOtherChats(),
        });
        return [
            story ? '【正文最近发生的事】\n' + story : '',
            memory ? '【记忆库 / 摘要】\n' + memory : '',
            phone,
        ].filter(Boolean).join('\n\n');
    }

    function scrollBottom() {
        requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
    }

    function drawTyping() {
        let node = body.querySelector('.mp-aiapp__typing');
        if (!node) {
            node = h('div', { class: 'mp-aiapp__msg is-ai mp-aiapp__typing' },
                h('div', { class: 'mp-aiapp__bubble' }, h('i'), h('i'), h('i')),
            );
            body.appendChild(node);
        }
        scrollBottom();
    }

    function removeTyping() { body.querySelector('.mp-aiapp__typing')?.remove(); }

    function render() {
        const app = data();
        body.innerHTML = '';
        if (!app.messages.length) {
            body.appendChild(h('div', { class: 'mp-aiapp__hello' },
                h('div', { class: 'mp-aiapp__logo' }, icon('sparkle')),
                h('div', { class: 'mp-aiapp__title', text: '我知道这部手机和最近的故事' }),
                h('div', { class: 'mp-aiapp__sub', text: '可以问剧情、谁在聊什么、谁对你有好感，或者让我帮你理一理。' }),
                h('div', { class: 'mp-aiapp__chips' },
                    ...['总结最近剧情', '手机里大家聊了什么', '谁对我有好感'].map(text => h('button', {
                        type: 'button', class: 'mp-aiapp__chip', text, onclick: () => send(text),
                    })),
                ),
            ));
        }
        for (const msg of app.messages) {
            body.appendChild(h('div', { class: 'mp-aiapp__msg ' + (msg.role === 'user' ? 'is-user' : 'is-ai') },
                msg.role === 'ai' ? h('div', { class: 'mp-aiapp__avatar' }, avatar({ name: 'AI', size: 24 })) : null,
                h('div', { class: 'mp-aiapp__bubble', text: msg.text }),
            ));
        }
        if (busy) drawTyping();
        scrollBottom();
    }

    function reset() {
        if (busy) return;
        data().messages.length = 0;
        saveNow('data');
        render();
    }

    async function send(text) {
        const value = String(text || '').trim();
        if (!value || busy) return;
        const app = data();
        app.messages.push({ role: 'user', text: value.slice(0, 2000), ts: Date.now() });
        saveNow('data');
        busy = true;
        render();
        try {
            const raw = await generateText({
                system: [
                    '你是「幻镜手机」里的 AI 助手，知道这个聊天（酒馆正文）和手机里发生的一切。',
                    '优先根据提供的资料回答；资料里没有的就直说不知道，不要编造。',
                    '用中文、口语、简洁，必要时分点；不要写旁白，不要提「注入」「上下文」这些词。',
                ].join('\n'),
                prompt: context() + '\n\n用户问：' + value,
                length: 900,
            });
            const answer = String(raw || '').trim() || '我这边没读到可用的内容。';
            app.messages.push({ role: 'ai', text: answer.slice(0, 3000), ts: Date.now() });
        } catch (error) {
            app.messages.push({ role: 'ai', text: '生成失败：' + (error?.message || '未知错误'), ts: Date.now() });
        } finally {
            busy = false;
            saveNow('data');
            render();
        }
    }

    /* 底部输入 */
    const input = h('input', { class: 'mp-cm__input', type: 'text', placeholder: '问 AI…' });
    const sendBtn = h('button', { class: 'mp-cm__send', type: 'button', onclick: () => { const value = input.value; input.value = ''; send(value); } }, icon('send'));
    el.appendChild(h('div', { class: 'mp-aiapp__composer' }, input, sendBtn));
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); const value = input.value; input.value = ''; send(value); }
    });

    render();
    return { refresh: render };
}
