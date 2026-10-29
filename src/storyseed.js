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
export async function generateShoppingProducts(brandName) {
    const prompt = [
        context(),
        '生成 8 个适合在「' + brandName + '」上卖的商品，要和最近剧情、人物生活有关。',
        '只输出 JSON：{"products":[{"title":"商品名","price":59.9,"sold":1200,"category":"生活","desc":"一两句卖点"}]}',
    ].filter(Boolean).join('\n');
    try {
        const raw = await generateText({ system: '你在为故事世界里的一个购物 App 生成商品列表。用中文，只输出 JSON。', prompt, length: 900, json: true });
        const json = extractJson(raw) || {};
        return (Array.isArray(json.products) ? json.products : []).map(item => ({
            title: String(item.title || '').slice(0, 60),
            price: Math.max(0.01, Number(item.price) || 9.9),
            sold: Math.max(0, Number(item.sold) || 0),
            category: String(item.category || '生活').slice(0, 12),
            desc: String(item.desc || '').slice(0, 200),
        })).filter(item => item.title);
    } catch {
        return [];
    }
}
export async function generateSearchResults({ engine = 'Google', query = '' } = {}) {
    const prompt = [
        context(),
        '用「' + engine + '」搜索：' + query,
        '生成 4 条搜索结果，标题和摘要要和这个世界、最近剧情有关。',
        '只输出 JSON：{"results":[{"title":"标题","url":"example.com/xxx","snippet":"两行摘要"}]}',
    ].filter(Boolean).join('\n');
    try {
        const raw = await generateText({ system: '你在为故事世界里的搜索引擎生成结果。用中文，只输出 JSON。', prompt, length: 800, json: true });
        const json = extractJson(raw) || {};
        return (Array.isArray(json.results) ? json.results : []).slice(0, 6).map(item => ({
            title: String(item.title || '').slice(0, 100),
            url: String(item.url || 'example.com').slice(0, 120),
            snippet: String(item.snippet || '').slice(0, 300),
        })).filter(item => item.title);
    } catch {
        return [];
    }
}

export async function generateWikiArticle(query) {
    const prompt = [
        context(),
        '生成一条「' + query + '」的百科条目，像维基百科：定义、历史、和这个世界的关系。',
        '只输出 JSON：{"title":"条目名","summary":"一句定义","sections":[{"h":"小标题","p":"正文"}]}',
    ].filter(Boolean).join('\n');
    try {
        const raw = await generateText({ system: '你在写故事世界里的百科条目。用中文，客观，只输出 JSON。', prompt, length: 900, json: true });
        const json = extractJson(raw) || {};
        if (!json.title) return null;
        return {
            title: String(json.title).slice(0, 80),
            summary: String(json.summary || '').slice(0, 300),
            sections: (Array.isArray(json.sections) ? json.sections : []).slice(0, 6).map(section => ({
                h: String(section.h || '').slice(0, 60),
                p: String(section.p || '').slice(0, 800),
            })).filter(section => section.p),
        };
    } catch {
        return null;
    }
}

export async function generateBooks(query) {
    const prompt = [
        context(),
        '在 Z-Library 搜索：' + (query || '旧城'),
        '生成 6 本电子书，书名、作者、年份、简介要和这个故事世界有关。',
        '只输出 JSON：{"books":[{"title":"书名","author":"作者","year":2024,"desc":"简介","format":"EPUB"}]}',
    ].filter(Boolean).join('\n');
    try {
        const raw = await generateText({ system: '你在为故事世界里的电子书库生成搜索结果。用中文，只输出 JSON。', prompt, length: 700, json: true });
        const json = extractJson(raw) || {};
        return (Array.isArray(json.books) ? json.books : []).slice(0, 10).map(item => ({
            title: String(item.title || '').slice(0, 100),
            author: String(item.author || '').slice(0, 60),
            year: Math.max(0, Number(item.year) || 0),
            desc: String(item.desc || '').slice(0, 300),
            format: String(item.format || 'EPUB').slice(0, 8),
        })).filter(item => item.title);
    } catch {
        return [];
    }
}
