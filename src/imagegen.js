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
    if (config.provider === 'novelai') {
        return generateNovelAi(endpoint, config, prompt);
    }
    if (config.provider === 'gemini') {
        return generateGemini(endpoint, config, prompt);
    }
    if (config.provider === 'stability') {
        return generateStability(endpoint, config, prompt);
    }
    if (config.provider === 'custom') {
        return generateCustom(endpoint, config, prompt);
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

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('图片转码失败'));
        reader.readAsDataURL(blob);
    });
}

function sizeToAspect(size) {
    const text = String(size || '1024x1024');
    const [w, h] = text.split('x').map(Number);
    if (!w || !h) return '1:1';
    const ratio = w / h;
    if (ratio > 1.6) return '16:9';
    if (ratio > 1.2) return '3:2';
    if (ratio < 0.62) return '9:16';
    if (ratio < 0.82) return '2:3';
    return '1:1';
}

function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

async function inflateRaw(chunk) {
    if (typeof DecompressionStream !== 'function') throw new Error('这个浏览器不支持解压，换 Chrome/Edge');
    const stream = new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** NovelAI 回的是 zip，这里把里面第一张图拆出来。 */
async function unzipFirstImage(bytes) {
    let offset = 0;
    while (offset + 30 < bytes.length) {
        if (!(bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04)) return '';
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
        const method = view.getUint16(8, true);
        const compSize = view.getUint32(18, true);
        const nameLen = view.getUint16(26, true);
        const extraLen = view.getUint16(28, true);
        const nameStart = offset + 30;
        const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLen));
        const dataStart = nameStart + nameLen + extraLen;
        if (!compSize) return '';
        const chunk = bytes.slice(dataStart, dataStart + compSize);
        if (/\.(png|jpe?g|webp)$/i.test(name)) {
            const raw = method === 0 ? chunk : await inflateRaw(chunk);
            const mime = /\.jpe?g$/i.test(name) ? 'image/jpeg' : /\.webp$/i.test(name) ? 'image/webp' : 'image/png';
            return 'data:' + mime + ';base64,' + bytesToBase64(raw);
        }
        offset = dataStart + compSize;
    }
    return '';
}

/** NovelAI（nai-diffusion-4-5 / 5）：Bearer 持久 token，返回 zip 或图片。 */
async function generateNovelAi(endpoint, config, prompt) {
    const host = (endpoint || 'https://image.novelai.net').replace(/\/$/, '');
    const [w, h] = String(config.size || '832x1216').split('x').map(Number);
    const response = await fetch(host + '/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (config.apiKey || '') },
        body: JSON.stringify({
            input: prompt,
            model: config.model || 'nai-diffusion-4-5-full',
            action: 'generate',
            parameters: {
                width: Math.max(64, Math.min(1600, w || 832)),
                height: Math.max(64, Math.min(1600, h || 1216)),
                scale: Math.max(1, Math.min(30, Number(config.cfg) || 6)),
                sampler: config.sampler || 'k_euler_ancestral',
                steps: Math.max(1, Math.min(50, Number(config.steps) || 28)),
                n_samples: 1,
                ucPreset: 0,
                qualityToggle: true,
                negative_prompt: config.negative || '',
                uc: config.negative || 'lowres, bad anatomy, bad hands, text, error, worst quality',
            },
        }),
    });
    if (!response.ok) {
        let detail = '';
        try { detail = (await response.text()).slice(0, 160); } catch { /* ignore */ }
        throw new Error('NovelAI 返回 ' + response.status + (detail ? '：' + detail : ''));
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
        const image = await unzipFirstImage(bytes);
        if (image) return image;
        throw new Error('NovelAI 返回了压缩包，但没拆出图片');
    }
    const type = String(response.headers.get('content-type') || 'image/png');
    return 'data:' + (type.startsWith('image/') ? type : 'image/png') + ';base64,' + bytesToBase64(bytes);
}

