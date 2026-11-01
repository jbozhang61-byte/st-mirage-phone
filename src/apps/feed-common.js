/**
 * 内容类 App 的公共部分：拿缓存、兜底内容、刷新、数字格式化。
 */
import { toast, h } from '../render.js';
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

/**
 * 底部浮出的胶囊提示。opts: { spinner, action: { text, onClick }, timeout }
 * 返回 { close }。
 */
export function showPill(text, opts = {}) {
    const host = document.querySelector('.mp-screen') || document.body;
    const pill = h('div', { class: 'mp-more-pill' });
    if (opts.spinner) pill.appendChild(h('span', { class: 'mp-more-spin' }));
    pill.appendChild(h('span', { text }));
    if (opts.action) {
        pill.appendChild(h('button', {
            type: 'button', class: 'mp-more-act', text: opts.action.text,
            onclick: event => {
                event.stopPropagation();
                close();
                try { opts.action.onClick?.(); } catch { /* ignore */ }
            },
        }));
    }
    host.appendChild(pill);
    requestAnimationFrame(() => pill.classList.add('in'));
    let done = false;
    let timer = 0;
    const close = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        pill.classList.remove('in');
        setTimeout(() => pill.remove(), 240);
    };
    if (opts.timeout !== 0) timer = setTimeout(close, opts.timeout || 6000);
    return { close, el: pill };
}

/** 列表滚到底就自动再拉一批（不用每次点刷新按钮）。 */
export function bindAutoMore(el, loadMore, gap = 8000) {
    if (!el || typeof loadMore !== 'function') return;
    let last = 0;
    let busy = false;

    let armed = false;
    el.addEventListener('scroll', () => {
        if (busy) return;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
        if (!atBottom) { armed = false; return; }     // 没贴底就复位
        if (!armed) { armed = true; return; }          // 贴底的第一下只是"就位"
        if (Date.now() - last < gap) return;           // 冷却，别一滑就刷
        busy = true;
        armed = false;
        last = Date.now();
        try { loadMore(); } catch { /* ignore */ }
        setTimeout(() => { busy = false; }, 1500);
    }, { passive: true });
}

/** 把新一批接到旧的前面/后面：同 id（或同标题）的不重复，旧的永远保留。 */
function mergeArrays(prev, next) {
    const old = Array.isArray(prev) ? prev : [];
    const fresh = Array.isArray(next) ? next : [];
    const seen = new Set(old.map(item => item && (item.id || item.title || item.text)));
    const added = fresh.filter(item => {
        const key = item && (item.id || item.title || item.text);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return [...old, ...added];
}

/**
 * 兼容两种 feed 形状：
 *  - 数组（X / 抖音 / 贴吧…）
 *  - 对象（微博是 {hot, posts}）
 * 以前只认数组，对象型 feed 每次都变成"空 + 新的一批"，看起来就是覆盖。
 */
function mergeLists(prev, next) {
    const isObj = value => value && typeof value === 'object' && !Array.isArray(value);
    if (isObj(prev) && isObj(next)) {
        const out = { ...next };
        for (const key of ['posts', 'items', 'hot']) {
            if (Array.isArray(prev[key]) || Array.isArray(next[key])) {
                out[key] = mergeArrays(prev[key] || [], next[key] || []);
            }
        }
        return out;
    }
    return mergeArrays(prev, next);
}

function persistFeed(appId, items) {
    try {
        const data = getData();
        data.feeds = data.feeds && typeof data.feeds === 'object' ? data.feeds : {};
        // 对象型 feed（微博）原样存，数组型存最近 500 条
        const isObj = items && typeof items === 'object' && !Array.isArray(items);
        data.feeds[appId] = { items: isObj ? items : (Array.isArray(items) ? items.slice(-500) : []), at: Date.now() };
        saveNow('data');
    } catch { /* ignore */ }
}

/** 数组型返回 length，对象型返回 posts/items 的条数。 */
function countOf(value) {
    if (Array.isArray(value)) return value.length;
    if (!value || typeof value !== 'object') return 0;
    for (const key of ['posts', 'items', 'hot']) if (Array.isArray(value[key])) return value[key].length;
    return 0;
}

export function refreshFeed(appId, onUpdate, onLoading) {
    onLoading(true);
    let cancelled = false;
    const pill = showPill('正在加载更多…', {
        spinner: true,
        timeout: 15000,
        action: { text: '取消', onClick: () => { cancelled = true; toast('已取消这次加载'); } },
    });
    const prev = getFeed(appId)?.items || [];
    generateFeed(appId)
        .then(items => {
            if (cancelled) return;
            // 生成过程里 generateFeed 自己会 setFeed(新的一批)，把旧帖盖掉；
            // 所以这里要 "生成前拿到的 prev" + "现在缓存里的" + "返回的 items" 三者合并
            const latest = getFeed(appId)?.items || [];
            const base = mergeLists(prev, latest);
            const merged = mergeLists(base, items);
            if (!countOf(merged)) { toast('这次没拿到新内容'); return; }
            persistFeed(appId, merged);
            onUpdate(merged);
            const before = prev;
            showPill('又来了 ' + Math.max(0, countOf(merged) - countOf(before)) + ' 条', {
                timeout: 6000,
                action: {
                    text: '撤销',
                    onClick: () => {
                        // 撤销：把列表退回加载前的那一版
                        persistFeed(appId, before);
                        onUpdate(before);
                        toast('已撤销这批');
                    },
                },
            });
        })
        .catch(error => {
            if (cancelled) return;
            const fallback = fallbackFor(appId);
            const latest = getFeed(appId)?.items || prev;
            if (fallback) {
                const merged = mergeLists(latest, jitter(fallback));
                if (countOf(merged)) {
                    persistFeed(appId, merged);
                    onUpdate(merged);
                }
                toast('AI 这次没返回，先补几条本地内容', 2600);
            } else {
                // 没有兜底就保持现状：绝不把已有列表刷成空
                toast(friendlyError(error), 3200);
            }
        })
        .finally(() => {
            try { pill.close(); } catch { /* ignore */ }
            onLoading(false);
        });
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