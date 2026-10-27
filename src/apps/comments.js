/** 评论区：全部由 API 生成，可换风格、可刷新。 */
import { h, icon, avatar, sheet } from '../render.js';
import { getData, getSettings, saveNow } from '../store.js';
import { userName } from '../st.js';
import { generateComments, friendlyError } from '../ai.js';

function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); }
    return value >>> 0;
}

export function createComments(item, app = '评论') {
    const style = getSettings().ai?.commentStyle || '真实网友';
    const baseKey = 'c_' + hash(app + '|' + style + '|' + String(item.id || item.title || item.text || '')).toString(36);
    let comments = [];
    let loading = false;
    let error = '';

    const head = h('div', { class: 'mp-cm__head' });
    const list = h('div', { class: 'mp-cm__list' });
    const refresh = h('button', { type: 'button', class: 'mp-cm__refresh', 'aria-label': '换一批评论' }, icon('refresh'));

    function key() { return baseKey; }

    function draw() {
        head.innerHTML = '';
        head.append(h('span', { text: (app ? app + ' · ' : '') + (loading ? '正在生成评论…' : error ? '评论生成失败' : comments.length + ' 条评论') }), refresh);
        list.innerHTML = '';
        if (loading) {
            list.appendChild(h('div', { class: 'mp-cm__state' }, h('span', { class: 'mp-cm__dots' }, h('i'), h('i'), h('i')), '正在让模型写评论…'));
            return;
        }
        if (error) {
            list.appendChild(h('div', { class: 'mp-cm__state' }, h('span', { text: error }), h('button', { type: 'button', class: 'mp-cm__retry', text: '重试', onclick: () => load(true) })));
            return;
        }
        for (const comment of comments) {
            list.appendChild(h('div', { class: 'mp-cm__row' },
                avatar({ name: comment.name, size: 30 }),
                h('div', { class: 'mp-cm__main' },
                    h('div', { class: 'mp-cm__name', text: comment.name }),
                    h('div', { class: 'mp-cm__text', text: comment.text }),
                    h('div', { class: 'mp-cm__meta', text: '刚刚 · 回复' }),
                ),
                h('button', { type: 'button', class: 'mp-cm__like', onclick: () => { comment.likes = (comment.likes || 0) + 1; draw(); } }, icon('heart'), String(comment.likes || 0)),
            ));
        }
    }

    async function load(force = false) {
        if (loading) return;
        if (!force) {
            const cached = getData().comments?.[key()];
            if (Array.isArray(cached) && cached.length) { comments = cached; draw(); return; }
        }
        loading = true;
        error = '';
        draw();
        try {
            const next = await generateComments(item, app);
            comments = next;
            const data = getData();
            data.comments = data.comments || {};
            data.comments[key()] = next;
            saveNow('data');
        } catch (err) {
            error = friendlyError(err);
        } finally {
            loading = false;
            draw();
        }
    }

    refresh.addEventListener('click', () => load(true));
    draw();
    load();

    return {
        el: h('div', { class: 'mp-cm' }, head, list),
        refresh: () => load(true),
        add: text => { comments.unshift({ name: userName() || '我', text, likes: 0 }); draw(); },
    };
}

export function openComments(item, app = '评论') {
    const panel = createComments(item, app);
    const input = h('input', { type: 'text', placeholder: '说点什么…', class: 'mp-cm__input' });
    const send = () => {
        const text = input.value.trim();
        if (!text) return;
        panel.add(text);
        input.value = '';
    };
    sheet({ title: '评论', content: h('div', {}, panel.el, h('div', { class: 'mp-cm__composer' }, input, h('button', { type: 'button', class: 'mp-cm__send', onclick: send }, '发送'))) });
    setTimeout(() => input.focus?.(), 200);
}