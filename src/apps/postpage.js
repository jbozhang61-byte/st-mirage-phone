/** 通用的整页帖子详情：标题、正文、评论区。 */
import { h, icon, toast } from '../render.js';
import { createComments } from './comments.js';

export function openPostPage({ item, app = '帖子', title = '', body = '', meta = '', image = '' }) {
    const screen = document.querySelector('.mp-screen');
    if (!screen) return;
    const chip = screen.querySelector('.mp-backchip');
    if (chip) chip.style.display = 'none';
    const comments = createComments(item, app);
    const input = h('input', { class: 'mp-cm__input', type: 'text', placeholder: '写评论…' });
    const close = () => {
        page.classList.add('is-closing');
        setTimeout(() => { page.remove(); if (chip) chip.style.display = ''; }, 220);
    };
    const page = h('div', { class: 'mp-soc-page' },
        h('div', { class: 'mp-soc-page__bar' },
            h('button', { type: 'button', class: 'mp-soc-page__back', onclick: close }, icon('back')),
            h('div', { class: 'mp-soc-page__title', text: title || '详情' }),
            h('button', { type: 'button', class: 'mp-soc-page__act', onclick: () => comments.refresh() }, icon('refresh')),
        ),
        h('div', { class: 'mp-soc-page__scroll' },
            h('div', { class: 'mp-soc-page__body' },
                image ? h('div', { class: 'mp-soc-page__cover', style: { backgroundImage: image } }) : null,
                meta ? h('div', { class: 'mp-soc-page__author', text: meta }) : null,
                h('div', { class: 'mp-soc-page__text', text: body }),
            ),
            comments.el,
        ),
        h('div', { class: 'mp-soc-page__composer' }, input, h('button', {
            type: 'button', class: 'mp-cm__send',
            onclick: () => { const text = input.value.trim(); if (!text) return; comments.add(text); input.value = ''; toast('已评论'); },
        }, '发送')),
    );
    screen.appendChild(page);
    return { close };
}