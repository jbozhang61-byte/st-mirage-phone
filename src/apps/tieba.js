/** 百度贴吧：吧列表 + 帖子，整页详情和评论。 */
import { h, icon, avatar, toast } from '../render.js';
import { getCast, getFeed, setFeed } from '../store.js';
import { storyContext } from '../st.js';
import { artFor } from '../art.js';
import { openPostPage } from './postpage.js';

const FORUMS = ['旧城吧', '夜班吧', '修表铺吧', '雪天吧', '便利店吧'];

const SEED = [
    ['旧城的雪今年来得早', '门口那盏灯又亮了一整夜，有人知道修表铺几点关门吗？', 42, 18],
    ['凌晨两点还有人醒着吗', '夜班刚下，街上只有清洁车。想找个人说说话。', 128, 36],
    ['求推荐一家不吵的店', '想坐一晚上，有插座，茶不要太贵。', 23, 9],
    ['有人捡到一把黑伞吗', '昨天在钟楼下面，伞柄上有个旧刻痕。', 17, 6],
    ['旧城的老照片', '翻到一张十年前的街景，钟楼还在修。', 64, 22],
    ['雪停之后去哪里', '不想回家，也不想一个人。', 88, 41],
];

export function mountTieba(host, { nav }) {
    const body = h('div', { class: 'mp-tb__body' });
    const el = h('div', { class: 'mp-tb' },
        h('div', { class: 'mp-tb__bar' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-tb__logo', text: '贴吧' }),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '刷新', onclick: () => refresh() }, icon('refresh')),
        ),
        h('div', { class: 'mp-tb__forums' }, ...FORUMS.map((name, i) => h('button', {
            type: 'button', class: 'mp-tb__forum' + (i === 0 ? ' on' : ''), text: name,
            onclick: () => toast('先看 ' + name),
        }))),
        body,
    );
    host.appendChild(el);

    function load() {
        const cached = getFeed('tieba')?.items;
        if (cached?.length) return cached;
        const cast = getCast();
        const story = storyContext(2, 200).map(s => s.text).join(' ');
        const posts = SEED.map((item, index) => ({
            id: 'tb-' + index,
            title: item[0],
            text: item[1],
            author: cast[index % Math.max(1, cast.length)]?.name || '旧城的人',
            replies: item[2],
            likes: item[3],
            forum: FORUMS[index % FORUMS.length],
            image: index % 3 === 0 ? artFor('tb-' + index + story.slice(0, 30), 'snow') : '',
        }));
        setFeed('tieba', posts);
        return posts;
    }

    function render() {
        const posts = load();
        body.innerHTML = '';
        for (const post of posts) {
            body.appendChild(h('article', {
                class: 'mp-tb__post',
                onclick: () => openPostPage({
                    item: post, app: '百度贴吧', title: post.title,
                    body: post.text + '\n\n—— ' + post.author + ' 发布于 ' + post.forum,
                    meta: post.forum + ' · ' + post.replies + ' 回复 · ' + post.likes + ' 赞',
                    image: post.image,
                }),
            },
                h('div', { class: 'mp-tb__forumtag', text: post.forum }),
                h('div', { class: 'mp-tb__title', text: post.title }),
                h('div', { class: 'mp-tb__excerpt', text: post.text }),
                post.image ? h('div', { class: 'mp-tb__img', style: { backgroundImage: post.image } }) : null,
                h('div', { class: 'mp-tb__meta' },
                    avatar({ name: post.author, size: 20 }),
                    h('span', { text: post.author }),
                    h('span', { class: 'mp-tb__dot', text: '·' }),
                    h('span', { text: post.replies + ' 回复' }),
                ),
            ));
        }
    }

    function refresh() {
        toast('正在刷新贴吧…');
        const cached = getFeed('tieba')?.items || [];
        setFeed('tieba', cached.map(post => ({ ...post, replies: post.replies + Math.floor(Math.random() * 5) })));
        render();
    }

    render();
    return { refresh: render };
}
