/**
 * 数据与设置：默认值、迁移、存取、变更广播。
 * 聊天级数据放在 chatMetadata，全局设置放在 extensionSettings。
 */
import { ctx, saveChatMetadata, saveGlobalSettings, MODULE } from './st.js';

export const DATA_KEY = MODULE;
export const SETTINGS_KEY = MODULE;
export const DATA_VERSION = 1;

export const LIMITS = Object.freeze({
    threads: 24,
    messages: 260,
    moments: 80,
    notes: 120,
    photos: 40,
});

export const ACCENTS = Object.freeze({
    amber: { name: '暖阳', color: '#f0a35e', soft: '#ffd9ae' },
    rose: { name: '蔷薇', color: '#ef6f8e', soft: '#ffd0dc' },
    mint: { name: '薄荷', color: '#4fc2a2', soft: '#c6f3e6' },
    sky: { name: '晴空', color: '#5aa7f5', soft: '#cfe5ff' },
    violet: { name: '暮紫', color: '#a98bf0', soft: '#e2d7ff' },
    ink: { name: '墨色', color: '#8d94a8', soft: '#dfe3ee' },
});

export const WALLPAPERS = Object.freeze({
    aurora: { name: '极光', css: 'aurora' },
    dusk: { name: '暮色', css: 'dusk' },
    cherry: { name: '樱雪', css: 'cherry' },
    forest: { name: '深林', css: 'forest' },
    paper: { name: '纸感', css: 'paper' },
    custom: { name: '自定义', css: 'custom' },
});

export const DEFAULT_STYLE = [
    '你在用手机聊天软件回复对方。像真的发消息：口语、简短、有停顿和语气词，不写动作、旁白和心理描写，不加引号。',
    '一次发几条、每条多长，按这个人的性格和当下的心情来：话少的人可能只回一两个字；话多的人会连着发好几条。不要每次都发差不多。',
    '可以看情况用手机功能：发一张照片、一段语音、一个红包、一个位置，或者拍一拍对方，但大多数时候还是打字。',
].join('\n');

export function defaultSettings() {
    return {
        v: 1,
        enabled: true,
        theme: 'dark',            // dark | light | auto
        accent: 'amber',
        glass: 1,                 // 0 .. 1.4
        wallpaper: 'aurora',
        customWallpaper: '',      // localStorage 里的键名，图片本身不写进设置
        scale: 1,
        fontSize: 1,
        pos: { x: null, y: null },
        collapsed: false,
        lastApp: 'home',
        haptics: true,
        island: true,
        sound: false,
        hideFab: false,
        apps: ['plot', 'spark'],  // 已安装的商店应用 id
        perf: 'auto',             // auto | lite | full
        autoOpen: false,          // 打开酒馆时是否自动弹出手机
        home: { order: [], folders: [] },
        image: { enabled: false, provider: 'openai', endpoint: '', apiKey: '', model: 'gpt-image-1', size: '1024x1024' },
        inject: { enabled: true, depth: 2 },
        proactive: { enabled: false, cooldown: 120, perHour: 4, rounds: 1 },
        tts: { enabled: false, auto: false, rate: 1, voice: '' },
        aiApp: { provider: 'inherit', baseUrl: '', apiKey: '', model: '' },
        ai: {
            useMain: true, baseUrl: '', apiKey: '', model: '', commentStyle: '真实网友', length: 320, style: DEFAULT_STYLE },
        replyInGroup: true,
        showSpoilers: false,
        signature: '把手机放进剧情里',
        firstRun: true,
        installId: '',
    };
}

const isObject = v => v && typeof v === 'object' && !Array.isArray(v);

function cloneValue(value) {
    try {
        if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
    } catch { /* ignore */ }
    return JSON.parse(JSON.stringify(value));
}

function mergeDefaults(base, value) {
    if (!isObject(value)) return cloneValue(base);
    const out = cloneValue(base);
    for (const key of Object.keys(value)) {
        if (isObject(base?.[key]) && isObject(value[key])) out[key] = mergeDefaults(base[key], value[key]);
        else if (value[key] !== undefined) out[key] = value[key];
    }
    return out;
}

