/**
 * AI 编排：手机里的回复、朋友圈、评论、主动来信、正文注入。
 * 全部走酒馆当前连接，用 generateRaw 在后台生成，不写进正文。
 */
import { generateText, storyContext, importantStoryContext, memoryContext, userName, findCharacter, setPhonePrompt, currentCharacter } from './st.js';
import {
    getSettings, getData, findThread, appendMessages, ensureThread, addMoment, addNote, saveNow,
    getCast, setCast, findPerson, setFeed, getFeed,
} from './store.js';
import {
    chatSystemPrompt, chatUserPrompt, momentsSystemPrompt, momentsUserPrompt,
    commentSystemPrompt, commentUserPrompt, proactivePrompt, parseChatReply, parseMoments,
    extractJson, phoneStateSummary, personaBlock, trim, castSystemPrompt, castUserPrompt,
} from './prompts.js';
import { FEEDS } from './feed.js';
import { SOCIAL } from './social.js';
import { EXTRA } from './extra.js';
import { plotSystemPrompt, plotUserPrompt, plotFallback, toneOf } from './plot.js';
import { sparkSystemPrompt, sparkUserPrompt, sparkFallback, dateSystemPrompt, dateFallback } from './spark.js';
import { webSystemPrompt, webUserPrompt, webFallback } from './web.js';

const busy = new Set();

/** 把酒馆/接口的英文报错翻译成人话。 */
export function friendlyError(error) {
    const raw = String(error?.message || error || '').trim();
    if (/No message generated/i.test(raw)) return '模型没有返回内容：检查酒馆的 API，或换一个模型';
    if (/\b404\b|Not Found/i.test(raw)) return '接口地址返回 404：检查酒馆的 API 地址和模型名';
    if (/\b401\b|invalid.*key|unauthorized/i.test(raw)) return 'API Key 无效或过期';
    if (/\b429\b|rate limit/i.test(raw)) return '请求太频繁，等一会儿再试';
    if (/\b403\b|forbidden/i.test(raw)) return '这个 Key 没有权限，或者接口被挡住了';
    if (/timeout|超时/i.test(raw)) return raw || '生成超时了，再试一次';
    if (/未知错误|unknown error/i.test(raw)) return '酒馆接口返回未知错误：检查 API 地址/模型，或换一个模型再试';
    return raw || '生成失败';
}
export const aiEvents = new EventTarget();

function emit(type, detail) {
    try { aiEvents.dispatchEvent(new CustomEvent(type, { detail })); } catch { /* ignore */ }
}

export function isBusy(threadId) {
    return busy.has(threadId);
}

export function anyBusy() {
    return busy.size > 0;
}

function contactCandidates() {
    const names = [];
    const add = n => { const s = String(n || '').trim(); if (s && !names.includes(s)) names.push(s); };
    for (const person of getCast()) add(person.name);
    for (const thread of getData().threads) for (const m of thread.members) add(m);
    if (!names.length) {
        const current = currentCharacter();
        if (current?.group) for (const m of current.members || []) add(m);
        else add(current?.name);
    }
    return names;
}

function allContactCandidates() {
    const names = contactCandidates();
    for (const person of getCast()) if (!names.includes(person.name)) names.push(person.name);
    return names.slice(0, 10);
}

