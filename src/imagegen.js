/**
 * 生图接口：支持 OpenAI 兼容的 /images/generations 和 SD WebUI 的 /sdapi/v1/txt2img。
 * 没配置或失败时，退回程序化照片，不影响使用。
 */
import { getSettings } from './store.js';

const cache = new Map();
let busy = false;

export function imageConfig() {
    const settings = getSettings();
    return settings.image || { enabled: false, provider: 'openai', endpoint: '', apiKey: '', model: 'gpt-image-1', size: '1024x1024' };
}

export function cachedImage(key) {
    return cache.get(key) || '';
}

export function rememberImage(key, url) {
    if (!url) return;
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    cache.set(key, url);
    try { globalThis.dispatchEvent(new CustomEvent('mp-image', { detail: { key } })); } catch { /* ignore */ }
}

export async function generateImage(prompt) {
    const config = imageConfig();
    if (!config.enabled || !config.endpoint) throw new Error('还没有配置生图接口');
    const endpoint = config.endpoint.replace(/\/$/, '');
    if (config.provider === 'sd') {
        const response = await fetch(endpoint + '/sdapi/v1/txt2img', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, width: 768, height: 1024, steps: 24, cfg_scale: 6 }),
        });
        if (!response.ok) throw new Error('生图接口返回 ' + response.status);
        const data = await response.json();
        const first = data?.images?.[0];
        if (!first) throw new Error('生图接口没有返回图片');
        return first.startsWith('data:') ? first : 'data:image/png;base64,' + first;
    }
    const response = await fetch(endpoint + '/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (config.apiKey || '') },
        body: JSON.stringify({ model: config.model || 'gpt-image-1', prompt, n: 1, size: config.size || '1024x1024', response_format: 'b64_json' }),
    });
    if (!response.ok) throw new Error('生图接口返回 ' + response.status);
    const data = await response.json();
    const item = data?.data?.[0];
    if (!item) throw new Error('生图接口没有返回图片');
    if (item.b64_json) return 'data:image/png;base64,' + item.b64_json;
    if (item.url) return item.url;
    throw new Error('生图接口返回格式不对');
}

/** 给前 N 张内容生成配图；一张一张来，避免打爆接口。 */
export async function warmImages(items, promptOf, count = 2) {
    if (busy) return;
    const config = imageConfig();
    if (!config.enabled || !config.endpoint) return;
    busy = true;
    try {
        for (const item of (items || []).slice(0, count)) {
            const key = String(item.id || item.title || item.text || '').slice(0, 80);
            if (!key || cache.has(key)) continue;
            try {
                const prompt = promptOf(item) + '，电影质感照片，真实光线，不要文字，不要水印';
                const url = await generateImage(prompt);
                rememberImage(key, url);
            } catch { /* 单张失败就跳过 */ }
        }
    } finally {
        busy = false;
    }
}
