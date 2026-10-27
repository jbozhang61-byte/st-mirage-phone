/**
 * 朋友圈：角色会根据剧情发动态，你也能发，好友会来点赞评论。
 */
import { h, icon, avatar, relativeText, sheet, toast } from '../render.js';
import { getData, getSettings, addMoment, saveNow } from '../store.js';
import { characterAvatar, personaAvatarUrl, userName, currentCharacter } from '../st.js';
import { generateMoments, commentOnMoment, friendlyError } from '../ai.js';

export function mountMoments(host, { nav }) {
    const list = h('div', { class: 'mp-body' });
    const head = h('div', { class: 'mp-nav' },
        h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
        h('div', { class: 'mp-nav__title' }, '朋友圈', h('small', { text: 'MOMENTS' })),
        h('div', { class: 'mp-nav__spacer' }),
        h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '换一批', onclick: () => refreshFeed() }, icon('sparkle')),
        h('button', { class: 'mp-nav__btn accent', type: 'button', 'aria-label': '发动态', onclick: () => compose() }, icon('plus')),
    );
    const el = h('div', { class: 'mp-moments' }, head, list);
    host.appendChild(el);

    let busy = false;

    function markSeen() {
        const data = getData();
        data.meta.momentsSeen = Date.now();
        saveNow('data');
    }

    function render() {
        const data = getData();
        const keep = list.scrollTop;
        list.innerHTML = '';

        // 封面
        const cover = h('div', { class: 'mp-moments__cover' });
        list.appendChild(cover);

        const me = h('div', { class: 'mp-user-card' },
            avatar({ name: userName(), src: personaAvatarUrl(), size: 62, cls: 'mp-user-card__avatar' }),
            h('div', {},
                h('div', { class: 'mp-user-card__name', text: userName() }),
                h('div', { class: 'mp-user-card__sig', text: getSettings().signature || '这是你的朋友圈' }),
            ),
        );
        list.appendChild(me);

        const feed = h('div', { class: 'mp-feed' });
        if (!data.moments.length) {
            feed.appendChild(h('div', { class: 'mp-empty', style: { padding: '34px 20px' } },
                h('div', { class: 'mp-empty__icon' }, icon('moments')),
                h('div', { class: 'mp-empty__title', text: '朋友圈还很安静' }),
                h('div', { class: 'mp-empty__text', text: '让角色根据最近的剧情发几条动态，或者你先说点什么。' }),
                h('button', { class: 'mp-btn primary', type: 'button', text: busy ? '生成中…' : '生成几条动态', onclick: () => refreshFeed() }),
            ));
        }
        for (const moment of data.moments) feed.appendChild(postEl(moment));
        list.appendChild(feed);
        list.scrollTop = keep;
        markSeen();
    }

    function postEl(moment) {
        const liked = moment.likes.includes(userName());
        const act = h('div', { class: 'mp-post__actions' });
        act.append(
            h('button', {
                class: 'mp-post__act' + (liked ? ' liked' : ''), type: 'button',
                onclick: () => toggleLike(moment),
            }, icon('heart'), liked ? '已赞' : '赞'),
            h('button', { class: 'mp-post__act', type: 'button', onclick: () => commentSheet(moment) }, icon('comment'), '评论'),
        );

        const body = h('div', { class: 'mp-post' },
            h('div', { class: 'mp-post__head' },
                avatar({ name: moment.author, src: moment.mine ? personaAvatarUrl() : characterAvatar(moment.author), size: 38 }),
                h('div', { class: 'mp-post__who' },
                    h('div', { class: 'mp-post__name', text: moment.author }),
                    h('div', { class: 'mp-post__time', text: relativeText(moment.ts) }),
                ),
                moment.mine ? h('span', { class: 'mp-pill', text: '我' }) : null,
            ),
            h('div', { class: 'mp-post__text', text: moment.text }),
        );
        if (moment.likes.length) {
            body.appendChild(h('div', { class: 'mp-post__likes' }, icon('heart'),
                h('span', { text: moment.likes.join('、') })));
        }
        if (moment.comments.length) {
            const box = h('div', { class: 'mp-post__comments' });
            for (const comment of moment.comments) {
                box.appendChild(h('div', { class: 'mp-comment' },
                    h('b', { text: comment.by + '：' }),
                    h('span', { text: comment.text }),
                ));
            }
            body.appendChild(box);
        }
        body.appendChild(act);
        return body;
    }

    function toggleLike(moment) {
        const name = userName();
        const index = moment.likes.indexOf(name);
        if (index >= 0) moment.likes.splice(index, 1);
        else moment.likes.push(name);
        saveNow('data');
        render();
    }

    function commentSheet(moment) {
        const input = h('input', { class: 'mp-input', type: 'text', placeholder: '说点什么…' });
        const s = sheet({
            title: '评论', content: h('div', { class: 'mp-field-list' }, input),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '发送',
                onclick: () => {
                    const text = input.value.trim();
                    if (!text) return;
                    moment.comments.push({ id: Math.random().toString(36).slice(2, 10), by: userName(), text, ts: Date.now() });
                    saveNow('data');
                    s.close();
                    render();
                    charCommentBack(moment, text);
                },
            }),
        });
        setTimeout(() => input.focus(), 200);
    }

    async function charCommentBack(moment, myComment) {
        try {
            const data = getData();
            const author = moment.author;
            const raw = await commentOnMoment(moment.id);
            if (raw.comments.length) {
                toast(author + ' 回复了你');
                render();
            }
        } catch { /* 评论失败不打扰 */ }
    }

    function compose() {
        const area = h('textarea', { class: 'mp-input', rows: '4', placeholder: '这一刻的想法…' });
        const s = sheet({
            title: '发朋友圈',
            content: h('div', { class: 'mp-field-list' }, area, h('div', { class: 'mp-st-hint', text: '发出去之后，好友会来点赞和评论。' })),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '发表',
                onclick: () => {
                    const text = area.value.trim();
                    if (!text) return;
                    s.close();
                    const moment = addMoment({ author: userName(), text, mine: true });
                    render();
                    if (moment) charCommentBack(moment, text);
                },
            }),
        });
        setTimeout(() => area.focus(), 200);
    }

    async function refreshFeed() {
        if (busy) return;
        busy = true;
        toast('正在生成新的动态…');
        try {
            await generateMoments(3);
            toast('朋友圈更新了');
        } catch (error) {
            toast(friendlyError(error), 3400);
        } finally {
            busy = false;
            render();
        }
    }

    render();
    return { refresh: render };
}