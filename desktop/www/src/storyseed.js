/** 把正文和记忆库变成各 App 的第一批内容。 */
import { generateText, importantStoryContext, memoryContext, userName } from './st.js';
import { getCast, getFeed } from './store.js';
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
    const cast = getCast();
    const hearts = getFeed('heart')?.items || [];
    const characters = cast.map(person => {
        const heart = hearts.find(item => item.name === person.name);
        return '- ' + person.name + '：' + [
            person.role && '身份 ' + person.role,
            person.relation && '关系 ' + person.relation,
            person.desc && person.desc.slice(0, 160),
            person.style && '说话方式 ' + person.style,
            heart?.stage && '关系阶段 ' + heart.stage,
            heart?.likes?.length && '喜欢 ' + heart.likes.join('、'),
            heart?.boundaries?.length && '边界 ' + heart.boundaries.join('、'),
        ].filter(Boolean).join('；');
    }).join('\n');
    const prompt = [
        context(),
        characters ? '这个世界里的人：\n' + characters : '',
        '在 Z-Library 搜索：' + (query || '旧城'),
        '如果搜索词是某个角色的名字，就生成这个角色会读、会收藏、或者自己写的书；否则生成这个世界里流通的书。',
        '每本书都要符合角色的性格、观念、文化背景、立场和阶级，不要只换标题。',
        '至少 2 本标明是某个角色写的/读的。',
        '只输出 JSON：{"books":[{"title":"书名","author":"作者","owner":"适合谁/谁写的","why":"为什么这个人会读或写，和性格、阶级、立场、文化的关系","year":2024,"desc":"简介","format":"EPUB"}]}',
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
            owner: String(item.owner || '').slice(0, 40),
            why: String(item.why || '').slice(0, 300),
        })).filter(item => item.title);
    } catch {
        return [];
    }
}
/** 试读：让模型写这本书开头几页，失败就用本地兜底。 */
export async function generateBookExcerpt(book = {}) {
    const prompt = [
        context(),
        '书名：' + (book.title || ''),
        '作者：' + (book.author || '佚名'),
        book.owner ? '这本书和谁有关：' + book.owner : '',
        book.desc ? '简介：' + book.desc : '',
        '像真的书一样，写这本书开头的正文：一个小节标题 + 三段正文，语气和这本书的定位一致。',
        '只输出 JSON：{"chapter":"小节标题","text":"正文，段落之间用\\n分隔"}',
    ].filter(Boolean).join('\n');
    try {
        const raw = await generateText({ system: '你在写故事世界里一本书的开头几页。用中文，只输出 JSON。', prompt, length: 900, json: true });
        const json = extractJson(raw) || {};
        if (json.text) return { chapter: String(json.chapter || '第一章').slice(0, 40), text: String(json.text).slice(0, 2000) };
    } catch { /* 用兜底 */ }
    return {
        chapter: '第一章',
        text: [
            (book.desc || '这本书在这个世界里流传了很久。') + '\n',
            '翻开第一页，纸的味道先于文字出现。' + (book.owner ? '扉页上有一行小字，署名是' + book.owner + '。' : ''),
            '写到第三段的时候，作者忽然停下——像是有什么话没说完。',
        ].join('\n'),
    };
}

async function askJson(prompt, system) {
    try {
        const raw = await generateText({ system, prompt, length: 1000, json: true });
        return extractJson(raw) || {};
    } catch {
        return {};
    }
}

export async function generateCalendarEvents() {
    const today = new Date().toISOString().slice(0, 10);
    const json = await askJson([
        context(),
        '今天是 ' + today + '。从最近的正文里提取接下来会发生的事：约会、考试、见面、生日、纪念日。',
        '没有具体日期就按剧情合理估计；最多 6 条。',
        '只输出 JSON：{"events":[{"title":"事件","date":"YYYY-MM-DD","time":"19:30","note":"和谁、在哪"}]}',
    ].filter(Boolean).join('\n'), '你在整理故事里的日程。用中文，只输出 JSON。');
    return (Array.isArray(json.events) ? json.events : []).slice(0, 6).map(item => ({
        title: String(item.title || '').slice(0, 50),
        date: String(item.date || '').slice(0, 10),
        time: String(item.time || '').slice(0, 5),
        note: String(item.note || '').slice(0, 120),
    })).filter(item => item.title && /^\d{4}-\d{2}-\d{2}$/.test(item.date));
}