export function normalizeSettings(raw) {
    const s = mergeDefaults(defaultSettings(), raw || {});
    if (!ACCENTS[s.accent]) s.accent = 'amber';
    if (!WALLPAPERS[s.wallpaper]) s.wallpaper = 'aurora';
    if (!['auto', 'dark', 'light'].includes(s.theme)) s.theme = 'auto';
    s.scale = clamp(Number(s.scale) || 1, 0.7, 1.35);
    s.fontSize = clamp(Number(s.fontSize) || 1, 0.85, 1.2);
    s.glass = clamp(Number(s.glass) || 0, 0, 1.4);
    s.inject.depth = clamp(Math.round(Number(s.inject.depth) || 0), 0, 20);
    s.proactive.cooldown = clamp(Math.round(Number(s.proactive.cooldown) || 0), 30, 3600);
    s.proactive.perHour = clamp(Math.round(Number(s.proactive.perHour) || 0), 1, 20);
    s.proactive.rounds = clamp(Math.round(Number(s.proactive.rounds) || 1), 1, 20);
    s.tts = s.tts && typeof s.tts === 'object' ? s.tts : { enabled: false, auto: false, rate: 1, voice: '' };
    s.tts.rate = Math.max(0.5, Math.min(2, Number(s.tts.rate) || 1));
    s.tts.voice = String(s.tts.voice || '').slice(0, 80);
    s.aiApp = s.aiApp && typeof s.aiApp === 'object' ? s.aiApp : { provider: 'inherit', baseUrl: '', apiKey: '', model: '' };
    s.aiApp.provider = String(s.aiApp.provider || 'inherit').slice(0, 20);
    s.aiApp.baseUrl = String(s.aiApp.baseUrl || '').slice(0, 200);
    s.aiApp.apiKey = String(s.aiApp.apiKey || '').slice(0, 300);
    s.aiApp.model = String(s.aiApp.model || '').slice(0, 80);
    s.ai.length = clamp(Math.round(Number(s.ai.length) || 320), 120, 1200);
    if (typeof s.ai.style !== 'string' || !s.ai.style.trim()) s.ai.style = DEFAULT_STYLE;
    s.ai.style = s.ai.style.slice(0, 4000);
    if (!s.installId) s.installId = uid();
    s.pos = { x: Number.isFinite(s.pos?.x) ? s.pos.x : null, y: Number.isFinite(s.pos?.y) ? s.pos.y : null };
    return s;
}

export function loadSettings() {
    const c = ctx();
    if (!c?.extensionSettings) return normalizeSettings(stash.settings);
    if (!c.extensionSettings[SETTINGS_KEY] || !isObject(c.extensionSettings[SETTINGS_KEY])) {
        c.extensionSettings[SETTINGS_KEY] = defaultSettings();
    }
    const settings = normalizeSettings(c.extensionSettings[SETTINGS_KEY]);
    // 写回补齐后的结构，方便用户在设置文件里直接改
    c.extensionSettings[SETTINGS_KEY] = settings;
    stash.settings = settings;
    return settings;
}

export function saveSettings(settings) {
    stash.settings = settings;
    const c = ctx();
    if (c?.extensionSettings) c.extensionSettings[SETTINGS_KEY] = settings;
    saveGlobalSettings();
    emit('settings');
}

/* ---------------------------------- 数据 ---------------------------------- */

export function defaultData() {
    return {
        v: DATA_VERSION,
        /** 这个世界里的人：从角色卡里抽出来，或手动添加 */
        world: { cast: [], extractedAt: 0 },
        /** 剧情推进的历史 */
        plot: { history: [] },
        /** 交友：候选人、进行中的约会 */
        spark: { candidates: [], matches: [] },
        /** 浏览器：最近访问 */
        browser: { last: null, history: [] },
        /** 地图：去过的地方 */
        maps: { visited: [], last: '' },
        /** 股市 */
        stocks: { companies: [], holdings: {}, cash: 100000, lastTick: 0 },
        /** 各应用缓存的内容：{ [appId]: { items: [], at: 0 } } */
        feeds: {},
        threads: [],
        moments: [],
        notes: [],
        photos: [],
        meta: { city: '', createdAt: Date.now(), touchedAt: Date.now() },
    };
}

export function loadData() {
    const c = ctx();
    const store = c?.chatMetadata;
    if (!store) return normalizeData(stash.data || defaultData());
    if (!isObject(store[DATA_KEY])) store[DATA_KEY] = defaultData();
    store[DATA_KEY] = normalizeData(store[DATA_KEY]);
    stash.data = store[DATA_KEY];
    return store[DATA_KEY];
}

export function saveData(data) {
    stash.data = data;
    const c = ctx();
    if (c?.chatMetadata) c.chatMetadata[DATA_KEY] = data;
    try {
        if (typeof c?.saveMetadataDebounced === 'function') c.saveMetadataDebounced();
        else if (typeof c?.saveMetadata === 'function') c.saveMetadata();
        else saveChatMetadata();
    } catch (error) {
        console.warn('[幻镜手机] 保存失败', error);
    }
    emit('data');
}

