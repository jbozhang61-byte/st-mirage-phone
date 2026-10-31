/**
 * 浏览器：地址栏、常用网站、搜索结果、网页正文。
 */
import { h, icon, toast } from '../render.js';
import { getData, saveNow } from '../store.js';
import { browse } from '../ai.js';
import { setOneShot } from '../st.js';

const SHORTCUTS = [
    { name: '搜索', icon: 'search', query: '这个城市 最近 新闻' },
    { name: '百科', icon: 'book', query: '旧城 百科' },
    { name: '天气', icon: 'weather', query: '今天 天气' },
    { name: '论坛', icon: 'hash', query: '本地 论坛 帖子' },
];

export function mountBrowser(host, { nav }) {
    let page = getData().browser?.last || null;
    let loading = false;
    let address = page?.url || '';
    let stack = [];   // 后退栈

    const el = h('div', { class: 'mp-br' });
    const body = h('div', { class: 'mp-br__body' });
    const bar = h('div', { class: 'mp-br__bar' });
    el.append(bar, body);
    host.appendChild(el);

    function bookmarks() {
        const data = getData();
        data.browser = data.browser || { last: null, history: [] };
        if (!Array.isArray(data.browser.bookmarks)) data.browser.bookmarks = [];
        return data.browser.bookmarks;
    }

    function isBookmarked(url) {
        return !!url && bookmarks().some(item => item.url === url);
    }

    function toggleBookmark() {
        if (!address) { toast('先打开一个网页'); return; }
        const data = getData();
        data.browser = data.browser || { last: null, history: [] };
        const list = bookmarks();
        const index = list.findIndex(item => item.url === address);
        if (index >= 0) {
            list.splice(index, 1);
            toast('已取消收藏');
        } else {
            list.unshift({ url: address, title: page?.title || address, ts: Date.now() });
            toast('已收藏，在浏览器首页能看到');
        }
        saveNow('data');
    }

    function renderBar() {
        bar.innerHTML = '';
        const home = h('button', {
            type: 'button', class: 'mp-br__icon', 'aria-label': '返回',
            onclick: () => {
                if (stack.length) {
                    const prev = stack.pop();
                    page = prev || null;
                    address = prev?.url || '';
                    render();
                    return;
                }
                if (page) { page = null; address = ''; render(); }
                else nav.back();
            },
        }, icon('back'));
        const star = h('button', {
            type: 'button', class: 'mp-br__icon mp-br__star' + (isBookmarked(address) ? ' is-on' : ''), 'aria-label': '收藏',
            onclick: () => { toggleBookmark(); renderBar(); },
        }, icon('star'));
        const input = h('input', {
            type: 'text', value: address, placeholder: '输入网址或搜索',
            oninput: event => { address = event.target.value; },
            onkeydown: event => { if (event.key === 'Enter') go(address); },
        });
        const refresh = h('button', { type: 'button', class: 'mp-br__icon', 'aria-label': '刷新', onclick: () => { if (address) go(address); } }, icon('refresh'));
        const submitAddr = h('button', {
            type: 'button', class: 'mp-br__icon', 'aria-label': '前往',
            onclick: () => { const value = address.trim(); if (value) go(value); },
        }, icon('chevron'));
        bar.append(home, h('div', { class: 'mp-br__addr' }, h('span', { class: 'mp-br__lock' }, icon('lock')), input), submitAddr, star, refresh);
    }

    function render() {
        renderBar();
        body.innerHTML = '';
        if (!page) renderHome();
        else renderPage(page);
    }

    function renderHome() {
        const home = h('div', { class: 'mp-br__home' });
        home.appendChild(h('div', { class: 'mp-br__logo', text: '幻镜' }));
        home.appendChild(h('div', { class: 'mp-br__logo-sub', text: '这个世界的网页' }));

        const run = value => {
            const text = String(value || '').trim();
            if (!text) { toast('先写点什么'); return; }
            go(text);
        };
        const input = h('input', {
            type: 'text', placeholder: '搜点什么…（输完点右边）',
            onkeydown: event => { if (event.key === 'Enter') run(event.target.value); },
        });
        const goBtn = h('button', {
            type: 'button', class: 'mp-br__go', 'aria-label': '搜索',
            onclick: () => run(input.value),
        }, icon('chevron'));
        home.appendChild(h('div', { class: 'mp-br__search' }, icon('search'), input, goBtn));

        const shortcuts = h('div', { class: 'mp-br__shortcuts' });
        for (const item of SHORTCUTS) {
            shortcuts.appendChild(h('button', {
                type: 'button', class: 'mp-br__shortcut',
                onclick: () => go(item.query),
            }, icon(item.icon), h('span', { text: item.name })));
        }
        home.appendChild(shortcuts);

        const saved = bookmarks();
        if (saved.length) {
            home.appendChild(h('div', { class: 'mp-br__recent-head' },
                h('div', { class: 'mp-br__recent-label', text: '收藏' })));
            const favWrap = h('div', { class: 'mp-br__favs' });
            for (const item of saved.slice(0, 6)) {
                favWrap.appendChild(h('button', {
                    type: 'button', class: 'mp-br__fav',
                    onclick: () => go(item.url),
                }, icon('star'), h('span', { text: item.title || item.url })));
            }
            home.appendChild(favWrap);
        }
        body.appendChild(home);

        const history = getData().browser?.history || [];
        if (!history.length) return;
        const recent = h('div', { class: 'mp-br__recent' },
            h('div', { class: 'mp-br__recent-head' },
                h('div', { class: 'mp-br__recent-label', text: '最近访问' }),
                h('button', {
                    type: 'button', class: 'mp-br__clear', text: '清空',
                    onclick: () => {
                        const data = getData();
                        data.browser = data.browser || { last: null, history: [] };
                        data.browser.history = [];
                        saveNow('data');
                        render();
                    },
                }),
            ),
        );
        for (const url of history.slice().reverse().slice(0, 5)) {
            recent.appendChild(h('div', { class: 'mp-br__recent-item' },
                h('button', { type: 'button', class: 'mp-br__recent-row', text: url, onclick: () => go(url) }),
                h('button', {
                    type: 'button', class: 'mp-br__del', 'aria-label': '删除记录',
                    onclick: event => {
                        event.stopPropagation();
                        const data = getData();
                        data.browser = data.browser || { last: null, history: [] };
                        data.browser.history = (data.browser.history || []).filter(item => item !== url);
                        saveNow('data');
                        render();
                    },
                }, icon('close')),
            ));
        }
        body.appendChild(recent);
    }

    function renderPage(item) {
        const article = h('article', { class: 'mp-br__article' });
        article.appendChild(h('div', { class: 'mp-br__site', text: (item.url || '').split('/')[0] + ' · 幻镜网' }));
        article.appendChild(h('h1', { class: 'mp-br__title', text: item.title }));
        if (item.summary) article.appendChild(h('p', { class: 'mp-br__summary', text: item.summary }));
        for (const section of item.sections || []) {
            if (section.h) article.appendChild(h('h2', { class: 'mp-br__h2', text: section.h }));
            article.appendChild(h('p', { class: 'mp-br__p', text: section.p }));
        }
        if (item.links?.length) {
            const links = h('div', { class: 'mp-br__links' }, h('div', { class: 'mp-br__links-label', text: '相关链接' }));
            for (const link of item.links) {
                links.appendChild(h('button', { type: 'button', class: 'mp-br__link', text: link.title, onclick: () => go(link.url || link.title) }));
            }
            article.appendChild(links);
        }
        body.appendChild(article);

        const bring = h('button', { type: 'button', class: 'mp-btn small', onclick: () => {
            setOneShot('【浏览器里看到的内容】\n' + item.title + '\n' + (item.summary || '') + '\n' + (item.sections || []).map(section => section.p).join('\n'));
            toast('已放进下一次正文');
        } }, '带进正文');
        const again = h('button', { type: 'button', class: 'mp-btn small', onclick: () => go(item.title) }, '刷新内容');
        body.appendChild(h('div', { class: 'mp-br__actions' }, bring, again));
    }

    async function go(query) {
        const value = String(query || '').trim();
        if (!value || loading) return;
        loading = true;
        if (page) stack = [...stack.slice(-9), page];
        address = value;
        renderBar();
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'mp-br__loading' }, icon('refresh'), h('span', { text: '正在打开 ' + value })));
        try {
            const item = await browse(value);
            page = item;
            const data = getData();
            data.browser = data.browser || { last: null, history: [] };
            data.browser.last = item;
            data.browser.history = [...new Set([...(data.browser.history || []), value])].slice(-10);
            saveNow('data');
        } catch (error) {
            toast('这个网页打不开', 3000);
        } finally {
            loading = false;
            render();
        }
    }

    render();
    return { refresh: () => render() };
}