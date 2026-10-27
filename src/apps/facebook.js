/** Facebook：蓝色信息流，整页详情 + API 评论。 */
import { h, icon, avatar, timeText, toast } from '../render.js';
import { getCast, getFeed, setFeed, saveNow } from '../store.js';
import { userName, storyContext } from '../st.js';
import { artFor } from '../art.js';
import { openPostPage } from './postpage.js';

const SEED = [
    ['今天旧城的雨停得很晚，路灯下面全是水光。', '刚刚'],
    ['有人知道那家修表铺几点关门吗？灯还亮着。', '12 分钟前'],
    ['把去年的照片翻出来了，原来那天也在下雪。', '1 小时前'],
    ['新到的茶，第一泡有点苦，第二泡刚好。', '3 小时前'],
    ['夜班结束，街上只剩清洁车的声音。', '昨天'],
];

export function mountFacebook(host, { nav }) {
    const body = h('div', { class: 'mp-fb__body' });
    const el = h('div', { class: 'mp-fb' },
        h('div', { class: 'mp-fb__bar' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-fb__logo', text: 'facebook' }),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '刷新', onclick: () => refresh() }, icon('refresh')),
        ),
        body,
    );
    host.appendChild(el);

    function load() {
        const cached = getFeed('facebook')?.items;
        if (cached?.length) return { posts: cached };
        const cast = getCast();
        const names = cast.map(p => p.name);
        const story = storyContext(2, 220).map(s => s.text).join(' ');
        const posts = SEED.map((item, index) => ({
            id: 'fb-' + index,
            author: index === 0 ? (userName() || '我') : (names[index % Math.max(1, names.length)] || '旧城的人'),
            text: item[0],
            time: item[1],
            likes: 12 + ((index * 37) % 180),
            comments: 2 + ((index * 7) % 18),
            image: index % 3 === 1 ? artFor('fb-' + index + story.slice(0, 30), 'night') : '',
        }));
        setFeed('facebook', posts);
        return { posts };
    }

    function render() {
        const data = load();
        body.innerHTML = '';
        for (const post of data.posts) {
            const like = h('button', { type: 'button', class: 'mp-fb__act' + (post.liked ? ' on' : '') }, icon('heart'), h('span', { text: String(post.likes + (post.liked ? 1 : 0)) }));
            like.addEventListener('click', event => {
                event.stopPropagation();
                post.liked = !post.liked;
                like.classList.toggle('on', post.liked);
                like.lastChild.textContent = String(post.likes + (post.liked ? 1 : 0));
            });
            body.appendChild(h('article', {
                class: 'mp-fb__post',
                onclick: () => openPostPage({ item: post, app: 'Facebook', title: post.author, body: post.text, meta: post.time + ' · ' + post.likes + ' 个赞', image: post.image }),
            },
                h('div', { class: 'mp-fb__head' }, avatar({ name: post.author, size: 38 }),
                    h('div', {}, h('div', { class: 'mp-fb__name', text: post.author }), h('div', { class: 'mp-fb__time', text: post.time }))),
                h('div', { class: 'mp-fb__text', text: post.text }),
                post.image ? h('div', { class: 'mp-fb__img', style: { backgroundImage: post.image } }) : null,
                h('div', { class: 'mp-fb__acts' }, like,
                    h('button', { type: 'button', class: 'mp-fb__act', onclick: event => { event.stopPropagation(); openPostPage({ item: post, app: 'Facebook', title: post.author, body: post.text, meta: post.time, image: post.image }); } }, icon('comment'), h('span', { text: String(post.comments) })),
                    h('button', { type: 'button', class: 'mp-fb__act', onclick: event => { event.stopPropagation(); toast('已分享'); } }, icon('share')),
                ),
            ));
        }
    }

    function refresh() {
        toast('正在刷新 Facebook…');
        const data = load();
        const posts = data.posts.map(post => ({ ...post, likes: post.likes + Math.floor(Math.random() * 9) - 4 }));
        setFeed('facebook', posts);
        render();
    }

    render();
    return { refresh: render };
}