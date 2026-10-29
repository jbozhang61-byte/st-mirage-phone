/** 百度贴吧：吧列表 + 帖子，整页详情和评论。 */
import { h, icon, avatar, toast } from '../render.js';
import { getCast, getFeed, setFeed, getData, saveNow } from '../store.js';
import { storyContext } from '../st.js';
import { artFor } from '../art.js';
import { openPostPage } from './postpage.js';
import { openGroupCreate, generateMore } from '../groupgen.js';

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
    const forumsEl = h('div', { class: 'mp-tb__forums' });
    const actionsEl = h('div', { class: 'mp-tb__actions' });
    let selected = '';
    const el = h('div', { class: 'mp-tb' },
        h('div', { class: 'mp-tb__bar' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-tb__logo', text: '贴吧' }),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '新建吧', onclick: () => createForum() }, icon('plus')),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '刷新', onclick: () => refresh() }, icon('refresh')),
        ),
        forumsEl,
        actionsEl,
        body,
    );
    host.appendChild(el);

    function forums() {
        const data = getData();
        const custom = Array.isArray(data.tiebaForums) ? data.tiebaForums.map(item => item.name).filter(Boolean) : [];
        return [...new Set([...FORUMS, ...custom])];
    }

    function paintForums() {
        forumsEl.innerHTML = '';
        const list = [''].concat(forums());
        for (const name of list) {
            forumsEl.appendChild(h('button', {
                type: 'button', class: 'mp-tb__forum' + ((selected || '') === name ? ' on' : ''),
                text: name || '全部',
                onclick: () => { selected = name; paintForums(); render(); },
            }));
        }
    }

    function forumStyle(name) {
        return (getData().tiebaForums || []).find(item => item.name === name)?.style || '';
    }

    async function moreForum(mode) {
        if (!selected) return;
        toast(mode === 'replace' ? '正在重新生成…' : '正在追加…');
        try {
            const result = await generateMore({ kind: 'tieba', name: selected, style: forumStyle(selected), count: mode === 'replace' ? 4 : 3 });
            const cast = getCast();
            const posts = (result.posts || []).map((post, index) => ({
                id: 'tb-' + Date.now().toString(36) + index,
                title: String(post.title || '无题').slice(0, 60),
                text: String(post.text || '').slice(0, 400),
                author: String(post.author || cast[index % Math.max(1, cast.length)]?.name || '旧城的人').slice(0, 24),
                replies: Math.max(0, Number(post.replies) || 0),
                likes: Math.max(0, Number(post.likes) || 0),
                forum: selected,
                image: '',
            }));
            if (!posts.length) { toast('这次没有生成出内容'); return; }
            const cached = getFeed('tieba')?.items || [];
            setFeed('tieba', mode === 'replace' ? [...posts, ...cached.filter(post => post.forum !== selected)] : [...posts, ...cached]);
            render();
            toast(mode === 'replace' ? '已重新生成' : '已追加 ' + posts.length + ' 条');
        } catch (error) {
            toast(String(error?.message || '生成失败'), 3000);
        }
    }

    function createForum() {
        openGroupCreate({
            title: '新建贴吧', kind: 'tieba',
            onCreate: ({ name, style, data: generated }) => {
                const data = getData();
                data.tiebaForums = Array.isArray(data.tiebaForums) ? data.tiebaForums : [];
                if (!data.tiebaForums.some(item => item.name === name)) data.tiebaForums.push({ name, style });
                const cast = getCast();
                const posts = (generated.posts || []).slice(0, 6).map((post, index) => ({
                    id: 'tb-' + Date.now().toString(36) + index,
                    title: String(post.title || '无题').slice(0, 60),
                    text: String(post.text || '').slice(0, 400),
                    author: String(post.author || cast[index % Math.max(1, cast.length)]?.name || '旧城的人').slice(0, 24),
                    replies: Math.max(0, Number(post.replies) || 0),
                    likes: Math.max(0, Number(post.likes) || 0),
                    forum: name,
                    image: '',
                }));
                if (posts.length) {
                    const cached = getFeed('tieba')?.items || [];
                    setFeed('tieba', [...posts, ...cached]);
                }
                saveNow('data');
                selected = name;
                paintForums();
                render();
            },
        });
    }

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
        const posts = load().filter(post => !selected || post.forum === selected);
        actionsEl.innerHTML = '';
        if (selected) {
            actionsEl.append(
                h('button', { type: 'button', text: '重新生成', onclick: () => moreForum('replace') }),
                h('button', { type: 'button', text: '追加', onclick: () => moreForum('append') }),
            );
        }
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

    async function refresh() {
        const target = selected || forums()[0] || '旧城吧';
        toast('正在刷新 ' + target + '…');
        try {
            const result = await generateMore({ kind: 'tieba', name: target, style: forumStyle(target), count: 4 });
            const cast = getCast();
            const posts = (result.posts || []).map((post, index) => ({
                id: 'tb-' + Date.now().toString(36) + index,
                title: String(post.title || '无题').slice(0, 60),
                text: String(post.text || '').slice(0, 400),
                author: String(post.author || cast[index % Math.max(1, cast.length)]?.name || '旧城的人').slice(0, 24),
                replies: Math.max(0, Number(post.replies) || 0),
                likes: Math.max(0, Number(post.likes) || 0),
                forum: target,
                image: '',
            }));
            const cached = getFeed('tieba')?.items || [];
            if (posts.length) setFeed('tieba', [...posts, ...cached]);
            else setFeed('tieba', cached.map(post => ({ ...post, replies: post.replies + Math.floor(Math.random() * 5) })));
            render();
            toast('刷新好了');
        } catch (error) {
            const cached = getFeed('tieba')?.items || [];
            setFeed('tieba', cached.map(post => ({ ...post, replies: post.replies + Math.floor(Math.random() * 9), likes: post.likes + Math.floor(Math.random() * 5) })));
            render();
            toast('AI 没返回，先更新了本地帖子', 2600);
        }
    }

    paintForums();
    render();
    return { refresh: render };
}