/** 让某个会话的人回消息。返回新增的消息数组。 */
export async function replyToThread(threadId, { proactive = false } = {}) {
    const thread = findThread(threadId);
    if (!thread) throw new Error('会话不存在');
    if (busy.has(threadId)) return [];
    busy.add(threadId);
    emit('typing', { threadId, typing: true });
    try {
        const settings = getSettings();
        const user = userName();
        const story = importantStoryContext(50, 500);
        const memory = memoryContext(12);
        const members = thread.members;
        const worldCard = currentCharacter();
        const world = worldCard?.group ? worldCard.name : (worldCard?.name || '');
        const card = findCharacter(worldCard?.name) || worldCard;
        const person = findPerson(members[0]);
        let system = chatSystemPrompt({ thread, person, world, card, settings, user, story, memory, reply: !proactive });
        if (members.length > 1) {
            const blocks = [];
            for (const name of members.slice(0, 4)) {
                const member = findPerson(name);
                const block = member
                    ? [member.role && '身份：' + member.role, member.desc, member.style && '说话方式：' + member.style].filter(Boolean).join('\n')
                    : personaBlock(name, findCharacter(name));
                if (block) blocks.push('【' + name + '】\n' + block);
            }
            if (blocks.length) system += '\n\n【群成员设定】\n' + blocks.join('\n\n');
        }
        const prompt = proactive
            ? proactivePrompt({ thread, user, story })
            : chatUserPrompt({ thread, user, limit: 24, story, memory });
        let raw = '';
        try {
            raw = await generateText({ system, prompt, length: proactive ? Math.min(220, settings.ai.length) : settings.ai.length });
        } catch (error) {
            if (proactive) return [];
            console.warn('[幻镜手机] 生成失败，使用本地回复', error);
            const last = [...(thread.msgs || [])].reverse().find(msg => msg.from === 'me')?.text || '';
            const fallback = localReply(thread, last);
            const saved = appendMessages(threadId, fallback.map(m => ({ ...m, from: 'them' })), { unread: true });
            emit('reply', { threadId, messages: saved });
            return saved;
        }
        const messages = parseChatReply(raw, {
            members,
            fallbackSender: members[0],
            max: proactive ? 4 : 7,
        });
        if (!messages.length) {
            if (!proactive) emit('empty', { threadId });
            return [];
        }
        const saved = appendMessages(threadId, messages.map(m => ({ ...m, from: 'them' })), { unread: true });
        emit('reply', { threadId, messages: saved });
        return saved;
    } finally {
        busy.delete(threadId);
        emit('typing', { threadId, typing: false });
    }
}

function localReply(thread, lastText = '') {
    const name = thread.members?.[0] || '对方';
    const text = String(lastText || '');
    const asks = /[?？]|吗|呢|怎么|什么|哪|谁/.test(text);
    const lines = asks
        ? ['我在。刚刚没顾上看手机。', '嗯，看到了。等我一会儿。']
        : ['好，我知道了。', '刚看到，晚点和你细说。'];
    const pick = lines[Math.floor(Math.random() * lines.length)];
    return [{ sender: name, type: 'text', text: pick, ts: Date.now() }];
}

/** 生成朋友圈。 */
export async function generateMoments(count = 4) {
    const settings = getSettings();
    const data = getData();
    const user = userName();
    const contacts = allContactCandidates();
    if (!contacts.length) throw new Error('先在酒馆里打开一个角色，或者去「通讯录」加一个人');
    const story = storyContext(40, 340);
    const memory = memoryContext(12);
    const recent = data.moments.slice(0, 6).map(m => m.text);
    const system = momentsSystemPrompt({ contacts, user, story, memory });
    const prompt = momentsUserPrompt({ count: Math.max(1, Math.min(5, count)), recent });
    const raw = await generateText({ system, prompt, length: Math.min(700, 140 * count) });
    const posts = parseMoments(raw, { contacts, user, max: count });
    if (!posts.length) throw new Error('这次没生成出动态，再试一次');
    const created = [];
    for (const post of posts) {
        const moment = addMoment({ author: post.author, text: post.text, likes: post.likes, comments: post.comments.map(c => ({ ...c, ts: Date.now() })) });
        if (moment) created.push(moment);
    }
    emit('moments', { created });
    return created;
}

/** 用户发动态后，好友来点赞评论。 */
export async function commentOnMoment(momentId) {
    const data = getData();
    const moment = data.moments.find(m => m.id === momentId);
    if (!moment) throw new Error('找不到这条动态');
    const contacts = allContactCandidates().filter(n => n !== moment.author);
    if (!contacts.length) return { likes: [], comments: [] };
    const system = commentSystemPrompt({ contacts, user: moment.author, memory: memoryContext(10) });
    const prompt = commentUserPrompt({ text: moment.text, user: moment.author });
    const raw = await generateText({ system, prompt, length: 220 });
    const json = extractJson(raw) || {};
    const likes = (Array.isArray(json.likes) ? json.likes : []).map(String).filter(n => contacts.includes(n));
    const comments = (Array.isArray(json.comments) ? json.comments : []).map(c => ({
        by: String(c?.by || '').trim(),
        text: String(c?.text || '').trim(),
    })).filter(c => c.text && c.by);
    if (likes.length) moment.likes = [...new Set([...moment.likes, ...likes])].slice(0, 30);
    for (const c of comments.slice(0, 4)) {
        moment.comments.push({ id: Math.random().toString(36).slice(2, 10), by: contacts.includes(c.by) ? c.by : contacts[0], text: c.text.slice(0, 300), ts: Date.now() });
    }
    moment.comments = moment.comments.slice(-30);
    saveNow('data');
    emit('moments', { updated: momentId });
    return { likes, comments };
}

