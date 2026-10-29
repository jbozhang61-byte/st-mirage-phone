/**
 * 抖音：全屏竖滑的短视频流。
 * 没有真实视频，用氛围色块 + 文案模拟一帧画面；只保留刷视频这件事本身。
 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { artFor } from '../art.js';
import { cachedImage, warmImages } from '../imagegen.js';
import { getFeed, setFeed, saveNow } from '../store.js';
import { userName } from '../st.js';
import { openVideo } from './video.js';

import { loadFeed, refreshFeed, num, moodOf } from './feed-common.js';

export function mountTikTok(host, { nav }) {
    nav.setChrome?.('dark');
    let items = [];
    let loading = false;
    let tab = '推荐';
    let query = '';
    const liked = new Set();
    const following = new Set();

    const el = h('div', { class: 'mp-tt' });
    const feed = h('div', { class: 'mp-tt__feed' });
    const tabs = h('div', { class: 'mp-tt__tabs' });
    const followTab = h('button', { type: 'button', class: 'mp-tt__tab', text: '关注', onclick: () => setTab('关注') });
    const recTab = h('button', { type: 'button', class: 'mp-tt__tab on', text: '推荐', onclick: () => setTab('推荐') });
    tabs.append(followTab, recTab);

    const head = h('div', { class: 'mp-tt__head' },
        h('button', { type: 'button', class: 'mp-tt__icon', 'aria-label': '刷新', onclick: () => refresh() }, icon('sparkle')),
        tabs,
        h('button', { type: 'button', class: 'mp-tt__icon', 'aria-label': '搜索', onclick: () => openSearch() }, icon('search')),
    );

    const navBar = h('div', { class: 'mp-tt__nav' },
        navItem('home', '首页', () => setTab('推荐')),
        navItem('contacts', '朋友', () => setTab('关注')),
        h('button', { type: 'button', class: 'mp-tt__plus', 'aria-label': '发布', onclick: () => publish() }, icon('plus')),
        navItem('message', '消息', () => notifications()),
        navItem('user', '我', () => mePage()),
    );

    el.append(feed, head, navBar);
    host.appendChild(el);
    window.addEventListener('mp-image', applyImages);

    function navItem(iconName, label, onClick) {
        return h('button', { type: 'button', class: 'mp-tt__navitem', onclick: onClick },
            icon(iconName),
            h('span', { text: label }),
        );
    }

    function setTab(next) {
        tab = next;
        followTab.classList.toggle('on', tab === '关注');
        recTab.classList.toggle('on', tab === '推荐');
        if (tab === '关注' && !following.size) toast('还没有关注的人，点视频右侧的 + 关注');
        paint();
        feed.scrollTop = 0;
    }

    function visibleItems() {
        let list = items;
        if (tab === '关注') list = list.filter(item => following.has(item.author));
        if (query) {
            const key = query.toLowerCase();
            list = list.filter(item => [item.author, item.title, item.desc, ...(item.tags || [])].join(' ').toLowerCase().includes(key));
        }
        return list;
    }

    function paint() {
        const list = visibleItems();
        feed.innerHTML = '';
        for (const item of list) feed.appendChild(card(item));
        if (!list.length) {
            const text = tab === '关注' ? '关注的人还没有发新视频。' : query ? '没有找到「' + query + '」相关的视频。' : '这里还没有视频，点右上角刷新试试。';
            feed.appendChild(h('div', { class: 'mp-tt__empty', text }));
        }
    }

    function render(list) {
        items = Array.isArray(list) ? list : [];
        paint();
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
                h('button', {
                    type: 'button', class: 'mp-tt__follow' + (following.has(item.author) ? ' on' : ''),
                    text: following.has(item.author) ? '已关注' : '+',
                    onclick: event => {
                        event.stopPropagation();
                        if (following.has(item.author)) following.delete(item.author);
                        else following.add(item.author);
                        event.currentTarget.classList.toggle('on');
                        event.currentTarget.textContent = following.has(item.author) ? '已关注' : '+';
                    },
                }),
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

    function openSearch() {
        const input = h('input', { class: 'mp-input', type: 'text', placeholder: '搜视频、作者、话题', value: query });
        const s = sheet({
            title: '搜索',
            content: h('div', { class: 'mp-field-list' }, input),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '搜索',
                onclick: () => {
                    query = input.value.trim();
                    s.close();
                    paint();
                    feed.scrollTop = 0;
                    if (query) toast('搜索：' + query);
                },
            }),
        });
    }

    function publish() {
        const title = h('input', { class: 'mp-input', type: 'text', placeholder: '标题，例如：雪停之后' });
        const desc = h('textarea', { class: 'mp-input', rows: '3', placeholder: '这一刻想说什么…' });
        const tags = h('input', { class: 'mp-input', type: 'text', placeholder: '话题，用空格或逗号分隔' });
        const s = sheet({
            title: '发布视频',
            content: h('div', { class: 'mp-field-list' },
                h('div', {}, h('label', { text: '标题' }), title),
                h('div', {}, h('label', { text: '文案' }), desc),
                h('div', {}, h('label', { text: '话题' }), tags),
            ),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '发布',
                onclick: () => {
                    const text = desc.value.trim() || title.value.trim();
                    if (!text) { toast('写点什么再发'); return; }
                    const item = {
                        id: 'tt-' + Date.now().toString(36),
                        author: userName() || '我',
                        title: title.value.trim().slice(0, 80),
                        desc: text.slice(0, 400),
                        tags: tags.value.split(/[\s,，、]+/).map(x => x.replace(/^#/, '').trim()).filter(Boolean).slice(0, 5),
                        music: '原声',
                        likes: 0,
                        comments: 0,
                        shares: 0,
                    };
                    items.unshift(item);
                    setFeed('tiktok', items);
                    saveNow('data');
                    s.close();
                    query = '';
                    setTab('推荐');
                    feed.scrollTop = 0;
                    toast('已发布');
                },
            }),
        });
    }

    function notifications() {
        const rows = [];
        for (const item of items.slice(0, 8)) {
            if (liked.has(item.id)) rows.push(h('div', { class: 'mp-tt__notice' }, h('b', { text: item.author }), ' 赞了你的视频'));
        }
        if (following.size) rows.push(h('div', { class: 'mp-tt__notice', text: '你关注了 ' + [...following].join('、') }));
        sheet({
            title: '消息',
            content: h('div', { class: 'mp-field-list' }, rows.length ? rows : h('div', { class: 'mp-st-hint', text: '还没有新消息。点赞、关注之后会出现在这里。' })),
        });
    }

    function mePage() {
        const mine = items.filter(item => item.author === (userName() || '我'));
        sheet({
            title: '我',
            content: h('div', { class: 'mp-me' },
                h('div', { class: 'mp-me__top' }, avatar({ name: userName() || '我', size: 54 }), h('div', {}, h('div', { class: 'mp-me__name', text: userName() || '我' }), h('div', { class: 'mp-me__phone', text: '@' + (userName() || '我') }))),
                h('div', { class: 'mp-me__stats' },
                    h('div', { class: 'mp-me__stat' }, h('span', { class: 'mp-me__stat-value', text: String(mine.length) }), h('span', { class: 'mp-me__stat-label', text: '作品' })),
                    h('div', { class: 'mp-me__stat' }, h('span', { class: 'mp-me__stat-value', text: String(liked.size) }), h('span', { class: 'mp-me__stat-label', text: '喜欢' })),
                    h('div', { class: 'mp-me__stat' }, h('span', { class: 'mp-me__stat-value', text: String(following.size) }), h('span', { class: 'mp-me__stat-label', text: '关注' })),
                ),
                mine.length ? h('div', { class: 'mp-field-list' }, ...mine.slice(0, 5).map(item => h('div', { class: 'mp-tt__notice', text: item.title || item.desc }))) : h('div', { class: 'mp-st-hint', text: '还没有发过视频，点底部 + 发一条。' }),
            ),
        });
    }

    function refresh() {
        if (loading) return;
        loading = true;
        toast('正在刷新视频…');
        refreshFeed('tiktok', render, value => { loading = value; });
    }

    loadFeed('tiktok', render, value => { loading = value; });
    return { refresh: () => render(items), destroy: () => window.removeEventListener('mp-image', applyImages) };
}