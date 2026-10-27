/** 通用的整页聊天：Telegram / Signal 共用。 */
import { h, icon } from '../render.js';

export function openChatPage({
    title, subtitle = '', messages = [], placeholder = '发消息…',
    renderMessage, onSend, onChange, theme = 'light',
}) {
    const screen = document.querySelector('.mp-screen');
    if (!screen) return null;
    const chip = document.querySelector('.mp-backchip');
    if (chip) chip.style.display = 'none';

    const list = h('div', { class: 'mp-chatpage__list' });
    const draw = () => {
        list.innerHTML = '';
        for (const line of messages) list.appendChild(renderMessage(line));
        list.scrollTop = list.scrollHeight;
    };
    draw();

    const input = h('input', { class: 'mp-cm__input', type: 'text', placeholder });
    const send = () => {
        const text = input.value.trim();
        if (!text) return;
        const line = onSend?.(text) || { mine: true, text };
        messages.push(line);
        input.value = '';
        draw();
        onChange?.(messages);
    };
    const page = h('div', { class: 'mp-chatpage' + (theme === 'dark' ? ' is-dark' : '') },
        h('div', { class: 'mp-chatpage__bar' },
            h('button', { type: 'button', class: 'mp-chatpage__back', onclick: close, 'aria-label': '返回' }, icon('back')),
            h('div', { class: 'mp-chatpage__title' }, title, subtitle ? h('small', { text: subtitle }) : null),
        ),
        h('div', { class: 'mp-chatpage__scroll' }, list),
        h('div', { class: 'mp-cm__composer' }, input,
            h('button', { type: 'button', class: 'mp-cm__send', onclick: send }, '发送')),
    );
    screen.appendChild(page);
    setTimeout(() => input.focus?.(), 200);

    function close() {
        page.classList.add('is-closing');
        setTimeout(() => {
            page.remove();
            if (chip) chip.style.display = '';
        }, 220);
    }

    return { close, draw };
}
