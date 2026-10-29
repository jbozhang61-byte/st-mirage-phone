/**
 * 哔哩哔哩：双列视频卡片。
 */
import { h, icon, avatar, toast } from '../render.js';
import { openVideo } from './video.js';
import { loadFeed, refreshFeed, moodOf } from './feed-common.js';
import { openSearchSheet } from './search-sheet.js';

export function mountBili(host, { nav }) {
    nav.setChrome?.('light');
    let items = [];
    let loading = false;
    let tab = '推荐';

    const el = h('div', { class: 'mp-bl' });
    const body = h('div', { class: 'mp-bl__body' });
    const head = h('div', { class: 'mp-bl__head' },
        h('div', { class: 'mp-bl__brand', text: '哔哩哔哩' }),
        h('button', { type: 'button', class: 'mp-bl__search', onclick: () => openSearch() }, icon('search'), h('span', { text: '搜索' })),
        h('button', { type: 'button', class: 'mp-bl__refresh', 'aria-label': '刷新', onclick: () => refresh() }, icon('refresh')),
    );
    const tabs = h('div', { class: 'mp-bl__tabs' });
    for (const name of ['推荐', '热门', '影视', '知识']) {
        tabs.appendChild(h('button', {
            type: 'button', class: 'mp-bl__tab' + (tab === name ? ' on' : ''), text: name,
            onclick: () => { tab = name; [...tabs.children].forEach(b => b.classList.toggle('on', b.textContent === tab)); render(items); },
        }));
    }
    el.append(head, tabs, body);
    host.appendChild(el);

    function visibleItems() {
        if (tab === '热门') return [...items].sort((a, b) => (parseInt(String(b.views).replace(/\D/g, ''), 10) || 0) - (parseInt(String(a.views).replace(/\D/g, ''), 10) || 0));
        if (tab === '影视') return items.filter(item => /电影|剧|预告|动画|番|片/.test([item.title, item.desc, ...(item.tags || [])].join(' ')));
        if (tab === '知识') return items.filter(item => /知识|教|讲|历史|科学|科普|课/.test([item.title, item.desc, ...(item.tags || [])].join(' ')));
        return items;
    }

    function render(list) {
        items = Array.isArray(list) ? list : [];
        body.innerHTML = '';
        const grid = h('div', { class: 'mp-bl__grid' });
        visibleItems().forEach(item => grid.appendChild(card(item)));
        body.appendChild(grid);
        if (!visibleItems().length) body.appendChild(h('div', { class: 'mp-bl__empty', text: tab === '推荐' ? '还没有视频，点右上角刷新。' : '这个分区暂时没有视频。' }));
    }

    function card(item) {
        return h('div', { class: 'mp-bl__card', onclick: () => openVideo(item, { app: '哔哩哔哩' }) },
            h('div', { class: 'mp-bl__cover', 'data-mood': moodOf(item) },
                h('span', { class: 'mp-bl__glow' }),
                h('span', { class: 'mp-bl__dur', text: item.duration }),
                h('span', { class: 'mp-bl__dm', text: '弹幕 ' + item.danmaku }),
                h('span', { class: 'mp-bl__play' }, icon('play', '', 26)),
            ),
            h('div', { class: 'mp-bl__title', text: item.title }),
            h('div', { class: 'mp-bl__meta' },
                avatar({ name: item.author, size: 16 }),
                h('span', { class: 'mp-bl__up', text: item.author }),
                h('span', { class: 'mp-bl__views', text: item.views + ' 播放' }),
            ),
        );
    }

    function openSearch() {
        openSearchSheet({
            title: '搜索视频',
            placeholder: '搜标题、UP 主',
            items,
            textOf: item => [item.title, item.author, item.desc].join(' '),
            onPick: item => openVideo(item, { app: '哔哩哔哩' }),
        });
    }

    function refresh() {
        if (loading) return;
        loading = true;
        toast('正在刷新视频…');
        refreshFeed('bili', render, value => { loading = value; });
    }

    loadFeed('bili', render, value => { loading = value; });
    return { refresh: () => render(items) };
}