export function normalizeData(raw) {
    const data = defaultData();
    if (!isObject(raw)) return data;
    data.meta = { ...data.meta, ...(isObject(raw.meta) ? raw.meta : {}) };
    data.world = {
        cast: (Array.isArray(raw.world?.cast) ? raw.world.cast : []).slice(0, 16).map(normalizePerson).filter(Boolean),
        extractedAt: Number(raw.world?.extractedAt) || 0,
    };
    data.plot = {
        history: (Array.isArray(raw.plot?.history) ? raw.plot.history : []).slice(0, 20).map(item => ({
            id: String(item?.id || uid()),
            tone: String(item?.tone || 'ordinary').slice(0, 12),
            title: String(item?.title || '').slice(0, 80),
            scene: String(item?.scene || '').slice(0, 600),
            hook: String(item?.hook || '').slice(0, 400),
            twist: String(item?.twist || '').slice(0, 60),
            options: (Array.isArray(item?.options) ? item.options : []).slice(0, 4).map(String),
            ts: Number(item?.ts) || Date.now(),
        })),
    };
    data.spark = {
        candidates: (Array.isArray(raw.spark?.candidates) ? raw.spark.candidates : []).slice(0, 6).map(item => ({
            id: String(item?.id || uid()),
            name: String(item?.name || '某人').slice(0, 24),
            age: String(item?.age || '').slice(0, 8),
            job: String(item?.job || '').slice(0, 40),
            tags: (Array.isArray(item?.tags) ? item.tags : []).slice(0, 5).map(String),
            bio: String(item?.bio || '').slice(0, 300),
            opening: String(item?.opening || '').slice(0, 200),
            tone: String(item?.tone || 'warm'),
        })),
        matches: (Array.isArray(raw.spark?.matches) ? raw.spark.matches : []).slice(0, 6).map(item => ({
            id: String(item?.id || uid()),
            name: String(item?.name || '某人').slice(0, 24),
            stage: String(item?.stage || '刚认识').slice(0, 12),
            dates: (Array.isArray(item?.dates) ? item.dates : []).slice(-6).map(date => ({
                id: String(date?.id || uid()),
                title: String(date?.title || '一次见面').slice(0, 60),
                text: String(date?.text || '').slice(0, 800),
                ts: Number(date?.ts) || Date.now(),
            })),
            ts: Number(item?.ts) || Date.now(),
        })),
    };
    data.comments = raw.comments && typeof raw.comments === 'object' ? raw.comments : {};
    data.stocks = {
        companies: (Array.isArray(raw.stocks?.companies) ? raw.stocks.companies : []).slice(0, 60).map(item => ({
            name: String(item?.name || '').slice(0, 20),
            code: String(item?.code || '').slice(0, 12),
            sector: String(item?.sector || '其他').slice(0, 10),
            price: Math.max(0.5, Number(item?.price) || 10),
            prev: Math.max(0.5, Number(item?.prev) || Number(item?.price) || 10),
            desc: String(item?.desc || '').slice(0, 200),
        })).filter(item => item.name),
        holdings: raw.stocks?.holdings && typeof raw.stocks.holdings === 'object' ? raw.stocks.holdings : {},
        cash: Math.max(0, Number(raw.stocks?.cash) || 100000),
        lastTick: Number(raw.stocks?.lastTick) || 0,
    };
    data.maps = {
        visited: (Array.isArray(raw.maps?.visited) ? raw.maps.visited : []).slice(-20).map(String),
        last: String(raw.maps?.last || '').slice(0, 40),
    };
    data.browser = {
        last: raw.browser?.last && typeof raw.browser.last === 'object' ? raw.browser.last : null,
        history: (Array.isArray(raw.browser?.history) ? raw.browser.history : []).slice(-10).map(String),
    };
    data.feeds = {};
    if (isObject(raw.feeds)) {
        for (const [appId, feed] of Object.entries(raw.feeds)) {
            if (!Array.isArray(feed?.items)) continue;
            data.feeds[appId] = { items: feed.items.slice(0, 40), at: Number(feed.at) || 0 };
        }
    }
    data.threads = (Array.isArray(raw.threads) ? raw.threads : []).slice(0, LIMITS.threads).map(normalizeThread).filter(Boolean);
    data.moments = (Array.isArray(raw.moments) ? raw.moments : []).slice(0, LIMITS.moments).map(normalizeMoment).filter(Boolean);
    data.notes = (Array.isArray(raw.notes) ? raw.notes : []).slice(0, LIMITS.notes).map(n => ({
        id: String(n?.id || uid()),
        text: String(n?.text || '').slice(0, 4000),
        ts: Number(n?.ts) || Date.now(),
        pinned: !!n?.pinned,
    })).filter(n => n.text.trim());
    data.photos = (Array.isArray(raw.photos) ? raw.photos : []).slice(0, LIMITS.photos).map(p => ({
        id: String(p?.id || uid()),
        url: String(p?.url || ''),
        cap: String(p?.cap || '').slice(0, 200),
        ts: Number(p?.ts) || Date.now(),
    })).filter(p => p.url && !p.url.startsWith('data:'));
    return data;
}

