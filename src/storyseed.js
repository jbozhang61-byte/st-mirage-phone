/** 把正文和记忆库变成各 App 的第一批内容。 */
import { generateText, importantStoryContext, memoryContext, userName } from './st.js';
import { getCast } from './store.js';
import { extractJson } from './prompts.js';

function context() {
    const story = importantStoryContext(80, 340).map(line => (line.isUser ? userName() : line.name) + '：' + line.text).join('\n');
    const memory = memoryContext(12).map(item => String(item.text || '').slice(0, 500)).filter(Boolean).join('\n');
    return [
        memory ? '记忆库 / 摘要：\n' + memory : '',
        story ? '最近剧情：\n' + story : '',
    ].filter(Boolean).join('\n\n');
}

export async function generateFacebook() {
    const cast = getCast().map(person => person.name);
    const prompt = [
        context(),
        cast.length ? '世界里的人：' + cast.join('、') : '',
        '生成 6 条 Facebook 动态，作者从世界里的人里选，内容要能看出最近剧情里发生过什么。',
        '只输出 JSON：{"posts":[{"author":"名字","text":"正文","time":"刚刚","likes":12,"comments":3}]}',
    ].filter(Boolean).join('\n');
    try {
        const raw = await generateText({ system: '你在为一个故事世界生成 Facebook 信息流。用中文，像真人发帖，只输出 JSON。', prompt, length: 900, json: true });
        const json = extractJson(raw) || {};
        return (Array.isArray(json.posts) ? json.posts : []).map(post => ({
            author: String(post.author || cast[0] || '旧城的人').slice(0, 24),
            text: String(post.text || '').slice(0, 400),
            time: String(post.time || '刚刚').slice(0, 16),
            likes: Math.max(0, Number(post.likes) || 0),
            comments: Math.max(0, Number(post.comments) || 0),
        })).filter(post => post.text);
    } catch {
        return [];
    }
}

export async function generateSignal() {
    const cast = getCast().map(person => person.name);
    const prompt = [
        context(),
        cast.length ? '世界里的人：' + cast.join('、') : '',
        '生成 5 个 Signal 会话，预览要像刚发生的私聊，能看出最近剧情。',
        '只输出 JSON：{"chats":[{"name":"名字","preview":"最后一条","time":"刚刚","unread":0,"group":false}]}',
    ].filter(Boolean).join('\n');
    try {
        const raw = await generateText({ system: '你在为一个故事世界生成 Signal 会话列表。用中文，只输出 JSON。', prompt, length: 700, json: true });
        const json = extractJson(raw) || {};
        return (Array.isArray(json.chats) ? json.chats : []).map(chat => ({
            id: 'sg-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: String(chat.name || '某人').slice(0, 24),
            group: !!chat.group,
            unread: Math.max(0, Number(chat.unread) || 0),
            preview: String(chat.preview || '在吗？').slice(0, 120),
            time: String(chat.time || '刚刚').slice(0, 16),
            messages: [],
        })).filter(chat => chat.name);
    } catch {
        return [];
    }
}