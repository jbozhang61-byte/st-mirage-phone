/**
 * 当前聊天的小手机数据 + 全局设置。
 * 所有写入都经过这里，统一节流保存、统一广播。
 */
import {
    defaultData, defaultSettings, loadData, loadSettings, saveData, saveSettings,
    normalizeData, normalizeThread, normalizeMoment, normalizePerson, uid, LIMITS, emit, onChange,
} from './state.js';
import { characterAvatar } from './st.js';

const store = {
    data: defaultData(),
    settings: defaultSettings(),
    saveTimer: 0,
    ready: false,
};

export function initStore() {
    store.settings = loadSettings();
    store.data = loadData();
    store.ready = true;
    emit('init');
    return store;
}

export function getSettings() {
    return store.settings;
}

export function getData() {
    return store.data;
}

export function isReady() {
    return store.ready;
}

/** 合并设置。deep 只处理一层。 */
export function setSettings(patch, { save = true } = {}) {
    Object.assign(store.settings, patch || {});
    if (save) saveNow('settings');
}

export function patchSettings(path, value) {
    const parts = String(path).split('.');
    let target = store.settings;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]] || typeof target[parts[i]] !== 'object') target[parts[i]] = {};
        target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;
    saveNow('settings');
}

/** 改数据：fn 里直接改，改完自动保存。 */
export function mutate(fn, { save = true } = {}) {
    const result = fn(store.data);
    if (save) saveNow('data');
    return result;
}

export function saveNow(kind = 'data') {
    if (kind === 'settings') {
        saveSettings(store.settings);
        return;
    }
    clearTimeout(store.saveTimer);
    store.saveTimer = setTimeout(() => {
        saveData(store.data);
    }, 260);
    emit('data:dirty');
}

export function replaceData(next) {
    store.data = normalizeData(next);
    saveNow('data');
    emit('data');
    return store.data;
}

export function resetData() {
    return replaceData(defaultData());
}

/**
 * 自己的「心」资料（颜值/性格/家世，以及作弊出来的攻略力）。
 * 存在全局设置里——换聊天、换角色卡都不会被清空。
 * 以前的版本存在 data 里，这里顺手迁移一次。
 */
export function getSelfProfile() {
    const settings = store.settings;
    if (!settings.heartSelf || typeof settings.heartSelf !== 'object') {
        const legacy = store.data && store.data.heartSelf;
        settings.heartSelf = legacy && typeof legacy === 'object' ? { ...legacy } : {};
        saveNow('settings');
    }
    return settings.heartSelf;
}

export function saveSelfProfile(profile) {
    store.settings.heartSelf = profile && typeof profile === 'object' ? profile : {};
    saveNow('settings');
    return store.settings.heartSelf;
}

export function flushSave() {
    clearTimeout(store.saveTimer);
    saveData(store.data);
}

/* ------------------------------- 业务小工具 ------------------------------- */

export function findThread(id) {
    return store.data.threads.find(t => t.id === id) || null;
}

export function threadByName(members) {
    const key = members.join('\u0001');
    return store.data.threads.find(t => [...t.members].sort().join('\u0001') === [...members].sort().join('\u0001')) || null;
}

export function ensureThread(members, { name = '', kind = 'dm', note = '' } = {}) {
    const clean = members.map(m => String(m || '').trim()).filter(Boolean);
    if (!clean.length) return null;
    const existing = threadByName(clean);
    if (existing) return existing;
    const thread = normalizeThread({
        id: uid(),
        name: name || (clean.length > 1 ? clean.slice(0, 2).join('、') : clean[0]),
        kind: clean.length > 1 ? 'group' : kind,
        members: clean,
        note,
        msgs: [],
        created: Date.now(),
        updated: Date.now(),
    });
    store.data.threads.unshift(thread);
    store.data.threads = store.data.threads.slice(0, LIMITS.threads);
    saveNow('data');
    return thread;
}

export function appendMessages(threadId, messages, { unread = false } = {}) {
    const thread = findThread(threadId);
    if (!thread) return [];
    const list = (Array.isArray(messages) ? messages : [messages]).filter(Boolean);
    for (const msg of list) {
        thread.msgs.push({
            id: msg.id || uid(),
            from: msg.from || 'them',
            sender: msg.sender || (msg.from === 'me' ? '' : thread.members[0]),
            type: msg.type || 'text',
            text: String(msg.text || ''),
            meta: msg.meta || {},
            ts: Number(msg.ts) || Date.now(),
            state: msg.state || 'ok',
        });
    }
    if (thread.msgs.length > LIMITS.messages) thread.msgs = thread.msgs.slice(-LIMITS.messages);
    thread.updated = Date.now();
    if (unread) thread.unread = Math.min(99, (thread.unread || 0) + list.filter(m => m.from === 'them').length);
    saveNow('data');
    return thread.msgs.slice(-list.length);
}