/** 剧情之后，角色可能主动发来消息。 */
export async function runProactive({ force = false } = {}) {
    const settings = getSettings();
    const data = getData();
    if (!settings.proactive.enabled && !force) return null;
    const now = Date.now();
    const meta = data.meta;
    if (!force) {
        if (now - (meta.lastProactive || 0) < settings.proactive.cooldown * 1000) return null;
        const recent = (meta.proactiveTimes || []).filter(t => now - t < 3600_000);
        if (recent.length >= settings.proactive.perHour) return null;
    }
    meta.lastProactive = now;
    meta.proactiveTimes = [...(meta.proactiveTimes || []).filter(t => now - t < 3600_000), now].slice(-20);
    saveNow('data');

    const current = currentCharacter();
    let target = null;
    const candidates = data.threads.filter(t => !t.muted && t.msgs.length);
    if (candidates.length) {
        // 优先最近聊过、且最后一条不是 TA 刚发的
        const last = candidates[0] ?? [...candidates].sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
        const tail = last.msgs[last.msgs.length - 1];
        if (!tail || tail.from === 'them' && now - tail.ts < 20 * 60000) return null;
        target = last;
    } else if (current && !current.group && current.name) {
        target = ensureThread([current.name]);
    }
    if (!target) return null;
    try {
        const messages = await replyToThread(target.id, { proactive: true });
        return messages.length ? { threadId: target.id, messages } : null;
    } catch (error) {
        console.warn('[幻镜手机] 主动来信失败', error);
        return null;
    }
}

/** 把手机里的消息摘要注入正文。 */
function relevantHearts(data) {
    const all = getFeed('heart')?.items || [];
    if (!all.length) return [];
    const recent = storyContext(8, 320).map(line => line.text).join(' ');
    const threads = (data.threads || []).slice(0, 4).flatMap(thread => thread.members || []);
    const active = all.filter(person => person.name && (recent.includes(person.name) || threads.includes(person.name)));
    if (active.length) return active.slice(0, 4);
    // 最近剧情没提到任何人时，只带上好感最高的两个人，避免无关注入
    return [...all].sort((a, b) => (Number(b.affection) || 0) - (Number(a.affection) || 0)).slice(0, 2);
}

function recentOtherChats() {
    const lines = [];
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 70);

    const telegram = getFeed('telegram')?.chats || [];
    for (const chat of telegram.slice(0, 4)) {
        const msgs = (chat.messages || []).slice(-5);
        if (!msgs.length) continue;
        const body = msgs.map(msg => (msg.mine || msg.name === userName() ? userName() : (msg.name || chat.name)) + '：' + clean(msg.text)).join(' / ');
        lines.push('· Telegram「' + chat.name + '」' + (chat.style ? '（' + chat.style + '）' : '') + '：' + body);
    }

    const signal = getFeed('signal')?.items || [];
    for (const chat of (Array.isArray(signal) ? signal : []).slice(0, 4)) {
        const msgs = (chat.messages || []).slice(-4);
        if (!msgs.length) continue;
        const body = msgs.map(msg => (msg.mine ? userName() : (msg.name || chat.name)) + '：' + clean(msg.text)).join(' / ');
        lines.push('· Signal「' + chat.name + '」' + (chat.style ? '（' + chat.style + '）' : '') + '：' + body);
    }

    const discord = getFeed('discord')?.servers || [];
    for (const server of discord.slice(0, 3)) {
        for (const channel of (server.channels || []).slice(0, 2)) {
            const msgs = (channel.messages || []).slice(-2);
            if (!msgs.length) continue;
            const body = msgs.map(msg => (msg.author || '网友') + '：' + clean(msg.text)).join(' / ');
            lines.push('· Discord「' + server.name + ' / #' + channel.name + '」：' + body);
        }
    }

    const emails = getFeed('gmail')?.emails || [];
    for (const mail of emails.filter(item => item.replies?.length).slice(0, 3)) {
        const body = mail.replies.slice(-2).map(reply => (reply.mine ? userName() : (reply.from || mail.from)) + '：' + clean(reply.text)).join(' / ');
        lines.push('· Gmail「' + mail.subject + '」：' + body);
    }
    return lines.slice(0, 20);
}

