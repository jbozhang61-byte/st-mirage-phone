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
    if (config.provider === 'comfyui') {
        return generateComfy(endpoint, config, prompt);
    }
    if (config.provider === 'sd') {
        const response = await fetch(endpoint + '/sdapi/v1/txt2img', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                negative_prompt: config.negative || '',
                width: 768,
                height: 1024,
                steps: Math.max(1, Math.min(150, Number(config.steps) || 24)),
                cfg_scale: Math.max(1, Math.min(30, Number(config.cfg) || 6)),
            }),
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
        body: JSON.stringify({
            model: config.model || 'gpt-image-1',
            prompt,
            n: 1,
            size: config.size || '1024x1024',
            quality: config.quality || 'auto',
            response_format: 'b64_json',
        }),
    });
    if (!response.ok) throw new Error('生图接口返回 ' + response.status);
    const data = await response.json();
    const item = data?.data?.[0];
    if (!item) throw new Error('生图接口没有返回图片');
    if (item.b64_json) return 'data:image/png;base64,' + item.b64_json;
    if (item.url) return item.url;
    throw new Error('生图接口返回格式不对');
}

function fillComfy(node, prompt, negative) {
    if (typeof node === 'string') return node.split('{{prompt}}').join(prompt).split('{{negative}}').join(negative);
    if (Array.isArray(node)) return node.map(item => fillComfy(item, prompt, negative));
    if (node && typeof node === 'object') {
        const out = {};
        for (const [key, value] of Object.entries(node)) out[key] = fillComfy(value, prompt, negative);
        return out;
    }
    return node;
}

function comfyWorkflow(config, prompt, negative) {
    if (config.comfyWorkflow && String(config.comfyWorkflow).trim()) {
        let parsed;
        try { parsed = JSON.parse(config.comfyWorkflow); } catch { throw new Error('ComfyUI 工作流不是合法 JSON'); }
        return fillComfy(parsed, prompt, negative);
    }
    const checkpoint = config.comfyCheckpoint || 'sd_xl_base_1.0.safetensors';
    const steps = Math.max(1, Math.min(150, Number(config.steps) || 24));
    const cfg = Math.max(1, Math.min(30, Number(config.cfg) || 6));
    const negative = config.negative || 'low quality, blurry, text, watermark';
    return {
        '3': { class_type: 'KSampler', inputs: { seed: Math.floor(Math.random() * 1000000000), steps, cfg, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
        '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
        '5': { class_type: 'EmptyLatentImage', inputs: { width: 768, height: 1024, batch_size: 1 } },
        '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
        '7': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['4', 1] } },
        '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
        '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'mirage', images: ['8', 0] } },
    };
}

async function generateComfy(endpoint, config, prompt) {
    const clientId = 'mirage-' + Date.now().toString(36);
    const workflow = comfyWorkflow(config, prompt, 'low quality, blurry, text, watermark');
    const response = await fetch(endpoint + '/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    });
    if (!response.ok) throw new Error('ComfyUI 返回 ' + response.status);
    const queued = await response.json();
    const id = queued?.prompt_id;
    if (!id) throw new Error('ComfyUI 没有返回任务 id');
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        const historyResponse = await fetch(endpoint + '/history/' + encodeURIComponent(id));
        if (!historyResponse.ok) continue;
        const history = await historyResponse.json();
        const entry = history?.[id];
        if (!entry) continue;
        if (entry.status?.status_str === 'error') throw new Error('ComfyUI 生成失败');
        const outputs = entry.outputs || {};
        for (const output of Object.values(outputs)) {
            const image = output?.images?.[0];
            if (!image?.filename) continue;
            const params = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder || '', type: image.type || 'output' });
            return endpoint + '/view?' + params.toString();
        }
    }
    throw new Error('ComfyUI 生成超时');
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