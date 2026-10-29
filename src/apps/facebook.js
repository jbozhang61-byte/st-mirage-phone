/** Facebook：蓝色信息流，整页详情 + API 评论。 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { getCast, getFeed, setFeed } from '../store.js';
import { userName, storyContext } from '../st.js';
import { artFor } from '../art.js';
import { openPostPage } from './postpage.js';
import { openSearchSheet } from './search-sheet.js';

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
            h('button', { class: 'mp-fb__topbtn', type: 'button', 'aria-label': '搜索', onclick: () => openFbSearch() }, icon('search')),
            h('button', { class: 'mp-fb__topbtn', type: 'button', 'aria-label': '消息', onclick: () => openMessenger() }, icon('message')),
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

    function openMessenger() {
        const cast = getCast();
        const rows = cast.slice(0, 8).map(person => h('div', { class: 'mp-fb__msgrow' },
            avatar({ name: person.name, size: 36 }),
            h('div', {}, h('b', { text: person.name }), h('div', { class: 'mp-fb__msgsub', text: '在 Messenger 上联系' })),
        ));
        sheet({
            title: 'Messenger',
            content: h('div', { class: 'mp-fb__msgs' }, rows.length ? rows : h('div', { class: 'mp-st-hint', text: '通讯录里还没有人。' })),
        });
    }

    function openFbSearch() {
        const data = load();
        openSearchSheet({
            title: '搜索 Facebook',
            placeholder: '搜动态、作者',
            items: data.posts || [],
            textOf: post => [post.author, post.text].join(' '),
            onPick: post => openPostPage({ item: post, app: 'Facebook', title: post.author, body: post.text, meta: post.time + ' · ' + post.likes + ' 个赞' }),
        });
    }

    function render() {
        const data = load();
        body.innerHTML = '';

        // 故事栏
        const cast = getCast();
        const stories = h('div', { class: 'mp-fb__stories' });
        stories.appendChild(h('button', { type: 'button', class: 'mp-fb__story', onclick: () => toast('发故事还没做') },
            h('span', { class: 'mp-fb__storyplus' }, icon('plus')), h('span', { text: '创建故事' })));
        for (const person of cast.slice(0, 6)) {
            stories.appendChild(h('button', { type: 'button', class: 'mp-fb__story', onclick: () => toast('看 ' + person.name + ' 的故事') },
                h('span', { class: 'mp-fb__storyring' }, avatar({ name: person.name, size: 46 })), h('span', { text: person.name })));
        }
        body.appendChild(stories);

        // 发一条
        body.appendChild(h('div', { class: 'mp-fb__composer' },
            avatar({ name: userName() || '我', size: 36 }),
            h('button', { type: 'button', class: 'mp-fb__whats', text: '分享你的新鲜事…', onclick: () => compose() }),
            h('button', { type: 'button', class: 'mp-fb__photobtn', 'aria-label': '照片', onclick: () => toast('照片先欠着') }, icon('image')),
        ));

        // 在线的人
        if (cast.length) {
            const online = h('div', { class: 'mp-fb__online' });
            online.appendChild(h('span', { class: 'mp-fb__onlinelabel', text: '在线' }));
            for (const person of cast.slice(0, 8)) {
                online.appendChild(h('span', { class: 'mp-fb__dot', title: person.name }, avatar({ name: person.name, size: 28 })));
            }
            body.appendChild(online);
        }

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

    function compose() {
        const input = h('textarea', { class: 'mp-input', rows: '4', placeholder: '写点什么…' });
        const dialog = sheet({
            title: '发一条动态',
            content: h('div', { class: 'mp-field-list' }, input),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '发布',
                onclick: () => {
                    const text = input.value.trim();
                    if (!text) return;
                    const data = load();
                    const post = { id: 'fb-' + Date.now(), author: userName() || '我', text, time: '刚刚', likes: 0, comments: 0, image: '' };
                    data.posts.unshift(post);
                    setFeed('facebook', data.posts);
                    dialog.close();
                    render();
                    toast('已发布');
                },
            }),
        });
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