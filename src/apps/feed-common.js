/**
 * 内容类 App 的公共部分：拿缓存、兜底内容、刷新、数字格式化。
 */
import { toast } from '../render.js';
import { getFeed, getData, saveNow } from '../store.js';
import { FEEDS } from '../feed.js';
import { generateFeed, friendlyError } from '../ai.js';
import { userName, currentCharacter, storyContext, memoryContext } from '../st.js';

export function feedContext() {
    const data = getData();
    return {
        world: currentCharacter()?.name || '',
        people: (data.world?.cast || []).map(person => person.name),
        user: userName(),
        story: storyContext(80, 340),
        memory: memoryContext(12),
    };
}

export function fallbackFor(appId) {
    const config = FEEDS[appId];
    return config ? config.fallback(feedContext()) : null;
}

/**
 * 有缓存用缓存；没有就先用兜底内容垫着，再在后台让模型生成。
 * onUpdate(items) 会被调用两次（兜底 / 真实内容）。
 */
export function loadFeed(appId, onUpdate, onLoading) {
    const cached = getFeed(appId);
    if (cached?.items) {
        onUpdate(cached.items);
        return cached.items;
    }
    const fallback = fallbackFor(appId);
    onUpdate(fallback);
    onLoading(true);
    generateFeed(appId)
        .then(items => onUpdate(items))
        .catch(error => toast(friendlyError(error), 3200))
        .finally(() => onLoading(false));
    return fallback;
}

function jitter(value) {
    if (Array.isArray(value)) {
        const list = value.map(jitter);
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, item] of Object.entries(value)) {
            if (typeof item === 'number' && /likes|comments|reposts|collects|views|heat|replies/i.test(key)) {
                out[key] = Math.max(0, item + Math.floor(Math.random() * 40));
            } else out[key] = jitter(item);
        }
        return out;
    }
    return value;
}

/** 列表滚到底就自动再拉一批（不用每次点刷新按钮）。 */
export function bindAutoMore(el, loadMore, gap = 8000) {
    if (!el || typeof loadMore !== 'function') return;
    let last = 0;
    let busy = false;
    el.addEventListener('scroll', () => {
        if (busy) return;
        if (Date.now() - last < gap) return;
        if (el.scrollTop + el.clientHeight < el.scrollHeight - 180) return;
        busy = true;
        last = Date.now();
        try { loadMore(); } catch { /* ignore */ }
        setTimeout(() => { busy = false; }, 1500);
    }, { passive: true });
}

/** 把新一批接到旧的前面/后面：同 id（或同标题）的不重复，旧的永远保留。 */
function mergeLists(prev, next) {
    const old = Array.isArray(prev) ? prev : [];
    const fresh = Array.isArray(next) ? next : [];
    const seen = new Set(old.map(item => item && (item.id || item.title || item.text)));
    const added = fresh.filter(item => {
        const key = item && (item.id || item.title || item.text);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    // 新的接在后面，旧的保留；最多留 120 条免得越滚越卡
    // 不设条数上限：旧的全部保留，新的接在后面
    return [...old, ...added];
}

function persistFeed(appId, items) {
    try {
        const data = getData();
        data.feeds = data.feeds && typeof data.feeds === 'object' ? data.feeds : {};
        data.feeds[appId] = { items: Array.isArray(items) ? items.slice(-500) : [], at: Date.now() };
        saveNow('data');
    } catch { /* ignore */ }
}

export function refreshFeed(appId, onUpdate, onLoading) {
    onLoading(true);
    toast('正在刷新…');
    const prev = getFeed(appId)?.items || [];
    generateFeed(appId)
        .then(items => {
            // 追加，不覆盖：原来滚动出来的帖子一条都不删
            const merged = mergeLists(prev, items);
            persistFeed(appId, merged);
            onUpdate(merged);
            toast('又来了 ' + Math.max(0, merged.length - prev.length) + ' 条');
        })
        .catch(error => {
            const fallback = fallbackFor(appId);
            if (fallback) {
                const merged = mergeLists(prev, jitter(fallback));
                persistFeed(appId, merged);
                onUpdate(merged);
                toast('AI 这次没返回，先补几条本地内容', 2600);
            } else {
                toast(friendlyError(error), 3200);
            }
        })
        .finally(() => onLoading(false));
}

export function num(value) {
    const n = Math.max(0, Number(value) || 0);
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return String(Math.round(n));
}

export function moodOf(item) {
    const allowed = ['warm', 'cold', 'night', 'neon', 'street'];
    return allowed.includes(item?.mood) ? item.mood : 'night';
}