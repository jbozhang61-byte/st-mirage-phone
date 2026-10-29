/** 任意人物的主页：资料、关系、喜欢、最近动态。 */
import { h, icon, avatar, toast } from '../render.js';
import { getData, getFeed, findPerson, ensureThread } from '../store.js';
import { userName, currentCharacter } from '../st.js';
import { artFor } from '../art.js';
import { changeAvatar } from '../avatars.js';

export function openPersonProfile(name, { onChat } = {}) {
    const screen = document.querySelector('.mp-screen');
    if (!screen || !name) return;
    const person = findPerson(name);
    if (!person) { toast('没有这个人'); return; }
    const chip = screen.querySelector('.mp-backchip');
    if (chip) chip.style.display = 'none';
    const data = getData();
    const heart = (getFeed('heart')?.items || []).find(item => item.name === name);
    const moments = (data.moments || []).filter(item => item.author === name).slice(0, 3);
    const page = h('div', { class: 'mp-person' });

    const close = () => {
        page.classList.add('is-closing');
        setTimeout(() => { page.remove(); if (chip) chip.style.display = ''; }, 220);
    };

    function render() {
        page.innerHTML = '';
        page.append(
            h('div', { class: 'mp-person__cover', style: { backgroundImage: artFor(name + 'profile', 'dusk') } },
                h('div', { class: 'mp-person__bar' },
                    h('button', { type: 'button', class: 'mp-nav__btn', 'aria-label': '返回', onclick: close }, icon('back')),
                    h('div', { class: 'mp-person__title', text: '主页' }),
                    h('button', { type: 'button', class: 'mp-nav__btn', 'aria-label': '换头像', onclick: () => pickAvatar() }, icon('camera')),
                ),
            ),
            h('div', { class: 'mp-person__body' },
                h('div', { class: 'mp-person__head' },
                    h('div', { class: 'mp-person__avatar' }, avatar({ name, size: 78, link: false })),
                    h('div', { class: 'mp-person__id' },
                        h('div', { class: 'mp-person__name', text: person.name }),
                        h('div', { class: 'mp-person__role', text: [person.role, person.relation].filter(Boolean).join(' · ') || '这个世界里的人' }),
                    ),
                ),
                h('div', { class: 'mp-person__bio', text: person.desc || '还没有写下关于这个人的事。' }),
                person.style ? h('div', { class: 'mp-person__style', text: '说话方式：' + person.style }) : null,
                heart ? h('div', { class: 'mp-person__section' },
                    h('div', { class: 'mp-person__label', text: '关系' }),
                    h('div', { class: 'mp-person__chips' },
                        h('span', { class: 'mp-person__chip', text: (heart.stage || '认识') + (heart.affection ? ' · ' + heart.affection + '%' : '') }),
                    ),
                ) : null,
                heart?.likes?.length ? h('div', { class: 'mp-person__section' },
                    h('div', { class: 'mp-person__label', text: '喜欢怎样靠近' }),
                    h('div', { class: 'mp-person__chips' }, ...heart.likes.map(item => h('span', { class: 'mp-person__chip', text: item }))),
                ) : null,
                heart?.sensitive?.length ? h('div', { class: 'mp-person__section' },
                    h('div', { class: 'mp-person__label', text: '敏感的地方' }),
                    h('div', { class: 'mp-person__chips' }, ...heart.sensitive.map(item => h('span', { class: 'mp-person__chip', text: item }))),
                ) : null,
                heart?.custom?.length ? h('div', { class: 'mp-person__section' },
                    h('div', { class: 'mp-person__label', text: '自定义' }),
                    h('div', { class: 'mp-person__chips' }, ...heart.custom.map(item => h('span', { class: 'mp-person__chip', text: item }))),
                ) : null,
                moments.length ? h('div', { class: 'mp-person__section' },
                    h('div', { class: 'mp-person__label', text: '最近动态' }),
                    ...moments.map(moment => h('div', { class: 'mp-person__moment', text: String(moment.text || '').slice(0, 160) })),
                ) : null,
                h('div', { class: 'mp-person__world', text: '在「' + (currentCharacter()?.name || '这个世界') + '」里' }),
            ),
            h('div', { class: 'mp-person__actions' },
                h('button', { type: 'button', class: 'mp-btn primary small', text: '发消息', onclick: () => {
                    close();
                    if (onChat) onChat();
                    else {
                        const thread = ensureThread([name], { note: person.relation || '' });
                        if (thread) globalThis.MiragePhone?.openThread?.(thread.id);
                    }
                } }),
            ),
        );
    }

    function pickAvatar() {
        const file = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
        file.addEventListener('change', async () => {
            const picked = file.files?.[0];
            file.remove();
            if (!picked) return;
            try { await changeAvatar(name, picked); toast('头像已更新'); render(); }
            catch (error) { toast(String(error?.message || '换头像失败'), 3000); }
        });
        document.body.appendChild(file);
        file.click();
    }

    render();
    screen.appendChild(page);
    return { close };
}