export function refreshInjection() {
    const settings = getSettings();
    const data = getData();
    const text = phoneStateSummary({ threads: data.threads, user: userName(), hearts: relevantHearts(data), selfProfile: data.heartSelf || null, worldProfile: data.worldInfo || null, extras: recentOtherChats() });
    setPhonePrompt(text, { depth: settings.inject.depth, enabled: settings.inject.enabled && !!text });
    return text;
}

export function previewInjection() {
    const data = getData();
    return phoneStateSummary({ threads: data.threads, user: userName(), hearts: relevantHearts(data), extras: recentOtherChats() });
}

/**
 * 从当前角色卡里找出这个世界里的人。
 * 用户说的是「和卡里的人物聊天」，所以人物是手机通讯录的基本单位。
 */
export async function extractCast() {
    const current = currentCharacter();
    if (!current) throw new Error('先在酒馆里打开一张角色卡');
    if (current.group) throw new Error('群聊卡暂时不支持提取人物，先在酒馆里选一张单人卡');
    const user = userName();
    const card = findCharacter(current.name) || current;
    const memory = memoryContext(12);
    const story = importantStoryContext(48, 840);
    const raw = await generateText({
        system: castSystemPrompt({ user }),
        prompt: castUserPrompt({ card, story, memory, user }),
        length: 1500,
        json: true,
    });
    const json = extractJson(raw);
    const people = Array.isArray(json?.people) ? json.people : [];
    if (!people.length) throw new Error('这次没找出人来，换一个模型再试');
    const cast = people
        .map(person => ({
            name: String(person?.name || '').trim(),
            role: String(person?.role || '').trim(),
            relation: String(person?.relation || '').trim(),
            desc: String(person?.desc || person?.persona || '').trim(),
            style: String(person?.style || '').trim(),
        }))
        .filter(person => person.name && person.name !== user)
        .slice(0, 8);
    if (!cast.length) throw new Error('没找到可以放进通讯录的人');
    return setCast(cast, { extracted: true });
}

/** 应用商店里的内容类 App：拉一次新内容。 */
export async function generateFeed(appId) {
    const config = FEEDS[appId];
    if (!config) throw new Error('没有这个应用');
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const story = storyContext(40, 340);
    const memory = memoryContext(12);
    const system = config.system({ world, people, user, story, memory });
    const prompt = config.prompt({ count: config.count, people });
    const raw = await generateText({ system, prompt, length: 1500, json: true });
    const items = config.parse(raw);
    const empty = !items
        || (Array.isArray(items) && !items.length)
        || (!Array.isArray(items) && !(items.posts?.length || items.hot?.length));
    if (empty) throw new Error('这次没生成出内容，再刷一次');
    setFeed(appId, items);
    return items;
}

/** 启程：摇一次剧情推进。 */
export async function advancePlot(toneId) {
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const story = storyContext(5, 220);
    const data = getData();
    const recent = data.plot?.history?.[0] || null;
    const raw = await generateText({
        system: plotSystemPrompt({ world, people, user }),
        prompt: plotUserPrompt({ tone: toneId, story, recent }),
        length: 1100,
        json: true,
    });
    const json = extractJson(raw);
    if (!json || !(json.title || json.scene)) {
        return plotFallback({ tone: toneId, world, people, story });
    }
    return {
        tone: toneOf(toneId).id,
        title: String(json.title || '').slice(0, 80),
        scene: String(json.scene || '').slice(0, 600),
        hook: String(json.hook || '').slice(0, 400),
        twist: String(json.twist || '').slice(0, 60),
        options: (Array.isArray(json.options) ? json.options : []).slice(0, 4).map(String),
    };
}

