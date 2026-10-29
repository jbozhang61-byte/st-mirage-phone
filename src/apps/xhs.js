/**
 * 小红书：双列瀑布流笔记。
 */
import { h, icon, avatar, toast } from '../render.js';
import { getCast } from '../store.js';
import { loadFeed, refreshFeed, num, moodOf } from './feed-common.js';
import { openSearchSheet } from './search-sheet.js';
import { openPostPage } from './postpage.js';

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
        h('button', { type: 'button', class: 'mp-xhs__search', onclick: () => openSearch() }, icon('search'), h('span', { text: '搜点什么' })),
        h('button', { type: 'button', class: 'mp-xhs__refresh', 'aria-label': '刷新', onclick: () => refresh() }, icon('sparkle')),
    );
    const tabs = h('div', { class: 'mp-xhs__tabs' });
    for (const name of ['关注', '发现', '附近']) {
        tabs.appendChild(h('button', {
            type: 'button', class: 'mp-xhs__tab' + (tab === name ? ' on' : ''), text: name,
            onclick: () => { tab = name; renderTabs(); render(items); },
        }));
    }
    el.append(head, tabs, body);
    host.appendChild(el);

    function renderTabs() {
        [...tabs.children].forEach(button => button.classList.toggle('on', button.textContent === tab));
    }

    function visibleItems() {
        const all = items;
        if (tab === '关注') {
            const names = new Set(getCast().map(person => person.name));
            return all.filter(item => names.has(item.author));
        }
        if (tab === '附近') return [...all].reverse();
        return all;
    }

    function render(list) {
        items = Array.isArray(list) ? list : [];
        body.innerHTML = '';
        const columns = [h('div', { class: 'mp-xhs__col' }), h('div', { class: 'mp-xhs__col' })];
        visibleItems().forEach((item, index) => columns[index % 2].appendChild(noteCard(item)));
        body.append(...columns);
        if (!visibleItems().length) body.appendChild(h('div', { class: 'mp-xhs__empty', text: tab === '关注' ? '关注的人还没有发笔记。' : '这里还空着，点右上角刷新。' }));
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

    function openSearch() {
        openSearchSheet({
            title: '搜索笔记',
            placeholder: '搜标题、正文、作者、话题',
            items,
            textOf: item => [item.title, item.text, item.author, ...(item.tags || [])].join(' '),
            onPick: item => openNote(item),
        });
    }

    function refresh() {
        loading = true;
        toast('正在刷新笔记…');
        refreshFeed('xhs', render, value => { loading = value; });
    }

    renderTabs();
    loadFeed('xhs', render, value => { loading = value; });
    return { refresh: () => render(items) };
}