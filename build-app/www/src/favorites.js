/**
 * 收藏：把帖子存成快照，刷新/重新生成也不会丢；点开还能接着回复。
 * 存在 data.favorites 里，跟着聊天一起保存。
 */
import { h, icon, sheet, toast } from './render.js';
import { getData, saveNow } from './store.js';

function listRef() {
    const data = getData();
    if (!Array.isArray(data.favorites)) data.favorites = [];
    return data.favorites;
}

export function favoritesList() {
    return listRef();
}

function keyOf(app, item) {
    return String(app) + '|' + String(item?.id || item?.title || item?.text || '').slice(0, 60);
}

export function isFavorite(app, item) {
    const key = keyOf(app, item);
    return listRef().some(entry => entry.key === key);
}

/** 收藏 / 取消收藏；返回收藏后的状态。 */
export function toggleFavorite(app, item, extra = {}) {
    const data = getData();
    const key = keyOf(app, item);
    const list = listRef();
    const index = list.findIndex(entry => entry.key === key);
    if (index >= 0) {
        list.splice(index, 1);
        saveNow('data');
        return false;
    }
    list.unshift({
        key,
        app: String(app || '帖子'),
        ts: Date.now(),
        title: String(extra.title || item?.title || '').slice(0, 120),
        body: String(extra.body || item?.text || '').slice(0, 1200),
        meta: String(extra.meta || '').slice(0, 160),
        image: extra.image || '',
        item: { id: item?.id, title: item?.title || '', text: item?.text || '' },
    });
    data.favorites = list.slice(0, 200);
    saveNow('data');
    return true;
}

/** 标题栏上那颗星；cls 用来套用各页面自己的按钮样式。 */
export function favoriteButton({ app, item, extra = {}, cls = 'mp-cm__refresh' }) {
    const button = h('button', { type: 'button', class: cls + ' mp-fav', 'aria-label': '收藏' }, icon('star'));
    const sync = () => {
        const on = isFavorite(app, item);
        button.classList.toggle('on', on);
        button.title = on ? '取消收藏' : '收藏';
    };
    button.addEventListener('click', event => {
        event.stopPropagation();
        const on = toggleFavorite(app, item, extra);
        sync();
        toast(on ? '已收藏，在「我 → 收藏」里能翻到' : '已取消收藏');
    });
    sync();
    return button;
}

/** 收藏列表：点开就是原来的帖子详情，能继续评论。 */
export function openFavorites() {
    const content = h('div', { class: 'mp-fav-list' });
    const draw = () => {
        content.innerHTML = '';
        const list = listRef();
        if (!list.length) {
            content.appendChild(h('div', { class: 'mp-st-hint', text: '还没有收藏。看到想留着的帖子，点右上角那颗星星。' }));
            return;
        }
        for (const entry of list) {
            const row = h('div', { class: 'mp-fav-row' },
                h('div', { class: 'mp-fav-main' },
                    h('div', { class: 'mp-fav-head' },
                        h('span', { class: 'mp-fav-app', text: entry.app }),
                        h('span', { class: 'mp-fav-title', text: entry.title || '（无标题）' })),
                    h('div', { class: 'mp-fav-text', text: String(entry.body || '').replace(/\s+/g, ' ').slice(0, 64) || '（没有正文）' })),
                h('button', { type: 'button', class: 'mp-fav-del', 'aria-label': '删除' }, icon('trash')),
            );
            row.addEventListener('click', async () => {
                const { openPostPage } = await import('./apps/postpage.js');
                dialog.close();
                openPostPage({ item: entry.item, app: entry.app, title: entry.title, body: entry.body, meta: entry.meta, image: entry.image });
            });
            row.querySelector('.mp-fav-del').addEventListener('click', event => {
                event.stopPropagation();
                const now = listRef();
                const index = now.findIndex(item => item.key === entry.key);
                if (index >= 0) now.splice(index, 1);
                saveNow('data');
                toast('已移出收藏');
                draw();
            });
            content.appendChild(row);
        }
    };
    draw();
    const dialog = sheet({ title: '收藏', content });
    return dialog;
}