/** 相遇：按描述找几个候选人。 */
export async function findMatches({ description = '', vibes = [] } = {}) {
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    let raw = '';
    try {
        raw = await generateText({
            system: sparkSystemPrompt({ world, people, user }),
            prompt: sparkUserPrompt({ description, vibes }),
            length: 1200,
            json: true,
        });
    } catch (error) {
        return sparkFallback({ description, vibes }).candidates;
    }
    const json = extractJson(raw);
    const list = Array.isArray(json?.candidates) ? json.candidates : [];
    if (!list.length) return sparkFallback({ description, vibes }).candidates;
    return list.slice(0, 4).map((item, index) => ({
        id: 'c' + Date.now().toString(36) + index,
        name: String(item.name || '某人').slice(0, 24),
        age: String(item.age || '').slice(0, 8),
        job: String(item.job || '').slice(0, 40),
        tags: (Array.isArray(item.tags) ? item.tags : []).slice(0, 5).map(String),
        bio: String(item.bio || '').slice(0, 300),
        opening: String(item.opening || '').slice(0, 200),
        tone: ['warm', 'danger', 'young', 'mature', 'mystery'].includes(item.tone) ? item.tone : 'warm',
    }));
}

/** 相遇：安排一次约会。 */
export async function planDate(match) {
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const person = findPerson(match.name) || { name: match.name, role: '', desc: '' };
    try {
        const raw = await generateText({
            system: dateSystemPrompt({ world, person, stage: match.stage, dates: match.dates?.length || 0, user }),
            prompt: '安排这次见面。' + (match.dates?.length ? '上一次是：' + match.dates[match.dates.length - 1].title : ''),
            length: 900,
            json: true,
        });
        const json = extractJson(raw);
        if (json?.scene) {
            return {
                title: String(json.title || '一次见面').slice(0, 60),
                scene: String(json.scene).slice(0, 900),
                moment: String(json.moment || '').slice(0, 300),
            };
        }
    } catch { /* 用本地版本 */ }
    return dateFallback({ person, stage: match.stage });
}

/** 浏览器：生成一个网页。 */
export async function browse(query) {
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const story = storyContext(40, 320);
    const memory = memoryContext(12);
    try {
        const raw = await generateText({
            system: webSystemPrompt({ world, people, user, story, memory }),
            prompt: webUserPrompt(query),
            length: 1200,
            json: true,
        });
        const json = extractJson(raw);
        if (json?.title) {
            return {
                url: String(query).slice(0, 80),
                title: String(json.title).slice(0, 100),
                summary: String(json.summary || '').slice(0, 300),
                sections: (Array.isArray(json.sections) ? json.sections : []).slice(0, 6).map(section => ({
                    h: String(section?.h || '').slice(0, 60),
                    p: String(section?.p || '').slice(0, 700),
                })),
                links: (Array.isArray(json.links) ? json.links : []).slice(0, 6).map(link => ({
                    title: String(link?.title || '').slice(0, 60),
                    url: String(link?.url || '').slice(0, 80),
                })),
                ts: Date.now(),
            };
        }
    } catch { /* 本地兜底 */ }
    return { ...webFallback({ query, world, people }), url: query, ts: Date.now() };
}

/** 商店里的社交 App：拉一次内容。 */
export async function generateSocial(appId) {
    const config = SOCIAL[appId];
    if (!config) throw new Error('没有这个应用');
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const story = storyContext(3, 160);
    const raw = await generateText({
        system: config.system({ world, people, user, story }),
        prompt: config.prompt({ count: config.count }),
        length: 1400,
        json: true,
    });
    const items = config.parse(raw);
    if (!items.length) throw new Error('这次没生成出内容');
    setFeed(appId, items);
    return items;
}

/** Discord / Telegram / Spotify / Gmail。 */
export async function generateExtra(appId) {
    const config = EXTRA[appId];
    if (!config) throw new Error('没有这个应用');
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const story = storyContext(40, 340);
    const memory = memoryContext(12);
    const raw = await generateText({ system: config.system({ world, people, user, story, memory }), prompt: config.prompt(), length: 1300, json: true });
    const parsed = config.parse(extractJson(raw) || {});
    const has = (parsed.servers?.length || parsed.chats?.length || parsed.tracks?.length || parsed.emails?.length);
    if (!has) throw new Error('这次没生成出内容');
    setFeed(appId, parsed);
    return parsed;
}

