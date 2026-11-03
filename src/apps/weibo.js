/**
 * 微博：热搜 + 关注动态。
 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { openComments } from './comments.js';
import { openPostPage } from './postpage.js';
import { loadFeed, refreshFeed, bindAutoMore, num } from './feed-common.js';
import { generateGossip } from '../ai.js';
import { getData, saveNow } from '../store.js';
import { openSearchSheet } from './search-sheet.js';

export function mountWeibo(host, { nav }) {
    nav.setChrome?.('light');
    let data = { hot: [], posts: [] };
    let loading = false;
    let tab = 'feed';          // feed | gossip
    let gossipBusy = false;
    const liked = new Set();

    const el = h('div', { class: 'mp-wb' });
    const body = h('div', { class: 'mp-wb__body' });
    const head = h('div', { class: 'mp-wb__head' },
        h('div', { class: 'mp-wb__brand' }, h('span', { text: '微博' })),
        h('button', { type: 'button', class: 'mp-wb__search', onclick: () => openSearch() },
            icon('search'), h('span', { text: '大家都在搜' })),
        h('button', { type: 'button', class: 'mp-wb__refresh', 'aria-label': '刷新', onclick: () => refresh() }, icon('refresh')),
    );
    const tabBar = h('div', { class: 'mp-wb__tabs' });
    const setTab = value => {
        tab = value;
        tabBar.querySelectorAll('.mp-wb__tab').forEach(node => {
            node.classList.toggle('on', node.dataset.tab === value);
        });
        render(data);
    };
    tabBar.append(
        h('button', { type: 'button', class: 'mp-wb__tab on', 'data-tab': 'feed', text: '动态', onclick: () => setTab('feed') }),
        h('button', { type: 'button', class: 'mp-wb__tab', 'data-tab': 'gossip', text: '八卦', onclick: () => setTab('gossip') }),
    );
    el.append(head, tabBar, body);
    host.appendChild(el);

    function render(next) {
        data = next || { hot: [], posts: [] };
        body.innerHTML = '';
        if (tab === 'gossip') { renderGossip(); return; }

        if (data.hot?.length) {
            const hot = h('div', { class: 'mp-wb__hot' },
                h('div', { class: 'mp-wb__hot-title' }, icon('flame'), h('span', { text: '微博热搜' })),
            );
            data.hot.forEach((item, index) => {
                hot.appendChild(h('div', { class: 'mp-wb__hot-row', onclick: () => openHot(item) },
                    h('span', { class: 'mp-wb__rank' + (index < 3 ? ' top' : ''), text: String(index + 1) }),
                    h('span', { class: 'mp-wb__hot-name', text: item.title }),
                    item.tag ? h('span', { class: 'mp-wb__tag ' + item.tag, text: item.tag }) : null,
                    h('span', { class: 'mp-wb__heat', text: item.heat }),
                ));
            });
            body.appendChild(hot);
        }

        const list = h('div', { class: 'mp-wb__feed' });
        for (const post of data.posts || []) list.appendChild(postEl(post));
        if (!data.posts?.length) {
            list.appendChild(h('div', { class: 'mp-wb__empty', text: '还没有动态，点右上角刷新。' }));
        }
        body.appendChild(list);
    }

    /** 八卦区：读最近的正文，生成一堆爆料帖。 */
    function renderGossip() {
        const wrap = h('div', { class: 'mp-wb__gossip' });
        const saved = getData().gossip;
        const items = Array.isArray(saved?.items) ? saved.items : [];
        wrap.appendChild(h('div', { class: 'mp-wb__gossip-head' },
            h('div', {},
                h('div', { class: 'mp-wb__gossip-title', text: '八卦区' }),
                h('div', { class: 'mp-wb__gossip-sub', text: '根据最近的正文，听听大家在传什么' })),
            h('button', {
                type: 'button', class: 'mp-wb__gossip-btn', text: gossipBusy ? '正在打听…' : (items.length ? '换一批' : '听听新瓜'),
                onclick: () => loadGossip(),
            }),
        ));
        if (!items.length) {
            wrap.appendChild(h('div', { class: 'mp-wb__empty', text: '还没有瓜。点右上「听听新瓜」，会照最近的正文写一批。' }));
        }
        for (const post of items) {
            wrap.appendChild(h('div', { class: 'mp-wb__gossip-card', onclick: () => openPostPage({
                item: post, app: '微博', title: post.title,
                body: post.text, meta: '@' + post.author + ' · ' + (post.hot || '') + ' · 刚刚',
            }) },
                h('div', { class: 'mp-wb__gossip-line' },
                    h('span', { class: 'mp-wb__gossip-author', text: '@' + post.author }),
                    h('span', { class: 'mp-wb__hot-tag', text: post.hot || '' })),
                h('div', { class: 'mp-wb__gossip-name', text: post.title }),
                h('div', { class: 'mp-wb__gossip-text', text: post.text }),
            ));
        }
        body.appendChild(wrap);
    }

    async function loadGossip() {
        if (gossipBusy) return;
        gossipBusy = true;
        renderGossip();
        try {
            const list = await generateGossip({ app: '微博' });
            const previous = Array.isArray(getData().gossip?.items) ? getData().gossip.items : [];
            const seen = new Set(previous.map(item => item.title + item.text));
            const added = list.filter(item => !seen.has(item.title + item.text));
            const merged = [...added, ...previous].slice(0, 60);
            const data2 = getData();
            data2.gossip = { items: merged, at: Date.now() };
            saveNow('data');
            toast('又听到 ' + added.length + ' 条');
        } catch (error) {
            toast('这次没打听到什么', 2600);
        } finally {
            gossipBusy = false;
            render(data);
        }
    }

    function postEl(post) {
        const isLiked = liked.has(post.id);
        const likeCount = h('span', { text: num(post.likes + (isLiked ? 1 : 0)) });
        const likeBtn = h('button', {
            type: 'button', class: 'mp-wb__act' + (isLiked ? ' liked' : ''),
            onclick: () => {
                if (liked.has(post.id)) liked.delete(post.id);
                else liked.add(post.id);
                likeBtn.classList.toggle('liked');
                likeCount.textContent = num(post.likes + (liked.has(post.id) ? 1 : 0));
            },
        }, icon('heart'), likeCount);

        const openDetail = event => {
            if (event?.target?.closest?.('.mp-wb__acts, button')) return;
            openPostPage({ item: post, app: '微博', title: '@' + post.author, body: post.text + (post.topic ? '\n\n' + post.topic : ''), meta: (post.time || '刚刚') + ' · ' + num(post.comments || 0) + ' 条评论' });
        };
        return h('div', { class: 'mp-wb__post', onclick: openDetail },
            avatar({ name: post.author, src: '', size: 40 }),
            h('div', { class: 'mp-wb__main' },
                h('div', { class: 'mp-wb__line' },
                    h('span', { class: 'mp-wb__name', text: post.author }),
                    h('span', { class: 'mp-wb__time', text: post.time }),
                ),
                h('div', { class: 'mp-wb__text', text: post.text }),
                post.topic ? h('div', { class: 'mp-wb__topic', text: post.topic }) : null,
                h('div', { class: 'mp-wb__acts' },
                    likeBtn,
                    h('button', { type: 'button', class: 'mp-wb__act', onclick: () => openComments(post, '微博') }, icon('comment'), h('span', { text: num(post.comments) })),
                    h('button', { type: 'button', class: 'mp-wb__act', onclick: () => repost(post) }, icon('share'), h('span', { text: num(post.reposts) })),
                ),
            ),
        );
    }

    function repost(post) {
        const input = h('textarea', { class: 'mp-input', rows: '3', placeholder: '说点什么…' });
        const s = sheet({
            title: '转发微博',
            content: h('div', { class: 'mp-field-list' },
                h('div', { class: 'mp-wb__quote', text: '@' + post.author + '：' + post.text }),
                input,
            ),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '转发',
                onclick: () => {
                    post.reposts = (post.reposts || 0) + 1;
                    post.text = String(input.value || '').trim() ? input.value.trim() + ' //@' + post.author + '：' + post.text : post.text;
                    s.close();
                    toast('已转发');
                    render(items);
                },
            }),
        });
    }

    /** 热搜点开：没有对应帖子也照样能打开整页（本地兜底 + 评论区）。 */
    function openHot(item) {
        const topic = String(item?.title || '热搜');
        const related = (data.posts || []).find(post => String(post.text || '').includes(topic) || String(post.topic || '').includes(topic));
        const body = related?.text
            ? related.text + '\n\n#' + topic + '#'
            : '关于「' + topic + '」的讨论今天突然多了起来。\n有人说在旧城见过相关的事，也有人说只是营销号在带节奏，评论区分成了两派。\n\n#' + topic + '#';
        openPostPage({
            item: related || { title: topic, text: body, id: 'hot-' + topic },
            app: '微博',
            title: '#' + topic + '#',
            body,
            meta: '热搜 · ' + (item?.heat || '') + ' · 刚刚',
            image: related?.image || '',
        });
    }

    function openSearch(initial = '') {
        openSearchSheet({
            title: '搜索微博',
            placeholder: '搜动态、作者、话题',
            items: data.posts || [],
            initial,
            textOf: item => [item.author, item.text, item.topic].join(' '),
            onPick: post => openPostPage({ item: post, app: '微博', title: '@' + post.author, body: post.text + (post.topic ? '\n\n' + post.topic : ''), meta: (post.time || '刚刚') + ' · ' + num(post.comments || 0) + ' 条评论' }),
        });
    }

    function refresh() {
        loading = true;
        toast('正在刷新热搜…');
        // 刷新按钮：整页重新生成
    refreshFeed('weibo', render, value => { loading = value; }, { replace: true });
    }

    loadFeed('weibo', render, value => { loading = value; });
    // 下滑到底：追加，不覆盖
    bindAutoMore(body, () => {
        if (loading) return;
        loading = true;
        refreshFeed('weibo', render, value => { loading = value; });
    });
    return { refresh: () => render(data) };
}