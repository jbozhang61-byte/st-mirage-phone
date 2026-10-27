/**
 * 小红书：双列瀑布流笔记。
 */
import { h, icon, avatar, toast } from '../render.js';
import { loadFeed, refreshFeed, num, moodOf } from './feed-common.js';

export function mountXhs(host, { nav }) {
    nav.setChrome?.('light');
    let items = [];
    let loading = false;
    const liked = new Set();
    let tab = '发现';

    const el = h('div', { class: 'mp-xhs' });
    const body = h('div', { class: 'mp-xhs__body' });
    const head = h('div', { class: 'mp-xhs__head' },
        h('div', { class: 'mp-xhs__brand', text: '小红书' }),
        h('button', { type: 'button', class: 'mp-xhs__search', onclick: () => toast('搜索还没做，先看发现页') }, icon('search'), h('span', { text: '搜点什么' })),
        h('button', { type: 'button', class: 'mp-xhs__refresh', 'aria-label': '刷新', onclick: () => refresh() }, icon('sparkle')),
    );
    const tabs = h('div', { class: 'mp-xhs__tabs' });
    for (const name of ['关注', '发现', '附近']) {
        tabs.appendChild(h('button', {
            type: 'button', class: 'mp-xhs__tab' + (tab === name ? ' on' : ''), text: name,
            onclick: () => { tab = name; renderTabs(); if (name !== '发现') toast(name + '的内容还没接上'); },
        }));
    }
    el.append(head, tabs, body);
    host.appendChild(el);

    function renderTabs() {
        [...tabs.children].forEach(button => button.classList.toggle('on', button.textContent === tab));
    }

    function render(list) {
        items = Array.isArray(list) ? list : [];
        body.innerHTML = '';
        const columns = [h('div', { class: 'mp-xhs__col' }), h('div', { class: 'mp-xhs__col' })];
        items.forEach((item, index) => columns[index % 2].appendChild(noteCard(item)));
        body.append(...columns);
        if (!items.length) body.appendChild(h('div', { class: 'mp-xhs__empty', text: '这里还空着，点右上角刷新。' }));
    }

    function noteCard(item) {
        const isLiked = liked.has(item.id);
        const likeEl = h('span', { class: 'mp-xhs__likes' + (isLiked ? ' liked' : ''), text: num(item.likes + (isLiked ? 1 : 0)) });
        const card = h('div', { class: 'mp-xhs__card', onclick: () => openNote(item) },
            h('div', { class: 'mp-xhs__cover', 'data-mood': moodOf(item) },
                h('div', { class: 'mp-xhs__cover-title', text: item.title }),
                h('span', { class: 'mp-xhs__cover-glow' }),
            ),
            h('div', { class: 'mp-xhs__cap', text: item.text }),
            h('div', { class: 'mp-xhs__foot' },
                h('span', { class: 'mp-xhs__who' },
                    avatar({ name: item.author, size: 18 }),
                    h('span', { text: item.author }),
                ),
                h('button', {
                    type: 'button', class: 'mp-xhs__like' + (isLiked ? ' liked' : ''),
                    onclick: event => {
                        event.stopPropagation();
                        if (liked.has(item.id)) liked.delete(item.id);
                        else liked.add(item.id);
                        likeEl.textContent = num(item.likes + (liked.has(item.id) ? 1 : 0));
                        likeEl.classList.toggle('liked');
                        event.currentTarget.classList.toggle('liked');
                    },
                }, icon('heart'), likeEl),
                h('button', { type: 'button', class: 'mp-xhs__like', onclick: event => { event.stopPropagation(); openNote(item); } }, icon('comment'), h('span', { text: '评论' })),
            ),
        );
        return card;
    }

    function openNote(item) {
        openPostPage({
            item, app: '小红书', title: item.title, body: item.text,
            meta: '@' + item.author + ' · ♥ ' + num(item.likes) + '   ☆ ' + num(item.collects),
            image: artFor(item.id + item.title, moodOf(item)),
        });
    }

    function refresh() {
        if (loading) return;
        loading = true;
        toast('正在刷新笔记…');
        refreshFeed('xhs', render, value => { loading = value; });
    }

    renderTabs();
    loadFeed('xhs', render, value => { loading = value; });
    return { refresh: () => render(items) };
}