/** Google Gemini / Nano Banana：generateContent + inlineData。 */
async function generateGemini(endpoint, config, prompt) {
    const host = (endpoint || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
    const model = config.model || 'gemini-2.5-flash-image';
    const url = host + '/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(config.apiKey || '');
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt + (config.negative ? '。避免：' + config.negative : '') }] }],
            generationConfig: { responseModalities: ['IMAGE'] },
        }),
    });
    if (!response.ok) {
        let detail = '';
        try { detail = (await response.text()).slice(0, 160); } catch { /* ignore */ }
        throw new Error('Gemini 返回 ' + response.status + (detail ? '：' + detail : ''));
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const inline = parts.find(part => part?.inlineData?.data || part?.inline_data?.data);
    const raw = inline?.inlineData || inline?.inline_data;
    if (!raw?.data) throw new Error('Gemini 没有返回图片（可能被安全策略拦了）');
    const mime = raw.mimeType || raw.mime_type || 'image/png';
    return 'data:' + mime + ';base64,' + raw.data;
}

/** Stability AI：multipart 表单，直接回二进制。 */
async function generateStability(endpoint, config, prompt) {
    const form = new FormData();
    form.append('prompt', prompt);
    if (config.negative) form.append('negative_prompt', config.negative);
    form.append('output_format', 'png');
    form.append('aspect_ratio', sizeToAspect(config.size));
    const response = await fetch((endpoint || 'https://api.stability.ai').replace(/\/$/, '') + '/v2beta/stable-image/generate/core', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (config.apiKey || ''), Accept: 'image/*' },
        body: form,
    });
    if (!response.ok) throw new Error('Stability 返回 ' + response.status);
    return blobToDataUrl(await response.blob());
}

/** 自定义接口：自己填 URL / 请求头 / 请求体，再用路径取出图片。 */
async function generateCustom(endpoint, config, prompt) {
    let headers = {};
    try {
        headers = config.customHeaders ? JSON.parse(config.customHeaders) : {};
    } catch { toast?.('自定义请求头不是合法 JSON'); }
    if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json';
    if (config.apiKey && !headers.Authorization) headers.Authorization = 'Bearer ' + config.apiKey;
    let body = config.customBody
        ? String(config.customBody).split('{{prompt}}').join(prompt).split('{{negative}}').join(config.negative || '')
        : JSON.stringify({ prompt, negative_prompt: config.negative || '' });
    const response = await fetch(endpoint, { method: 'POST', headers, body });
    if (!response.ok) throw new Error('自定义接口返回 ' + response.status);
    const type = String(response.headers.get('content-type') || '');
    if (type.startsWith('image/')) return blobToDataUrl(await response.blob());
    const data = await response.json();
    const path = String(config.customPath || 'data.0.b64_json').trim();
    let value = data;
    for (const part of path.split('.')) {
        if (value == null) break;
        value = Array.isArray(value) ? value[Number(part)] : value[part];
    }
    const text = String(value || '');
    if (!text) throw new Error('自定义接口没找到图片字段（' + path + '）');
    if (text.startsWith('data:') || text.startsWith('http')) return text;
    return 'data:image/png;base64,' + text;
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

function comfyWorkflow(config, prompt, negativePrompt) {
    if (config.comfyWorkflow && String(config.comfyWorkflow).trim()) {
        let parsed;
        try { parsed = JSON.parse(config.comfyWorkflow); } catch { throw new Error('ComfyUI 工作流不是合法 JSON'); }
        return fillComfy(parsed, prompt, negativePrompt);
    }
    const checkpoint = config.comfyCheckpoint || 'sd_xl_base_1.0.safetensors';
    const steps = Math.max(1, Math.min(150, Number(config.steps) || 24));
    const cfg = Math.max(1, Math.min(30, Number(config.cfg) || 6));
    const negativeText = config.negative || negativePrompt || 'low quality, blurry, text, watermark';
    return {
        '3': { class_type: 'KSampler', inputs: { seed: Math.floor(Math.random() * 1000000000), steps, cfg, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
        '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
        '5': { class_type: 'EmptyLatentImage', inputs: { width: 768, height: 1024, batch_size: 1 } },
        '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
        '7': { class_type: 'CLIPTextEncode', inputs: { text: negativeText, clip: ['4', 1] } },
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