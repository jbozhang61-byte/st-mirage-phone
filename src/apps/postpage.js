/** 通用的整页帖子详情：标题、正文、评论区。 */
import { h, icon, toast } from '../render.js';
import { createComments } from './comments.js';
import { generateImage, imageConfig } from '../imagegen.js';
import { favoriteButton } from '../favorites.js';

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
    let coverEl = image ? h('div', { class: 'mp-soc-page__cover', style: { backgroundImage: image } }) : null;
    async function genImage() {
        if (!imageConfig().enabled) { toast('先在设置里启用 AI 配图并填接口'); return; }
        toast('正在生成配图…');
        try {
            const url = await generateImage((title || '') + '。' + String(body || '').slice(0, 300) + '，电影质感照片');
            item.image = url;
            if (coverEl) coverEl.style.backgroundImage = 'url("' + url + '")';
            else {
                coverEl = h('div', { class: 'mp-soc-page__cover', style: { backgroundImage: 'url("' + url + '")' } });
                page.querySelector('.mp-soc-page__body')?.prepend(coverEl);
            }
            toast('配图已生成');
        } catch (error) {
            toast(String(error?.message || '生成失败'), 3200);
        }
    }
    const page = h('div', { class: 'mp-soc-page' },
        h('div', { class: 'mp-soc-page__bar' },
            h('button', { type: 'button', class: 'mp-soc-page__back', onclick: close }, icon('back')),
            h('div', { class: 'mp-soc-page__title', text: title || '详情' }),
            favoriteButton({ app, item, extra: { title, body, meta, image }, cls: 'mp-soc-page__act' }),
            h('button', { type: 'button', class: 'mp-soc-page__act', 'aria-label': 'AI 配图', onclick: () => genImage() }, icon('sparkle')),
            h('button', { type: 'button', class: 'mp-soc-page__act', onclick: () => comments.refresh() }, icon('refresh')),
        ),
        h('div', { class: 'mp-soc-page__scroll' },
            h('div', { class: 'mp-soc-page__body' },
                coverEl,
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