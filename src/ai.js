/**
 * AI 编排：手机里的回复、朋友圈、评论、主动来信、正文注入。
 * 全部走酒馆当前连接，用 generateRaw 在后台生成，不写进正文。
 */
import { generateText, storyContext, importantStoryContext, memoryContext, userName, findCharacter, setPhonePrompt, currentCharacter } from './st.js';
import {
    getSettings, getData, findThread, appendMessages, ensureThread, addMoment, addNote, saveNow,
    getCast, setCast, findPerson, setFeed, getFeed, getSelfProfile,
} from './store.js';
import {
    chatSystemPrompt, chatUserPrompt, momentsSystemPrompt, momentsUserPrompt,
    commentSystemPrompt, commentUserPrompt, proactivePrompt, parseChatReply, parseMoments,
    extractJson, phoneStateSummary, personaBlock, trim, castSystemPrompt, castUserPrompt,
} from './prompts.js';
import { powerRoster } from './roster.js';
import { FEEDS } from './feed.js';
import { SOCIAL } from './social.js';
import { EXTRA } from './extra.js';
import {
    chatFloors, memoryCursor, bestDepth, plannedDepth, summarizeDue, saveMemoryEntry, memoryBlock,
} from './memory.js';
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
        const story = importantStoryContext(80, 500);
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
    const story = storyContext(80, 340);
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

export function recentOtherChats() {
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
    const memoryText = settings.memory?.inject === false ? '' : memoryBlock({
        limit: Number(settings.memory?.limit) || 4,
        people: (data.world?.cast || []).map(person => person.name),
    });
    const base = phoneStateSummary({ threads: data.threads, user: userName(), hearts: relevantHearts(data), selfProfile: getSelfProfile(), worldProfile: data.worldInfo || null, extras: recentOtherChats(), power: powerRoster({ selfProfile: getSelfProfile() }) });
    const text = memoryText ? (base + '\n\n' + memoryText) : base;
    setPhonePrompt(text, { depth: settings.inject.depth, enabled: settings.inject.enabled && !!text });
    return text;
}

export function previewInjection() {
    const data = getData();
    return phoneStateSummary({ threads: data.threads, user: userName(), hearts: relevantHearts(data), extras: recentOtherChats(), power: powerRoster({ selfProfile: getSelfProfile() }) });
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
    const story = importantStoryContext(80, 840);
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

    // 已有的人以"第一次认出来的"为准：模型后面把货车司机说成屠夫，也不许改掉
    const existing = new Map(getCast().map(person => [person.name, person]));
    const merged = cast.map(person => {
        const prev = existing.get(person.name);
        if (!prev) return person;
        return {
            ...prev,
            role: prev.role || person.role,
            relation: prev.relation || person.relation,
            desc: prev.desc || person.desc,
            style: prev.style || person.style,
        };
    });
    // 新一版没提到的人也别丢
    for (const person of existing.values()) {
        if (!merged.some(item => item.name === person.name)) merged.push(person);
    }
    // 主角本人的描述以角色卡为准（比模型猜的可靠）
    const cardName = String(card?.name || '').trim();
    if (cardName) {
        const target = merged.find(item => item.name === cardName);
        const cardText = String(card?.description || card?.persona || '').trim();
        if (target && cardText && cardText.length > String(target.desc || '').length) {
            target.desc = cardText.slice(0, 1200);
        }
    }
    return setCast(merged, { extracted: true });
}

