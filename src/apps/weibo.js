/**
 * 微博：热搜 + 关注动态。
 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { openComments } from './comments.js';
import { openPostPage } from './postpage.js';
import { loadFeed, refreshFeed, num } from './feed-common.js';

export function mountWeibo(host, { nav }) {
    nav.setChrome?.('light');
    let data = { hot: [], posts: [] };
    let loading = false;
    const liked = new Set();

    const el = h('div', { class: 'mp-wb' });
    const body = h('div', { class: 'mp-wb__body' });
    const head = h('div', { class: 'mp-wb__head' },
        h('div', { class: 'mp-wb__brand' }, h('span', { text: '微博' })),
        h('button', { type: 'button', class: 'mp-wb__search', onclick: () => toast('热搜就在下面，先看看这个') },
            icon('search'), h('span', { text: '大家都在搜' })),
        h('button', { type: 'button', class: 'mp-wb__refresh', 'aria-label': '刷新', onclick: () => refresh() }, icon('refresh')),
    );
    el.append(head, body);
    host.appendChild(el);

    function render(next) {
        data = next || { hot: [], posts: [] };
        body.innerHTML = '';

        if (data.hot?.length) {
            const hot = h('div', { class: 'mp-wb__hot' },
                h('div', { class: 'mp-wb__hot-title' }, icon('flame'), h('span', { text: '微博热搜' })),
            );
            data.hot.forEach((item, index) => {
                hot.appendChild(h('div', { class: 'mp-wb__hot-row', onclick: () => toast('这条热搜还没写完') },
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

    function refresh() {
        loading = true;
        toast('正在刷新热搜…');
        refreshFeed('weibo', render, value => { loading = value; });
    }

    loadFeed('weibo', render, value => { loading = value; });
    return { refresh: () => render(data) };
}