export function normalizePerson(person) {
    if (!isObject(person)) return null;
    const name = String(person.name || '').trim().slice(0, 40);
    if (!name) return null;
    return {
        id: String(person.id || uid()),
        name,
        role: String(person.role || '').slice(0, 80),
        relation: String(person.relation || '').slice(0, 120),
        desc: String(person.desc || person.persona || '').slice(0, 800),
        style: String(person.style || '').slice(0, 300),
    };
}

export function normalizeThread(t) {
    if (!isObject(t)) return null;
    const members = (Array.isArray(t.members) ? t.members : [t.name]).map(m => String(m || '').trim()).filter(Boolean).slice(0, 12);
    if (!members.length) return null;
    const msgs = (Array.isArray(t.msgs) ? t.msgs : []).slice(-LIMITS.messages).map(m => ({
        id: String(m?.id || uid()),
        from: m?.from === 'me' ? 'me' : (m?.from === 'sys' ? 'sys' : 'them'),
        sender: String(m?.sender || (m?.from === 'me' ? '' : members[0])).slice(0, 40),
        type: ['text', 'voice', 'photo', 'redpacket', 'transfer', 'location', 'sticker', 'call', 'sys'].includes(m?.type) ? m.type : 'text',
        text: String(m?.text || '').slice(0, 2000),
        meta: isObject(m?.meta) ? m.meta : {},
        ts: Number(m?.ts) || Date.now(),
        state: m?.state === 'failed' ? 'failed' : 'ok',
    }));
    return {
        id: String(t.id || uid()),
        name: String(t.name || members.join('、')).slice(0, 60),
        kind: t.kind === 'group' || members.length > 1 ? 'group' : 'dm',
        members,
        msgs,
        unread: Math.max(0, Math.round(Number(t.unread) || 0)),
        pinned: !!t.pinned,
        muted: !!t.muted,
        draft: String(t.draft || '').slice(0, 2000),
        created: Number(t.created) || Date.now(),
        updated: Number(t.updated) || Number(msgs[msgs.length - 1]?.ts) || Date.now(),
        note: String(t.note || '').slice(0, 500),
    };
}

export function normalizeMoment(m) {
    if (!isObject(m) || !String(m.text || '').trim()) return null;
    return {
        id: String(m.id || uid()),
        author: String(m.author || '某人').slice(0, 40),
        text: String(m.text).slice(0, 1200),
        ts: Number(m.ts) || Date.now(),
        mine: !!m.mine,
        likes: [...new Set((Array.isArray(m.likes) ? m.likes : []).map(String).filter(Boolean))].slice(0, 30),
        comments: (Array.isArray(m.comments) ? m.comments : []).slice(0, 30).map(c => ({
            id: String(c?.id || uid()),
            by: String(c?.by || '某人').slice(0, 40),
            text: String(c?.text || '').slice(0, 400),
            ts: Number(c?.ts) || Date.now(),
        })).filter(c => c.text.trim()),
    };
}

/* --------------------------------- 小工具 --------------------------------- */

export function uid() {
    try {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    } catch { /* ignore */ }
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

export function threadTitle(thread) {
    if (!thread) return '';
    return thread.name || thread.members.join('、');
}

export function lastMessage(thread) {
    return thread?.msgs?.[thread.msgs.length - 1] || null;
}

export function previewOf(message) {
    if (!message) return '还没有消息';
    if (message.from === 'sys') return message.text;
    if (message.type === 'voice') return '[语音]';
    if (message.type === 'photo') return '[图片]';
    if (message.type === 'sticker') return '[表情]';
    if (message.type === 'redpacket') return '[红包] ' + (message.text || '');
    if (message.type === 'transfer') return '[转账] ' + (message.text || '');
    if (message.type === 'location') return '[位置] ' + (message.text || '');
    if (message.type === 'call') return '[通话] ' + (message.text || '');
    return message.text;
}

export function totalUnread(data) {
    return (data?.threads || []).reduce((sum, t) => sum + (t.muted ? 0 : t.unread || 0), 0);
}

/* -------------------------------- 变更广播 -------------------------------- */

const listeners = new Set();

export function emit(kind) {
    for (const fn of [...listeners]) {
        try { fn(kind); } catch (error) { console.warn('[幻镜手机] 监听器出错', error); }
    }
}

export function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

const stash = { settings: null, data: null };