export function markRead(threadId) {
    const thread = findThread(threadId);
    if (!thread || !thread.unread) return;
    thread.unread = 0;
    saveNow('data');
    emit('badges');
}

export function removeThread(threadId) {
    store.data.threads = store.data.threads.filter(t => t.id !== threadId);
    saveNow('data');
}

export function addMoment({ author, text, mine = false, likes = [], comments = [] }) {
    const moment = normalizeMoment({ id: uid(), author, text, mine, likes, comments, ts: Date.now() });
    if (!moment) return null;
    store.data.moments.unshift(moment);
    store.data.moments = store.data.moments.slice(0, LIMITS.moments);
    saveNow('data');
    return moment;
}

export function addNote(text, { pinned = false } = {}) {
    const body = String(text || '').trim();
    if (!body) return null;
    const note = { id: uid(), text: body.slice(0, 4000), ts: Date.now(), pinned: !!pinned };
    store.data.notes.unshift(note);
    store.data.notes = store.data.notes.slice(0, LIMITS.notes);
    saveNow('data');
    return note;
}

export function removeNote(id) {
    store.data.notes = store.data.notes.filter(n => n.id !== id);
    saveNow('data');
}

export function addPhoto(url, cap = '') {
    if (!url) return;
    if (store.data.photos.some(p => p.url === url)) return;
    store.data.photos.unshift({ id: uid(), url, cap: String(cap).slice(0, 200), ts: Date.now() });
    store.data.photos = store.data.photos.slice(0, LIMITS.photos);
    saveNow('data');
}

export function removePhoto(id) {
    store.data.photos = store.data.photos.filter(p => p.id !== id);
    saveNow('data');
}

/* ------------------------------- 世界里的人 ------------------------------- */

export function getCast() {
    return store.data.world?.cast || [];
}

export function setCast(peopleList, { extracted = false } = {}) {
    const clean = [];
    const seen = new Set();
    for (const person of peopleList || []) {
        const normalized = normalizePerson(person);
        if (!normalized || seen.has(normalized.name)) continue;
        seen.add(normalized.name);
        clean.push(normalized);
    }
    store.data.world = { cast: clean.slice(0, 16), extractedAt: extracted ? Date.now() : (store.data.world?.extractedAt || 0) };
    saveNow('data');
    return clean;
}

export function upsertPerson(person) {
    const normalized = normalizePerson(person);
    if (!normalized) return null;
    const cast = getCast().filter(p => p.name !== normalized.name);
    cast.unshift(normalized);
    setCast(cast);
    return normalized;
}

export function removePerson(name) {
    setCast(getCast().filter(p => p.name !== name));
}

export function findPerson(name) {
    const key = String(name || '').trim();
    if (!key) return null;
    return getCast().find(p => p.name === key)
        || getCast().find(p => p.name.toLowerCase() === key.toLowerCase())
        || null;
}

/* --------------------------------- 应用内容 --------------------------------- */

export function getFeed(appId) {
    return store.data.feeds?.[appId] || null;
}

export function setFeed(appId, items) {
    if (!store.data.feeds) store.data.feeds = {};
    // 列表型应用（朋友圈、贴吧、社交 App）存成 { items: [...] }；
    // Discord / Telegram / Gmail 这类存的是整个对象（{servers}/{chats}/{emails}），
    // 直接 .slice 会抛 "(items || []).slice is not a function"，所以分开处理。
    if (Array.isArray(items)) {
        store.data.feeds[appId] = { items: items.slice(0, 40), at: Date.now() };
    } else if (items && typeof items === 'object') {
        store.data.feeds[appId] = { ...items, at: Date.now() };
    } else {
        store.data.feeds[appId] = { items: [], at: Date.now() };
    }
    saveNow('data');
}

export function installedApps() {
    return Array.isArray(store.settings.apps) ? store.settings.apps : [];
}

export function isAppInstalled(appId) {
    return installedApps().includes(appId);
}

export function installApp(appId) {
    if (isAppInstalled(appId)) return;
    store.settings.apps = [...installedApps(), appId];
    saveNow('settings');
}

export function uninstallApp(appId) {
    store.settings.apps = installedApps().filter(id => id !== appId);
    saveNow('settings');
}

export function threadAvatar(thread) {
    if (!thread) return '';
    return characterAvatar(thread.members[0]);
}

export { onChange, emit, normalizeData, uid };