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
    // 传进来的可能只是内容容器，真正的滚动层在上面几层
    try {
        let node = el;
        for (let depth = 0; depth < 4 && node; depth += 1) {
            const style = getComputedStyle(node);
            const scrollable = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4;
            if (scrollable) break;
            node = node.parentElement;
        }
        const shared = n => n.matches?.('.mp-screen, body, html, .mp-root, .mp-view, .mp-shell, .mp-device');
        if (node && node !== el && !shared(node)) el = node;
    } catch { /* ignore */ }
    let last = 0;
    let busy = false;

    const THRESHOLD = 110;          // 到底之后还要再"拉"这么多像素
    let pull = 0;
    let touchY = null;

    const atBottom = () => el.scrollTop + el.clientHeight >= el.scrollHeight - 24;

    /** 列表必须还在手机上、还看得见，否则不触发（退出应用后不能继续刷）。 */
    const visible = () => {
        try {
            if (!el.isConnected) return false;
            if (!el.closest('.mp-screen')) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width < 8 || rect.height < 8) return false;
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            // 被 is-closing / 隐藏的应用
            if (el.closest('.is-closing, [hidden], .mp-app--hidden')) return false;
            return true;
        } catch { return false; }
    };

    const fire = () => {
        if (busy) return;
        if (!visible()) { pull = 0; return; }
        if (Date.now() - last < gap) return;
        busy = true;
        pull = 0;
        last = Date.now();
        try { loadMore(); } catch { /* ignore */ }
        setTimeout(() => { busy = false; }, 1500);
    };

    // 滚轮 / 触控板
    el.addEventListener('wheel', event => {
        if (!visible()) { pull = 0; return; }
        if (!atBottom()) { pull = 0; return; }
        if (event.deltaY > 0) pull += event.deltaY;
        else pull = Math.max(0, pull + event.deltaY);
        if (pull >= THRESHOLD) fire();
    }, { passive: true });

    // 手指
    el.addEventListener('touchstart', event => {
        touchY = event.touches?.[0]?.clientY ?? null;
        pull = 0;
    }, { passive: true });
    el.addEventListener('touchmove', event => {
        const y = event.touches?.[0]?.clientY;
        if (touchY == null || typeof y !== 'number') return;
        const dy = touchY - y;     // 手指往上推 = 内容往下滚
        touchY = y;
        if (!visible()) { pull = 0; return; }
        if (!atBottom()) { pull = 0; return; }
        if (dy > 0) pull += dy;
        else pull = Math.max(0, pull + dy);
        if (pull >= THRESHOLD) fire();
    }, { passive: true });

    // 离开底部就清零
    el.addEventListener('scroll', () => { if (!atBottom()) pull = 0; }, { passive: true });
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
    if (isObj(prev) && Array.isArray(next)) {
        // 微博：缓存是 {hot, posts}，但 generateFeed 回来的是 posts 数组
        return { ...prev, posts: mergeArrays(prev.posts || [], next) };
    }
    if (Array.isArray(prev) && isObj(next)) {
        return isObj(next) && Array.isArray(next.posts)
            ? { ...next, posts: mergeArrays(prev, next.posts) }
            : mergeArrays(prev, next.items || []);
    }
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

/**
 * 拉一批内容。
 * @param {{replace?: boolean}} options replace=true 是「刷新按钮」语义：整页重新生成；
 *   默认 false 是「下滑加载」语义：旧的全部保留，新的接在后面。
 */
export function refreshFeed(appId, onUpdate, onLoading, options = {}) {
    const replace = !!options.replace;
    onLoading(true);
    let cancelled = false;
    const pill = showPill(replace ? '正在重新生成…' : '正在加载更多…', {
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
            // 刷新按钮 = 重新生成，不保留旧的
            const latest = getFeed(appId)?.items || [];
            const merged = replace ? items : mergeLists(mergeLists(prev, latest), items);
            if (!countOf(merged)) { toast('这次没拿到新内容'); return; }
            persistFeed(appId, merged);
            onUpdate(merged);
            const before = prev;
            showPill(replace ? '已重新生成 ' + countOf(merged) + ' 条' : '又来了 ' + Math.max(0, countOf(merged) - countOf(before)) + ' 条', {
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
                const merged = replace ? jitter(fallback) : mergeLists(latest, jitter(fallback));
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