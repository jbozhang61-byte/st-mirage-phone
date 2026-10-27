/**
 * 抖音：全屏竖滑的短视频流。
 * 没有真实视频，用氛围色块 + 文案模拟一帧画面；只保留刷视频这件事本身。
 */
import { h, icon, avatar, toast } from '../render.js';
import { artFor } from '../art.js';
import { cachedImage, warmImages } from '../imagegen.js';
import { openVideo } from './video.js';
import { openComments } from './comments.js';
import { loadFeed, refreshFeed, num, moodOf } from './feed-common.js';

export function mountTikTok(host, { nav }) {
    nav.setChrome?.('dark');
    let items = [];
    let loading = false;
    const liked = new Set();

    const el = h('div', { class: 'mp-tt' });
    const feed = h('div', { class: 'mp-tt__feed' });
    const tabs = h('div', { class: 'mp-tt__tabs' });
    tabs.append(
        h('button', { type: 'button', class: 'mp-tt__tab', text: '关注', onclick: () => toast('关注的人今天还没更新') }),
        h('button', { type: 'button', class: 'mp-tt__tab on', text: '推荐' }),
    );

    const head = h('div', { class: 'mp-tt__head' },
        h('button', { type: 'button', class: 'mp-tt__icon', 'aria-label': '刷新', onclick: () => refresh() }, icon('sparkle')),
        tabs,
        h('button', { type: 'button', class: 'mp-tt__icon', 'aria-label': '搜索', onclick: () => toast('搜索还没做，先刷推荐') }, icon('search')),
    );

    const navBar = h('div', { class: 'mp-tt__nav' },
        navItem('home', '首页', true),
        navItem('contacts', '朋友'),
        h('button', { type: 'button', class: 'mp-tt__plus', 'aria-label': '发布', onclick: () => toast('拍摄功能还没有接上') }, icon('plus')),
        navItem('message', '消息'),
        navItem('user', '我'),
    );

    el.append(feed, head, navBar);
    host.appendChild(el);
    window.addEventListener('mp-image', applyImages);

    function navItem(iconName, label, active = false) {
        return h('button', { type: 'button', class: 'mp-tt__navitem' + (active ? ' on' : ''), onclick: () => toast('这个页面还在装修') },
            icon(iconName),
            h('span', { text: label }),
        );
    }

    function render(list) {
        items = Array.isArray(list) ? list : [];
        feed.innerHTML = '';
        for (const item of items) feed.appendChild(card(item));
        if (!items.length) {
            feed.appendChild(h('div', { class: 'mp-tt__empty', text: '这里还没有视频，点右上角刷新试试。' }));
        }
        loading = false;
        warmImages(items, item => [item.title, item.desc, (item.tags || []).join(' ')].filter(Boolean).join('，'), 2);
    }

    function imgKey(item) { return String(item.id || item.title || item.author || '').slice(0, 80); }

    function imageFor(item) {
        return cachedImage(imgKey(item)) || artFor(item.id + item.title + item.author, moodOf(item));
    }

    function applyImages() {
        feed.querySelectorAll('[data-imgkey]').forEach(node => {
            const url = cachedImage(node.dataset.imgkey);
            if (url) node.style.backgroundImage = url;
        });
    }

    function card(item) {
        const isLiked = liked.has(item.id);
        const heart = h('button', {
            type: 'button', class: 'mp-tt__act' + (isLiked ? ' liked' : ''),
            onclick: () => {
                if (liked.has(item.id)) liked.delete(item.id);
                else liked.add(item.id);
                heart.classList.toggle('liked');
                count.textContent = num(item.likes + (liked.has(item.id) ? 1 : 0));
            },
        }, icon('heart'), h('span', { class: 'mp-tt__count', text: num(item.likes) }));
        const count = heart.querySelector('.mp-tt__count');

        const openPage = event => {
            if (event?.target?.closest?.('button')) return;
            openVideo(item, { app: '抖音' });
        };
        return h('div', { class: 'mp-tt__card', 'data-mood': moodOf(item), onclick: openPage },
            h('div', { class: 'mp-tt__art', 'data-imgkey': imgKey(item), style: { backgroundImage: imageFor(item) } },
                h('span', { class: 'mp-tt__blob a' }),
                h('span', { class: 'mp-tt__blob b' }),
                h('span', { class: 'mp-tt__grain' }),
            ),
            h('div', { class: 'mp-tt__rail' },
                h('div', { class: 'mp-tt__avatar' }, avatar({ name: item.author, size: 46 })),
                heart,
                h('button', { type: 'button', class: 'mp-tt__act', onclick: () => openVideo(item, { app: '抖音' }) }, icon('comment'), h('span', { class: 'mp-tt__count', text: num(item.comments) })),
                h('button', { type: 'button', class: 'mp-tt__act', onclick: () => toast('分享要长按，这里先记下') }, icon('share'), h('span', { class: 'mp-tt__count', text: num(item.shares) })),
                h('span', { class: 'mp-tt__disc' }, icon('music')),
            ),
            h('div', { class: 'mp-tt__meta' },
                h('div', { class: 'mp-tt__author', text: '@' + item.author }),
                item.title ? h('div', { class: 'mp-tt__title', text: item.title }) : null,
                h('div', { class: 'mp-tt__desc', text: item.desc }),
                h('div', { class: 'mp-tt__tags' }, ...(item.tags || []).map(tag => h('span', { text: '#' + tag }))),
                h('div', { class: 'mp-tt__music' }, icon('music'), h('span', { text: '原声 · ' + item.music })),
            ),
        );
    }

    function refresh() {
        if (loading) return;
        loading = true;
        toast('正在刷新视频…');
        refreshFeed('tiktok', render, value => { loading = value; });
    }

    loadFeed('tiktok', render, value => { loading = value; });
    return { refresh: () => render(items) };
}