export async function generateLiveRooms() {
    const cast = getCast().map(person => person.name);
    const json = await askJson([
        context(),
        cast.length ? '世界里的人：' + cast.join('、') : '',
        '生成 4 个正在直播的房间：主播、标题、观众数、直播内容、几条弹幕。内容要和最近剧情有关。',
        '只输出 JSON：{"rooms":[{"title":"直播标题","streamer":"主播","viewers":1200,"category":"聊天","messages":[{"name":"观众","text":"弹幕"}]}]}',
    ].filter(Boolean).join('\n'), '你在生成故事世界里的直播平台。用中文，只输出 JSON。');
    return (Array.isArray(json.rooms) ? json.rooms : []).slice(0, 6).map(room => ({
        title: String(room.title || '').slice(0, 60),
        streamer: String(room.streamer || cast[0] || '主播').slice(0, 24),
        viewers: Math.max(0, Number(room.viewers) || 0),
        category: String(room.category || '聊天').slice(0, 12),
        messages: (Array.isArray(room.messages) ? room.messages : []).slice(0, 5).map(message => ({
            name: String(message.name || '观众').slice(0, 20),
            text: String(message.text || '').slice(0, 100),
        })).filter(message => message.text),
    })).filter(room => room.title);
}

export async function generateDouban(kind = '书') {
    const cast = getCast().map(person => person.name);
    const json = await askJson([
        context(),
        cast.length ? '世界里的人：' + cast.join('、') : '',
        '生成 5 条豆瓣「' + kind + '」条目，每条带一个世界里的人写的短评，评语要符合他的性格和立场。',
        '只输出 JSON：{"items":[{"title":"名称","creator":"作者/导演/音乐人","rating":4.2,"review":"短评","reviewer":"谁写的","year":2024}]}',
    ].filter(Boolean).join('\n'), '你在为故事世界生成豆瓣书影音。用中文，只输出 JSON。');
    return (Array.isArray(json.items) ? json.items : []).slice(0, 8).map(item => ({
        title: String(item.title || '').slice(0, 80),
        creator: String(item.creator || '').slice(0, 50),
        rating: Math.max(0, Math.min(5, Number(item.rating) || 4)),
        review: String(item.review || '').slice(0, 400),
        reviewer: String(item.reviewer || cast[0] || '网友').slice(0, 24),
        year: Math.max(0, Number(item.year) || 0),
    })).filter(item => item.title);
}

export async function generateXianyu() {
    const cast = getCast().map(person => person.name);
    const json = await askJson([
        context(),
        cast.length ? '世界里的人：' + cast.join('、') : '',
        '生成 6 个闲鱼二手商品：旧物、礼物、书、电子产品，要有使用痕迹和卖家故事。',
        '只输出 JSON：{"items":[{"title":"商品","price":88,"condition":"几成新","seller":"卖家","desc":"为什么卖","category":"数码"}]}',
    ].filter(Boolean).join('\n'), '你在生成故事世界里的二手市场。用中文，只输出 JSON。');
    return (Array.isArray(json.items) ? json.items : []).slice(0, 8).map(item => ({
        title: String(item.title || '').slice(0, 60),
        price: Math.max(1, Number(item.price) || 20),
        condition: String(item.condition || '八成新').slice(0, 20),
        seller: String(item.seller || cast[0] || '旧城的人').slice(0, 24),
        desc: String(item.desc || '').slice(0, 300),
        category: String(item.category || '生活').slice(0, 12),
    })).filter(item => item.title);
}
