/**
 * 相册：收藏的图片 + 从剧情里扫到的画面。
 */
import { h, icon, toast } from '../render.js';
import { getData, addPhoto, removePhoto } from '../store.js';
import { ctx } from '../st.js';

export function mountPhotos(host, { nav }) {
    const body = h('div', { class: 'mp-body' });
    const el = h('div', { class: 'mp-conv' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '相册', h('small', { text: 'PHOTOS' })),
            h('button', {
                class: 'mp-nav__btn', type: 'button', 'aria-label': '选择',
                onclick: () => { selecting = !selecting; selected.clear(); render(); },
            }, icon(selecting ? 'close' : 'check')),
        ),
        body,
    );
    host.appendChild(el);
    let tab = getData().photos.length && !scanChatImages().length ? 'saved' : 'story';
    let selecting = false;
    const selected = new Set();

    function groupByDate(list) {
        const groups = new Map();
        for (const item of list) {
            const date = new Date(item.ts || Date.now());
            const key = (date.getMonth() + 1) + '月' + date.getDate() + '日';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        }
        return groups;
    }

    function renderGrid(list, savedMode) {
        const wrap = h('div', { class: 'mp-photos' });
        for (const [label, items] of groupByDate(list)) {
            wrap.appendChild(h('div', { class: 'mp-photo-date', text: label }));
            const grid = h('div', { class: 'mp-photo-grid' });
            for (const item of items) grid.appendChild(tile(item.url, item.cap, () => {
                if (selecting) {
                    if (selected.has(item.url)) selected.delete(item.url);
                    else selected.add(item.url);
                    render();
                    return;
                }
                openLightbox(item.url, item.cap, savedMode ? item : null);
            }, item.url));
            wrap.appendChild(grid);
        }
        return wrap;
    }

    function selectionBar() {
        if (!selecting) return null;
        return h('div', { class: 'mp-photo-selectbar' },
            h('span', { text: '已选 ' + selected.size + ' 张' }),
            h('button', { type: 'button', class: 'mp-photo-selectbar__cancel', text: '取消', onclick: () => { selecting = false; selected.clear(); render(); } }),
            h('button', {
                type: 'button', class: 'mp-photo-selectbar__del', text: '删除',
                onclick: () => {
                    const data = getData();
                    for (const photo of [...data.photos]) if (selected.has(photo.url)) removePhoto(photo.id);
                    selected.clear();
                    selecting = false;
                    toast('已删除');
                    render();
                },
            }),
        );
    }

    function render() {
        const data = getData();
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'mp-seg' },
            h('button', { class: tab === 'story' ? 'on' : '', type: 'button', text: '剧情画面', onclick: () => { tab = 'story'; render(); } }),
            h('button', { class: tab === 'saved' ? 'on' : '', type: 'button', text: '收藏 ' + (data.photos.length || ''), onclick: () => { tab = 'saved'; render(); } }),
        ));

        if (tab === 'saved') {
            if (!data.photos.length) { body.appendChild(empty('还没有收藏的图片', '在「剧情画面」里点开一张，点「收藏」就会出现在这里。')); return; }
            body.appendChild(renderGrid(data.photos, true));
            body.appendChild(selectionBar());
            return;
        }

        const found = scanChatImages();
        if (!found.length) {
            body.appendChild(empty('剧情里还没有画面', '当正文或楼里的图片出现时，会自动收进这里；也可以点开图片收藏。'));
            return;
        }
        body.appendChild(h('div', { class: 'mp-photo-note', text: '最近 ' + found.length + ' 张 · 来自正文和楼层里的图片' }));
        body.appendChild(renderGrid(found, false));
        body.appendChild(selectionBar());
    }

    function tile(url, cap, onClick, key) {
        const el = h('div', { class: 'mp-photo-tile' + (selecting && selected.has(key) ? ' is-selected' : ''), onclick: onClick },
            h('img', { src: url, alt: cap || '', loading: 'lazy' }),
            cap ? h('div', { class: 'mp-photo-tile__cap', text: cap }) : null,
            selecting ? h('span', { class: 'mp-photo-tile__check' + (selected.has(key) ? ' on' : '') }, icon('check')) : null,
        );
        el.addEventListener('error', () => {}, true);
        return el;
    }

    function empty(title, text) {
        return h('div', { class: 'mp-empty' },
            h('div', { class: 'mp-empty__icon' }, icon('photos')),
            h('div', { class: 'mp-empty__title', text: title }),
            h('div', { class: 'mp-empty__text', text }),
        );
    }

    function openLightbox(url, cap, saved) {
        const box = h('div', { class: 'mp-lightbox' });
        const bar = h('div', { class: 'mp-lightbox__bar' },
            h('span', { text: cap || '' }),
            h('div', { style: { display: 'flex', gap: '8px' } },
                h('button', {
                    type: 'button', 'aria-label': '收藏',
                    onclick: () => { addPhoto(url, cap); toast('已收藏到相册'); render(); },
                }, icon(saved ? 'check' : 'star')),
                h('button', { type: 'button', 'aria-label': '关闭', onclick: () => box.remove() }, icon('close')),
            ),
        );
        box.append(bar, h('img', { src: url, alt: '' }));
        if (saved) {
            box.appendChild(h('div', { style: { padding: '0 16px 18px' } },
                h('button', {
                    class: 'mp-btn block ghost', type: 'button', text: '取消收藏',
                    onclick: () => { removePhoto(saved.id); box.remove(); render(); },
                }),
            ));
        }
        el.appendChild(box);
    }

    render();
    return { refresh: render };
}

function scanChatImages() {
    const c = ctx();
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    const out = [];
    const seen = new Set();
    for (const msg of chat.slice(-160)) {
        const text = String(msg?.mes || '');
        if (!text.includes('<img') && !text.includes('![')) continue;
        const urls = [];
        for (const match of text.matchAll(/<img[^>]*?src=["']([^"']+)["']/gi)) urls.push(match[1]);
        for (const match of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) urls.push(match[1]);
        for (const url of urls) {
            if (!url || url.startsWith('data:') || url.startsWith('blob:') || seen.has(url)) continue;
            seen.add(url);
            const cap = text.replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
            out.push({ url, cap, ts: msg.ts || Date.now() });
        }
    }
    return out.reverse();
}