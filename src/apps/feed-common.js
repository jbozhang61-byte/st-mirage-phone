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

    /** 底部浮出「正在加载更多…」，等列表真的变了（或超时）再收起来。 */
    function showLoading() {
        const pill = showPill('正在加载更多…', { spinner: true, timeout: 12000 });
        let mo = null;
        const hide = () => { try { mo?.disconnect(); } catch { /* ignore */ } pill.close(); };
        try {
            mo = new MutationObserver(() => setTimeout(hide, 350));
            mo.observe(el, { childList: true });
        } catch { /* ignore */ }
        return hide;
    }

    el.addEventListener('scroll', () => {
        if (busy) return;
        if (Date.now() - last < gap) return;
        if (el.scrollTop + el.clientHeight < el.scrollHeight - 180) return;
        busy = true;
        last = Date.now();
        const hide = showLoading();
        try { loadMore(); } catch { hide(); }
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
            // 生成过程里 generateFeed 自己会 setFeed(新的一批)，把旧帖盖掉；
            // 所以这里要 "生成前拿到的 prev" + "现在缓存里的" + "返回的 items" 三者合并
            const latest = getFeed(appId)?.items || [];
            const base = mergeLists(prev, latest);
            const merged = mergeLists(base, items);
            if (!merged.length) { toast('这次没拿到新内容'); return; }
            persistFeed(appId, merged);
            onUpdate(merged);
            const before = Array.isArray(prev) ? prev : [];
            showPill('又来了 ' + Math.max(0, merged.length - before.length) + ' 条', {
                timeout: 6000,
                action: {
                    text: '撤销',
                    onClick: () => {
                        // 撤销：把列表退回加载前的那一版
                        persistFeed(appId, before);
                        onUpdate(before.slice());
                        toast('已撤销这批');
                    },
                },
            });
        })
        .catch(error => {
            const fallback = fallbackFor(appId);
            const latest = getFeed(appId)?.items || prev;
            if (fallback) {
                const merged = mergeLists(latest, jitter(fallback));
                if (merged.length) {
                    persistFeed(appId, merged);
                    onUpdate(merged);
                }
                toast('AI 这次没返回，先补几条本地内容', 2600);
            } else {
                // 没有兜底就保持现状：绝不把已有列表刷成空
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