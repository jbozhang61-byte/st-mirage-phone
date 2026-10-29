/** 自定义头像：存在本地图片库，聊天数据里只记 id。 */
import { getData, saveNow } from './store.js';
import { storeImage, resolveImage } from './images.js';

export function avatarUrl(name) {
    try {
        const item = getData()?.avatars?.[String(name || '')];
        return item?.id ? resolveImage(item.id) : '';
    } catch {
        return '';
    }
}

export async function changeAvatar(name, file) {
    if (!name) throw new Error('没有名字');
    const stored = await storeImage(file);
    const data = getData();
    data.avatars = data.avatars && typeof data.avatars === 'object' ? data.avatars : {};
    data.avatars[name] = { id: stored.id, ts: Date.now() };
    saveNow('data');
    return stored;
}

export function removeAvatar(name) {
    const data = getData();
    if (!data?.avatars) return;
    delete data.avatars[name];
    saveNow('data');
}
