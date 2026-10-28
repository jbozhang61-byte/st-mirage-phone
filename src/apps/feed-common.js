/**
 * 内容类 App 的公共部分：拿缓存、兜底内容、刷新、数字格式化。
 */
import { toast } from '../render.js';
import { getFeed, getData } from '../store.js';
import { FEEDS } from '../feed.js';
import { generateFeed, friendlyError } from '../ai.js';
import { userName, currentCharacter, storyContext, memoryContext } from '../st.js';

export function feedContext() {
    const data = getData();
    return {
        world: currentCharacter()?.name || '',
        people: (data.world?.cast || []).map(person => person.name),
        user: userName(),
        story: storyContext(40, 340),
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

export function refreshFeed(appId, onUpdate, onLoading) {
    onLoading(true);
    toast('正在刷新…');
    generateFeed(appId)
        .then(items => { onUpdate(items); toast('刷新好了'); })
        .catch(error => toast(friendlyError(error), 3200))
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