/** 应用商店里的内容类 App：拉一次新内容。 */
export async function generateFeed(appId) {
    const config = FEEDS[appId];
    if (!config) throw new Error('没有这个应用');
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const story = storyContext(80, 340);
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
        difficulty: Number.isFinite(Number(item.difficulty))
            ? Math.max(0, Math.min(100, Math.round(Number(item.difficulty))))
            : undefined,
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

/** 轻量聊天页（Telegram / Signal / Discord 私聊）里，让对方回一句。 */
export async function replyInChat({ app = 'Chat', chat = {}, messages = [] } = {}) {
    const user = userName();
    const current = currentCharacter();
    const world = current?.name || '';
    const style = chat.style || '';
    const recent = messages.slice(-8).map(line => (line.mine ? user : (line.name || chat.name)) + '：' + String(line.text || '').slice(0, 80)).join('\n');
    try {
        const raw = await generateText({
            system: [
                '你在扮演故事世界里的聊天对象，用中文回一条消息。',
                world ? '世界：' + world : '',
                style ? '说话风格：' + style : '',
                '只回一句话，20 字以内，像真人发消息，不要旁白、不要加引号。',
            ].filter(Boolean).join('\n'),
            prompt: '聊天记录：\n' + recent + '\n\n现在你是『' + (chat.name || '对方') + '』，回一条。',
            length: 120,
        });
        const text = String(raw || '').split('\n').map(line => line.trim()).filter(Boolean).pop() || '';
        if (text) return text.replace(/^["「]|["」]$/g, '').slice(0, 60);
    } catch { /* 用兜底 */ }
    const fallback = ['嗯，在的。', '刚看到，等下回你。', '好，我知道了。', '你说。'];
    return fallback[Math.floor(Math.random() * fallback.length)];
}

/** 浏览器：生成一个网页。 */
export async function browse(query) {
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const story = storyContext(80, 320);
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

/** 自动总结：够 N 层就悄悄跑一次（失败不打扰）。 */
let autoMemoryBusy = false;
export async function autoSummarizeMemory() {
    if (autoMemoryBusy) return null;
    if (!summarizeDue()) return null;
    autoMemoryBusy = true;
    try {
        return await summarizeMemory({});
    } catch (error) {
        console.warn('[幻镜手机] 自动总结失败', error);
        return null;
    } finally {
        autoMemoryBusy = false;
    }
}

/** 把最近若干楼层总结成一条长期记忆（含隐藏楼层）。 */
export async function summarizeMemory({ turns = 0 } = {}) {
    const floors = chatFloors();
    if (!floors.length) throw new Error('这个聊天还没有楼层');
    const cursor = memoryCursor();
    const start = Math.max(0, Math.min(floors.length - 1, cursor));
    const available = Math.max(1, floors.length - start);
    const depth = Math.max(4, Math.min(120, Number(turns) || plannedDepth(available)));
    const slice = floors.slice(start, start + depth);
    if (slice.length < 4) throw new Error('楼层太少，先多聊几句再总结');
    const hiddenCount = slice.filter(item => item.hidden).length;
    const transcript = slice.map(item => {
        const who = item.isUser ? userName() : (item.name || '角色');
        return '[#' + item.index + (item.hidden ? ' 隐藏' : '') + '] ' + who + '：' + item.text.replace(/\s+/g, ' ').slice(0, 600);
    }).join('\n');
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const raw = await generateText({
        system: [
            '你在给一段角色扮演剧情做"长期记忆"存档，不是复述，也不是续写。',
            world ? '世界：' + world : '',
            '只记录已经发生、且以后还会用到的信息：谁做了什么事、关系怎么变化、答应过什么、留下了什么悬念。',
            '不要编造没写过的动机；不确定就写"未明说"。',
            '只输出 JSON：{"title":"8 字以内标题","summary":"120-220 字，按时间顺序","facts":["3-6 条短事实"],"people":["出场人物"]}',
        ].filter(Boolean).join('\n'),
        prompt: '剧情：\n' + transcript,
        length: 900,
        json: true,
    });
    const json = extractJson(raw);
    if (!json?.summary) throw new Error('这次没总结出来，再试一次');
    const entry = {
        id: 'mem-' + Date.now().toString(36),
        title: String(json.title || '一段记忆').slice(0, 24),
        text: String(json.summary).slice(0, 600),
        facts: (Array.isArray(json.facts) ? json.facts : []).map(item => String(item).slice(0, 60)).slice(0, 6),
        people: (Array.isArray(json.people) ? json.people : []).map(item => String(item).slice(0, 20)).slice(0, 8),
        from: slice[0].index,
        to: slice[slice.length - 1].index,
        hidden: hiddenCount,
        ts: Date.now(),
    };
    saveMemoryEntry(entry);
    saveNow('data');
    return entry;
}

/** 夜约：按圈子生成一批人（描述和需求都让模型写，不套模板）。 */
export async function generateDatingBoard({ group = '附近的人', tier = 0, count = 6 } = {}) {
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const levels = ['普通圈（学生、店员、上班族）', '夜生活圈（调酒师、模特、驻唱）', '名媛圈（千金、影后、画廊主人）', '贵族圈（伯爵夫人、世家继承人、公主）'];
    try {
        const raw = await generateText({
            system: [
                '你在给一个成人交友软件「夜约」生成附近的人。',
                world ? '世界：' + world : '',
                people.length ? '这个世界的人：' + people.join('、') : '',
                '每个人都要有：名字、年龄、身高、体型、职业、想找什么、一句自我描述、一条需求（need）、一条要求（demand）。',
                'need = 她自己想要什么（想要什么人、什么身材、什么体验，100 字以内，直接说）。',
                'demand = 她对别人的要求（长相、身材、尺寸、时间、规矩，100 字以内，直接说，别客气）。',
                '两条都要像真人发帖，别用模板句，别用"希望对方…"这种公文腔。',
                '注意反差：看起来含蓄、正经、斯文的人（比如学姐、老师、医生），需求也可以很直接很大胆——这是这个 App 的看点。',
                '只输出 JSON：{"people":[{"name":"…","age":24,"height":168,"build":"匀称","role":"…","intent":"现在就要","desc":"…","need":"…","demand":"…","now":true}]}',
            ].filter(Boolean).join('\n'),
            prompt: '圈子：' + levels[Math.max(0, Math.min(3, tier))] + '。生成 ' + count + ' 个人。',
            length: 1800,
            json: true,
        });
        const json = extractJson(raw);
        const list = Array.isArray(json?.people) ? json.people : [];
        return list.slice(0, 10).map((entry, index) => ({
            id: 'ai-' + Date.now().toString(36) + index,
            name: String(entry?.name || '匿名').slice(0, 20),
            age: Math.max(18, Math.min(60, Number(entry?.age) || 24)),
            height: Math.max(140, Math.min(210, Number(entry?.height) || 168)),
            build: String(entry?.build || '匀称').slice(0, 10),
            role: String(entry?.role || '').slice(0, 20),
            intent: String(entry?.intent || '现在就要').slice(0, 12),
            when: String(entry?.when || '今晚').slice(0, 12),
            desc: String(entry?.desc || '').slice(0, 200),
            need: String(entry?.need || '').slice(0, 200),
            demand: String(entry?.demand || '').slice(0, 200),
            note: '',
            distance: (0.3 + index * 0.7).toFixed(1),
            now: !!entry?.now,
            mine: false,
        }));
    } catch {
        return [];
    }
}

/** 八卦区：读最近的正文，写成一堆网友爆料帖。 */
export async function generateGossip({ app = '微博' } = {}) {
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const story = storyContext(60, 320).map(line => (line.isUser ? user : line.name) + '：' + line.text).join('\n');
    const memory = memoryContext(10).map(entry => String(entry.text || '').slice(0, 280)).filter(Boolean).join('\n');
    try {
        const raw = await generateText({
            system: [
                '你在「' + app + '」的八卦区发帖，读者是一群爱看热闹的网友。',
                world ? '世界：' + world : '',
                people.length ? '这个世界的人：' + people.join('、') : '',
                memory ? '背景：\n' + memory : '',
                '根据下面的正文写 6 条八卦帖：标题像热搜/爆料，正文 30-80 字，口吻像网友在传话。',
                '不要复述原文，要写成"听来的""有人看见"这种二手消息，可以夸张，可以有不同说法、有人辟谣。',
                '只输出 JSON：{"posts":[{"title":"…","text":"…","author":"网名","hot":"12万"}]}',
            ].filter(Boolean).join('\n'),
            prompt: '最近的正文：\n' + (story || '（正文还不多，就写点这个世界流传的传闻）'),
            length: 1200,
            json: true,
        });
        const json = extractJson(raw);
        const list = Array.isArray(json?.posts) ? json.posts : [];
        if (list.length) {
            return list.slice(0, 8).map((entry, index) => ({
                id: 'gp-' + Date.now().toString(36) + index,
                title: String(entry?.title || '听说…').slice(0, 60),
                text: String(entry?.text || '').slice(0, 300),
                author: String(entry?.author || '匿名网友').slice(0, 20),
                hot: String(entry?.hot || '').slice(0, 10),
                time: '刚刚',
            }));
        }
    } catch { /* 本地兜底 */ }
    const lines = (story || '最近没什么动静').split('\n').slice(-3);
    const authors = ['吃瓜群众', '旧城闲人', '匿名投稿'];
    return lines.map((line, index) => ({
        id: 'gp-' + Date.now().toString(36) + index,
        title: ['有人看见', '听说', '疑似'][index % 3] + '：' + String(line).slice(2, 26),
        text: '据说' + String(line).slice(0, 90) + '……我也不确定，先发出来，有知道内情的吗？',
        author: authors[index % authors.length],
        hot: (Math.floor(Math.random() * 90) + 10) + '万',
        time: '刚刚',
    }));
}

/** 浏览器：先出一个"搜索结果页"（一排排条目），点进去再生成正文。 */
export async function searchWeb(query) {
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const story = storyContext(80, 320);
    const memory = memoryContext(12);
    const value = String(query || '').slice(0, 80);
    try {
        const raw = await generateText({
            system: [
                webSystemPrompt({ world, people, user, story, memory }),
                '这次你扮演一个搜索结果页，不是网页正文。只输出 JSON：',
                '{"results":[{"site":"百科","title":"…","url":"…","snippet":"…"}],"related":["…"]}',
                'site 只能是：百科 / 文库 / 新闻 / 论坛 / 知乎 / 贴吧 / 官网 / 博客 / 视频 / 地图。',
                '给 8 到 10 条结果，snippet 40-90 字，标题像真搜索结果那样具体。',
            ].filter(Boolean).join('\n'),
            prompt: '搜索：' + value,
            length: 1400,
            json: true,
        });
        const json = extractJson(raw);
        const list = Array.isArray(json?.results) ? json.results : [];
        if (list.length) {
            return {
                type: 'results',
                query: value,
                results: list.slice(0, 10).map((entry, index) => ({
                    site: String(entry?.site || '网页').slice(0, 8),
                    title: String(entry?.title || '结果 ' + (index + 1)).slice(0, 80),
                    url: String(entry?.url || '').slice(0, 80),
                    snippet: String(entry?.snippet || '').slice(0, 180),
                })),
                related: (Array.isArray(json?.related) ? json.related : []).map(item => String(item).slice(0, 24)).slice(0, 6),
                ts: Date.now(),
            };
        }
    } catch { /* 本地兜底 */ }
    const sites = ['百科', '文库', '新闻', '论坛', '知乎', '贴吧'];
    return {
        type: 'results',
        query: value,
        results: sites.map(site => ({
            site,
            title: value + ' · ' + site,
            url: site + '.oldcity/' + encodeURIComponent(value.slice(0, 12)),
            snippet: '关于「' + value + '」的' + site + '条目，收录了旧城这边的说法和几条近期更新。',
        })),
        related: [value + ' 怎么回事', value + ' 最新', value + ' 讨论'],
        ts: Date.now(),
    };
}

/** 商店里的社交 App：拉一次内容。 */
export async function generateSocial(appId) {
    const config = SOCIAL[appId];
    if (!config) throw new Error('没有这个应用');
    const user = userName();
    const current = currentCharacter();
    const world = current?.group ? current.name : (current?.name || '');
    const people = getCast().map(person => person.name);
    const story = storyContext(80, 340);
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
    const story = storyContext(80, 340);
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
    const story = storyContext(80, 300);
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
    const ai = getSettings().ai || {};
    const style = ai.commentStyle || '真实网友';
    const tone = String(ai.commentTone || '').trim();
    const strength = Math.max(0, Math.min(500, Number(ai.commentStrength ?? 100))) / 100;
    const strengthText = strength <= 0.3
        ? '几乎不带风格，就是普通路人随口一说。'
        : strength >= 3
            ? '把这种风格拉到极端，每一句都要顶满，允许夸张。'
            : '正常强度，自然一点，别用力过猛。';
    const story = storyContext(80, 340).map(line => (line.isUser ? user : line.name) + '：' + line.text).join('\n');
    const memory = memoryContext(12).map(entry => String(entry.text || '').slice(0, 500)).filter(Boolean).join('\n');
    const raw = await generateText({
        system: [
            '你在为一个故事世界里的「' + app + '」生成评论区。',
            world ? '世界：' + world : '',
            people.length ? '这个世界的人：' + people.join('、') : '',
            memory ? '记忆库 / 摘要（背景）：\n' + memory : '',
            story ? '最近剧情（背景）：\n' + story : '',
            '评论风格：' + style + (tone ? '（' + tone + '）' : '') + '，强度 ' + Math.round(strength * 100) + '%。',
            '强度说明：' + strengthText,
            '每条评论像真实网友：短、具体、有反应，不要复读标题，不要解释。',
            '先像个普通人那样反应：遇到离谱、不可能、明显越级的事（比如普通人跟大人物在一起、亲眼见到超自然事件），',
            '第一反应是怀疑、觉得是编的/炒作/玩梗，要求实拍证据，而不是直接相信、羡慕或祝贺。',
            '只有正文里已经给足证据的事，评论才会当真。',
            '可以有分歧：一部分人信，一部分人骂，一部分人玩梗，别写成清一色好评。',
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
    const story = storyContext(80, 360);
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