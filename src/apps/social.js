/** 六个社交 App 的界面：同一套骨架，按 App 换布局。 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { num, moodOf, feedContext, bindAutoMore, showPill } from './feed-common.js';
import { SOCIAL } from '../social.js';
import { generateSocial, friendlyError } from '../ai.js';
import { getCast, getFeed, setFeed, saveNow, getData } from '../store.js';
import { openProfile } from './profile.js';
import { userName, personaAvatarUrl } from '../st.js';
import { artFor } from '../art.js';
import { cachedImage, warmImages } from '../imagegen.js';
import { openVideo } from './video.js';
import { openComments, createComments } from './comments.js';

export function mountSocial(appId) {
    return (host, { nav }) => mount(host, nav, appId);
}

function mount(host, nav, appId) {
    const config = SOCIAL[appId];
    const dark = appId === 'x';
    const meta = {
        x: { color: '#0f1419' }, instagram: { color: '#c13584' }, reddit: { color: '#ff4500' },
        zhihu: { color: '#0066ff' }, quora: { color: '#b92b27' }, youtube: { color: '#ff0000' },
    }[appId] || { color: '#333' };
    nav.setChrome?.(dark ? 'dark' : 'light');
    let items = [];
    let loading = false;

    const el = h('div', { class: 'mp-soc' + (dark ? ' is-dark' : '') });
    const body = h('div', { class: 'mp-soc__body' });
    const head = h('div', { class: 'mp-soc__head' },
        h('div', { class: 'mp-soc__brand', style: { color: meta.color }, text: config.name }),
        h('div', { class: 'mp-soc__tools' },
            h('button', { type: 'button', class: 'mp-soc__me', 'aria-label': '个人主页', onclick: () => openProfile(appId, items) }, avatar({ name: userName() || '我', size: 24, src: personaAvatarUrl() })),
            ['x', 'reddit', 'zhihu', 'quora'].includes(appId) ? h('button', { type: 'button', class: 'mp-soc__refresh', 'aria-label': '发帖', onclick: () => openComposer() }, icon('plus')) : null,
            h('button', { type: 'button', class: 'mp-soc__refresh', 'aria-label': '刷新', onclick: () => refresh('replace') }, icon('refresh')),
        ),
    );
    el.append(head, body);
    host.appendChild(el);
    window.addEventListener('mp-image', applyImages);

    function imgKey(item) { return String(item.id || item.author || item.text || '').slice(0, 80); }
    function imageFor(item) { return cachedImage(imgKey(item)) || artFor(item.id + item.author + item.text, moodOf(item)); }
    function applyImages() {
        body.querySelectorAll('[data-imgkey]').forEach(node => {
            const url = cachedImage(node.dataset.imgkey);
            if (url) node.style.backgroundImage = url;
        });
    }

    function render(list) {
        items = Array.isArray(list) ? list : [];
        body.innerHTML = '';
        if (appId === 'x') body.appendChild(timeline());
        else if (appId === 'instagram') body.appendChild(gallery());
        else if (appId === 'reddit') body.appendChild(threads());
        else if (appId === 'youtube') body.appendChild(videos());
        else body.appendChild(qa());
        if (!items.length) body.appendChild(h('div', { class: 'mp-soc__empty', text: '这里还空着，点右上角刷新。' }));
        if (appId === 'instagram' || appId === 'youtube') warmImages(items, item => [item.author, item.title, item.text].filter(Boolean).join('，'), 2);
    }

    function timeline() {
        const wrap = h('div', { class: 'mp-soc__list' });
        for (const item of items) {
            wrap.appendChild(h('div', { class: 'mp-soc__post', onclick: () => openDetailPage(item) },
                avatar({ name: item.author, size: 38 }),
                h('div', { class: 'mp-soc__main' },
                    h('div', { class: 'mp-soc__line' }, h('b', { text: item.author }), h('span', { class: 'mp-soc__handle', text: item.handle + ' · ' + item.time })),
                    h('div', { class: 'mp-soc__text', text: item.text }),
                    h('div', { class: 'mp-soc__acts' },
                        h('span', {}, icon('comment'), num(item.reposts)), h('span', {}, icon('refresh'), num(item.likes)), h('span', {}, icon('heart'), num(item.comments))),
                ),
            ));
        }
        return wrap;
    }

    function addStory() {
        const input = h('textarea', { class: 'mp-input', rows: '3', placeholder: '发一张今天的照片…' });
        const dialog = sheet({
            title: '你的故事',
            content: h('div', { class: 'mp-field-list' }, input),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '发布',
                onclick: () => {
                    const text = input.value.trim();
                    if (!text) { toast('写点什么'); return; }
                    const data = getData();
                    data.socialStories = data.socialStories || {};
                    data.socialStories[appId] = [...(data.socialStories[appId] || []), { text: text.slice(0, 300), ts: Date.now() }].slice(-20);
                    saveNow('data');
                    dialog.close();
                    toast('故事已发布');
                },
            }),
        });
    }

    function viewStory(person) {
        const story = (getData().socialStories?.[appId] || []).slice(-1)[0];
        sheet({
            title: person?.name + ' 的故事',
            content: h('div', { class: 'mp-fb__storyview' },
                avatar({ name: person?.name || '某人', size: 54 }),
                h('div', { class: 'mp-fb__storytext', text: story?.text || '今天的光很好，拍下来给你看。' }),
                h('div', { class: 'mp-st-hint', text: '24 小时后消失' }),
            ),
        });
    }

    function gallery() {
        // 单列大卡片：比三列图墙省性能，也更像 Instagram 的时间线
        const wrap = h('div', { class: 'mp-soc__igfeed' });
        const cast = getCast();
        const stories = h('div', { class: 'mp-soc__stories' });
        stories.appendChild(h('div', { class: 'mp-soc__story', onclick: () => addStory() },
            avatar({ name: userName() || '我', size: 52 }), h('span', { text: '你的故事' })));
        for (const person of cast.slice(0, 6)) {
            stories.appendChild(h('div', { class: 'mp-soc__story', onclick: () => viewStory(person) },
                h('span', { class: 'mp-soc__ring' }, avatar({ name: person.name, size: 52 })), h('span', { text: person.name })));
        }
        wrap.appendChild(stories);
        for (const item of items.slice(0, 4)) {
            wrap.appendChild(h('article', { class: 'mp-soc__igcard' },
                h('div', { class: 'mp-soc__ighead' }, avatar({ name: item.author, size: 26 }), h('b', { text: item.author })),
                h('div', { class: 'mp-soc__igcover', 'data-imgkey': imgKey(item), 'data-mood': moodOf(item), style: { backgroundImage: imageFor(item) }, onclick: () => openDetailPage(item) }),
                h('div', { class: 'mp-soc__igbody' },
                    h('div', { class: 'mp-soc__igacts' },
                        (() => {
                            const heart = h('button', { type: 'button', class: 'mp-soc__igact' + (item.liked ? ' on' : '') }, icon('heart'), h('span', { text: num(item.likes + (item.liked ? 1 : 0)) }));
                            heart.addEventListener('click', () => {
                                item.liked = !item.liked;
                                heart.classList.toggle('on', item.liked);
                                heart.lastChild.textContent = num(item.likes + (item.liked ? 1 : 0));
                            });
                            return heart;
                        })(),
                        h('button', { type: 'button', class: 'mp-soc__igact', onclick: () => openDetailPage(item) }, icon('comment'), h('span', { text: num(item.comments) })),
                        h('button', { type: 'button', class: 'mp-soc__igact', onclick: () => toast('已收藏') }, icon('star')),
                    ),
                    h('div', { class: 'mp-soc__igcap' }, h('b', { text: item.author + ' ' }), item.text),
                ),
            ));
        }
        return wrap;
    }

    function openPost(item) {
        const image = imageFor(item);
        const s = sheet({ title: '', content: h('div', { class: 'mp-soc__detail' },
            h('div', { class: 'mp-soc__detail-cover', style: { backgroundImage: image } }),
            h('div', { class: 'mp-soc__detail-text', text: item.text }),
            h('div', { class: 'mp-soc__detail-foot' },
                h('span', { text: '♥ ' + num(item.likes) }),
                h('button', { type: 'button', class: 'mp-soc__detail-btn', onclick: () => openComments(item, 'Instagram') }, '💬 ' + num(item.comments) + ' 条评论'),
            ),
        ) });
        return s;
    }

    function threads() {
        const wrap = h('div', { class: 'mp-soc__list' });
        for (const item of items) {
            wrap.appendChild(h('div', { class: 'mp-soc__thread', onclick: () => openDetailPage(item) },
                h('div', { class: 'mp-soc__votes' }, h('span', { text: '▲' }), h('b', { text: num(item.votes) }), h('span', { text: '▼' })),
                h('div', { class: 'mp-soc__main' },
                    h('div', { class: 'mp-soc__sub', text: item.sub || 'r/all' }),
                    h('div', { class: 'mp-soc__title', text: item.title || item.text }),
                    h('div', { class: 'mp-soc__meta', text: item.author + ' · ' + num(item.comments) + ' 条评论' }),
                ),
            ));
        }
        return wrap;
    }

    function qa() {
        const wrap = h('div', { class: 'mp-soc__list' });
        for (const item of items) {
            wrap.appendChild(h('div', { class: 'mp-soc__qa', onclick: () => openDetailPage(item) },
                h('div', { class: 'mp-soc__title', text: item.title || item.text }),
                h('div', { class: 'mp-soc__text', text: item.text }),
                h('div', { class: 'mp-soc__meta', text: num(item.answers) + ' 个回答 · ' + num(item.votes) + ' 赞同' }),
            ));
        }
        return wrap;
    }

    function openDetailPage(item) {
        const comments = createComments(item, config.name);
        const chip = document.querySelector('.mp-backchip');
        if (chip) chip.style.display = 'none';
        const closePage = () => { page.remove(); if (chip) chip.style.display = ''; };
        const input = h('input', { class: 'mp-cm__input', type: 'text', placeholder: '写评论…' });
        comments.setQuoter?.(quote => { input.value = quote; input.focus?.(); });
        const page = h('div', { class: 'mp-soc-page' },
            h('div', { class: 'mp-soc-page__bar' },
                h('button', { type: 'button', class: 'mp-soc-page__back', onclick: closePage }, icon('back')),
                h('div', { class: 'mp-soc-page__title', text: item.title || '详情' }),
                h('button', { type: 'button', class: 'mp-soc-page__act', onclick: () => comments.refresh() }, icon('refresh')),
            ),
            h('div', { class: 'mp-soc-page__scroll' },
                h('div', { class: 'mp-soc-page__body' },
                    appId === 'instagram' ? h('div', { class: 'mp-soc-page__cover', style: { backgroundImage: imageFor(item) } }) : null,
                    h('div', { class: 'mp-soc-page__author', text: item.author || '' }),
                    h('h2', { class: 'mp-soc-page__h', text: item.title || item.text }),
                    h('div', { class: 'mp-soc-page__text', text: item.text }),
                    h('div', { class: 'mp-soc__meta', text: (item.time || '刚刚') + ' · ' + num(item.votes || item.answers || item.likes || 0) + ' 喜欢' }),
                    h('div', { class: 'mp-soc-page__acts' },
                        item.video ? h('button', { type: 'button', class: 'mp-soc__detail-btn', onclick: () => openVideo(item) }, '▶ 播放') : null,
                        item.author ? h('button', {
                            type: 'button', class: 'mp-soc__detail-btn',
                            text: (getData().follows || {})[item.author] ? '已关注' : '关注',
                            onclick: event => {
                                const data = getData();
                                data.follows = data.follows && typeof data.follows === 'object' ? data.follows : {};
                                if (data.follows[item.author]) delete data.follows[item.author];
                                else data.follows[item.author] = Date.now();
                                saveNow('data');
                                event.currentTarget.textContent = data.follows[item.author] ? '已关注' : '关注';
                                toast(data.follows[item.author] ? '已关注 ' + item.author : '已取消关注');
                            },
                        }) : null,
                        h('button', { type: 'button', class: 'mp-soc__detail-btn', onclick: () => toast('已点赞') }, '♥ 赞'),
                        h('button', { type: 'button', class: 'mp-soc__detail-btn', onclick: () => comments.refresh() }, '换评论'),
                        h('button', { type: 'button', class: 'mp-soc__detail-btn', onclick: () => toast('已收藏') }, '收藏'),
                    ),
                ),
                comments.el,
            ),
            h('div', { class: 'mp-soc-page__composer' }, input, h('button', {
                type: 'button', class: 'mp-cm__send',
                onclick: () => { const text = input.value.trim(); if (!text) return; comments.add(text); input.value = ''; toast('已评论'); },
            }, '发送')),
        );
        el.appendChild(page);
    }

    function openDetailSheet(item) {
        sheet({
            title: item.title || '帖子',
            content: h('div', { class: 'mp-soc__detail' },
                h('div', { class: 'mp-soc__detail-text', text: item.text }),
                h('div', { class: 'mp-soc__meta', text: (item.author || '') + ' · ' + (item.time || '刚刚') + ' · ' + num(item.votes || item.answers) + ' 赞同' }),
                h('div', { class: 'mp-soc__detail-actions' },
                    h('button', { type: 'button', class: 'mp-soc__detail-btn', onclick: () => { item.votes = (item.votes || 0) + 1; saveNow('data'); toast('已赞同'); } }, '赞同 ' + num(item.votes || 0)),
                    h('button', { type: 'button', class: 'mp-soc__detail-btn', onclick: () => openComments(item, config.name) }, '评论 ' + num(item.comments || item.answers || 0)),
                ),
            ),
        });
    }

    function openComposer() {
        const title = h('input', { class: 'mp-input', type: 'text', placeholder: appId === 'x' ? '发一条动态…' : '标题' });
        const text = h('textarea', { class: 'mp-input', rows: '4', placeholder: appId === 'x' ? '正文（可留空）' : '正文 / 回答' });
        const sub = appId === 'reddit' ? h('input', { class: 'mp-input', type: 'text', placeholder: '板块，如 r/旧城' }) : null;
        const s = sheet({
            title: appId === 'x' ? '发动态' : '发帖',
            content: h('div', { class: 'mp-field-list' }, title, text, sub),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '发布',
                onclick: () => {
                    const body = text.value.trim();
                    if (!title.value.trim() && !body) { toast('写点什么再发'); return; }
                    items.unshift({
                        id: appId + '-mine-' + Date.now(),
                        author: userName() || '我',
                        title: title.value.trim() || body.slice(0, 40),
                        text: body || title.value.trim(),
                        sub: sub?.value.trim() || 'r/mine',
                        time: '刚刚',
                        votes: 0,
                        answers: 0,
                        comments: 0,
                        likes: 0,
                    });
                    setFeed(appId, items);
                    saveNow('data');
                    s.close();
                    render(items);
                    toast('已发布');
                },
            }),
        });
    }

    function videos() {
        const grid = h('div', { class: 'mp-soc__videos' });
        for (const item of items) {
            grid.appendChild(h('div', { class: 'mp-soc__video', onclick: () => openVideo(item, { app: 'YouTube' }) },
                h('div', { class: 'mp-soc__vcover', 'data-imgkey': imgKey(item), 'data-mood': moodOf(item), style: { backgroundImage: imageFor(item) } },
                    h('span', { class: 'mp-soc__vplay' }, icon('play', '', 22)),
                    h('span', { class: 'mp-soc__vdur', text: item.duration })),
                h('div', { class: 'mp-soc__vtitle', text: item.title || item.text }),
                h('div', { class: 'mp-soc__meta', text: item.author + ' · ' + item.views + ' 次观看' }),
            ));
        }
        return grid;
    }

    /** mode='replace' 是刷新按钮（整页重新生成）；默认 'append' 是下滑加载。 */
    function refresh(mode = 'append') {
        const replace = mode === 'replace';
        if (loading) return;
        loading = true;
        let cancelled = false;
        const pill = showPill('正在加载更多…', {
            spinner: true,
            timeout: 15000,
            action: { text: '取消', onClick: () => { cancelled = true; toast('已取消这次加载'); } },
        });
        generateSocial(appId)
            .then(next => {
                if (cancelled) return;
                if (replace) {
                    const fresh = Array.isArray(next) ? next : [];
                    try { setFeed(appId, fresh); } catch { /* ignore */ }
                    render(fresh);
                    toast('已重新生成 ' + fresh.length + ' 条');
                    return;
                }
                // 追加，不覆盖：原来刷出来的帖子一条不删
                const seen = new Set(items.map(item => item && (item.id || item.title || item.text)));
                const added = (Array.isArray(next) ? next : []).filter(item => {
                    const key = item && (item.id || item.title || item.text);
                    if (!key || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                const merged = [...items, ...added];
                try { setFeed(appId, merged); } catch { /* ignore */ }
                render(merged);
                toast('又来了 ' + added.length + ' 条');
            })
            .catch(error => {
                if (cancelled) return;
                toast(friendlyError(error), 3200);
                // 模型不通时也补几条本地内容，别让"加载更多"毫无反应
                const fallback = config.fallback(feedContext());
                const seen = new Set(items.map(item => item && (item.id || item.title || item.text)));
                const added = (Array.isArray(fallback) ? fallback : []).filter(item => {
                    const key = item && (item.id || item.title || item.text);
                    if (!key || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                if (added.length) {
                    const merged = [...items, ...added];
                    try { setFeed(appId, merged); } catch { /* ignore */ }
                    render(merged);
                }
            })
            .finally(() => {
                try { pill.close(); } catch { /* ignore */ }
                loading = false;
            });
    }

    const cached = getFeed(appId);
    if (cached?.items) render(cached.items);
    else {
        render(config.fallback(feedContext()));
        generateSocial(appId).then(render).catch(error => toast(friendlyError(error), 3000));
    }
    bindAutoMore(body, () => refresh('append'));
    return { refresh: () => render(items), destroy: () => window.removeEventListener('mp-image', applyImages) };
}