/** 从最近正文里找出公司名。 */
export async function extractCompanies() {
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const story = storyContext(20, 300);
    const memory = memoryContext(8).map(item => String(item.text || '').slice(0, 400)).filter(Boolean).join('\n');
    const text = [memory, ...story.map(line => (line.isUser ? '用户' : line.name) + '：' + line.text)].join('\n');
    if (!text) return [];
    try {
        const raw = await generateText({
            system: '你从故事里找出被提到的公司、机构、店铺或组织。只输出 JSON：{"companies":[{"name":"名称"}]}。不要编造。',
            prompt: '世界：' + world + '\n最近剧情：\n' + text,
            length: 700,
            json: true,
        });
        const json = extractJson(raw);
        const list = Array.isArray(json?.companies) ? json.companies : [];
        if (list.length) return [...new Set(list.map(item => String(item?.name || '').trim()).filter(Boolean))].slice(0, 8);
    } catch { /* 用正则兜底 */ }
    const found = text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,10}(?:公司|集团|科技|银行|能源|传媒|制药|矿业|航空|地产|研究院|事务所|商会|店铺|书店)/g) || [];
    return [...new Set(found)].slice(0, 8);
}

/** 生成评论区：每个内容一套，风格可调。 */
export async function generateComments(item, app = '内容') {
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const style = getSettings().ai?.commentStyle || '真实网友';
    const story = storyContext(40, 340).map(line => (line.isUser ? user : line.name) + '：' + line.text).join('\n');
    const memory = memoryContext(12).map(entry => String(entry.text || '').slice(0, 500)).filter(Boolean).join('\n');
    const raw = await generateText({
        system: [
            '你在为一个故事世界里的「' + app + '」生成评论区。',
            world ? '世界：' + world : '',
            people.length ? '这个世界的人：' + people.join('、') : '',
            memory ? '记忆库 / 摘要（背景）：\n' + memory : '',
            story ? '最近剧情（背景）：\n' + story : '',
            '评论风格：' + style + '。',
            '每条评论像真实网友：短、具体、有反应，不要复读标题，不要解释。',
            '昵称要像网名，不要用真实人名列表。',
            '只输出 JSON：{"comments":[{"name":"网名","text":"评论","likes":12}]}',
        ].filter(Boolean).join('\n'),
        prompt: '内容标题：' + (item.title || '') + '\n正文：' + String(item.text || item.desc || '').slice(0, 600) + '\n作者：' + (item.author || '') + '\n生成 5 条评论。',
        length: 900,
        json: true,
    });
    const json = extractJson(raw);
    const list = Array.isArray(json?.comments) ? json.comments : [];
    if (!list.length) throw new Error('这次没生成出评论');
    return list.slice(0, 8).map((entry, index) => ({
        name: String(entry?.name || ('网友' + (index + 1))).slice(0, 20),
        text: String(entry?.text || '').slice(0, 160),
        likes: Math.max(0, Number(entry?.likes) || 0),
    })).filter(entry => entry.text);
}

/** 备忘录里的「今天的日记」：用当前角色的口吻写最近发生的事。 */
export async function writeDiary() {
    const user = userName();
    const story = storyContext(12, 360);
    const memory = memoryContext(12).map(item => String(item.text || '').slice(0, 600)).filter(Boolean).join('\n');
    const current = currentCharacter();
    const who = current?.name || '我';
    if (!story.length) throw new Error('正文里还没有可以记的事');
    const system = [
        '你在以「' + who + '」的口吻写一篇日记，读者只有自己。',
        '像真人写日记：第一人称，口语，有细节和心情，可以写天气、当时在做什么、想起的事。',
        '不要写章节标题，不要复述剧情大纲，不要替「' + user + '」说话。',
        '篇幅 150 到 350 字。',
    ].join('\n');
    const prompt = (memory ? '记忆库 / 摘要：\n' + memory + '\n\n' : '') + '最近发生的事：\n' + story.map(line => (line.isUser ? user : line.name) + '：' + line.text).join('\n') +
        '\n\n请写这一天的日记。';
    const raw = await generateText({ system, prompt, length: 700 });
    const text = String(raw || '').trim();
    if (!text) throw new Error('今天好像没什么可写的');
    return addNote(text);
}

export function quoteForBring(thread) {
    const user = userName();
    if (!thread) return '';
    return [
        '【手机上的对话】',
        user + '和' + thread.members.join('、') + '刚才在手机里聊了这些：',
        ...thread.msgs.filter(m => m.from !== 'sys').slice(-6).map(m => (m.from === 'me' ? user : (m.sender || thread.members[0])) + '：' + trim(m.text, 120)),
        '接下来的正文可以自然地承接这段对话，不要原样复述。',
    ].join('\n');
}