/**
 * 手机相册里的图片：压缩后存在浏览器本地（localStorage），
 * 聊天数据里只放 id，避免把聊天记录撑大。
 */
const PREFIX = 'mirage_img_';
const MAX_SIDE = 1200;

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('读取失败'));
        reader.readAsDataURL(file);
    });
}

async function compress(file, side = MAX_SIDE) {
    const raw = await readAsDataUrl(file);
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('不是有效的图片'));
        image.src = raw;
    });
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
}

function prune() {
    try {
        const keys = Object.keys(localStorage).filter(key => key.startsWith(PREFIX));
        // 超过 18 张时删掉最早的
        if (keys.length <= 18) return;
        const rows = keys.map(key => ({ key, ts: Number(key.split('_').pop()) || 0 }));
        rows.sort((a, b) => a.ts - b.ts).slice(0, rows.length - 18).forEach(row => localStorage.removeItem(row.key));
    } catch { /* ignore */ }
}

export async function storeImage(file) {
    if (!file) throw new Error('没有选中图片');
    const dataUrl = await compress(file);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    try {
        localStorage.setItem(PREFIX + id + '_' + Date.now(), dataUrl);
        prune();
    } catch (error) {
        console.warn('[幻镜手机] 本地图片过多，已跳过保存', error);
    }
    return { id, url: dataUrl };
}

export function resolveImage(id) {
    if (!id) return '';
    try {
        const key = Object.keys(localStorage).find(k => k.startsWith(PREFIX + id + '_'));
        return key ? localStorage.getItem(key) || '' : '';
    } catch {
        return '';
    }
}

export function removeImage(id) {
    if (!id) return;
    try {
        Object.keys(localStorage).filter(key => key.startsWith(PREFIX + id + '_')).forEach(key => localStorage.removeItem(key));
    } catch { /* ignore */ }
}
