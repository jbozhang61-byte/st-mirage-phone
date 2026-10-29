/** Signal：端到端加密的聊天列表 + 整页对话。 */
import { h, icon, avatar } from '../render.js';
import { getCast, getFeed, setFeed } from '../store.js';
import { characterAvatar } from '../st.js';
import { openGroupCreate, generateMore } from '../groupgen.js';
import { generateSignal } from '../storyseed.js';

export function mountSignal(host, { nav }) {
    const body = h('div', { class: 'mp-sg__body' });
    const el = h('div', { class: 'mp-sg' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, 'Signal', h('small', { text: '端到端加密' })),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '新建群组', onclick: () => createGroup() }, icon('plus')),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '刷新', onclick: () => render() }, icon('refresh')),
        ),
        body,
    );
    host.appendChild(el);
    const hadCache = !!getFeed('signal')?.items;
    if (!hadCache) {
        generateSignal().then(chats => {
            if (chats.length) { setFeed('signal', chats); render(); }
        }).catch(() => {});
    }

    function load() {
        const cached = getFeed('signal')?.items;
        if (cached?.length) return { chats: cached };
        const cast = getCast();
        const chats = cast.slice(0, 8).map((person, index) => ({
            id: 'sg-' + index,
            name: person.name,
            group: false,
            unread: index < 2 ? 1 + index : 0,
            preview: index === 0 ? '到家了吗？' : '这条消息不会离开这部手机。',
            time: index === 0 ? '刚刚' : index + ' 小时前',
            messages: [],
        }));
        chats.unshift({ id: 'sg-note', name: 'Note to Self', group: false, unread: 0, preview: '只属于自己的备忘', time: '昨天', messages: [] });
        if (!chats.some(chat => chat.id !== 'sg-note')) {
            chats.push({ id: 'sg-0', name: '旧城的人', group: false, unread: 1, preview: '在吗？', time: '刚刚', messages: [] });
        }
        setFeed('signal', chats);
        return { chats };
    }

    function createGroup() {
        openGroupCreate({
            title: '新建群组', kind: 'signal',
            onCreate: ({ name, style, data: generated }) => {
                const data = load();
                const messages = (generated.messages || []).slice(0, 10).map(message => ({
                    name: String(message.author || message.name || '网友').slice(0, 24),
                    text: String(message.text || '').slice(0, 240),
                    mine: false,
                }));
                data.chats.unshift({
                    id: 'sg-' + Date.now().toString(36), name, style, group: true,
                    members: getCast().length + 1, unread: 0,
                    preview: messages[messages.length - 1]?.text || '群组已创建',
                    time: '刚刚', messages,
                });
                setFeed('signal', data.chats);
                render();
            },
        });
    }

    function render() {
        const data = load();
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'mp-sg__hint' }, icon('lock'), '消息只在本地保存，不经过服务器'));
        for (const chat of data.chats) {
            body.appendChild(h('button', {
                type: 'button', class: 'mp-sg__row',
                onclick: () => openChat(chat),
            },
                avatar({ name: chat.name, src: characterAvatar(chat.name), size: 46 }),
                h('div', { class: 'mp-sg__main' },
                    h('div', { class: 'mp-sg__top' }, h('b', { text: chat.name }), h('span', { text: chat.time })),
                    h('div', { class: 'mp-sg__preview', text: chat.preview }),
                ),
                chat.unread ? h('span', { class: 'mp-sg__badge', text: String(chat.unread) }) : null,
            ));
        }
        if (!data.chats.length) body.appendChild(h('div', { class: 'mp-empty__text', text: '还没有对话。先去通讯录找人。' }));
    }

    function openChat(chat) {
        const screen = document.querySelector('.mp-screen');
        if (!screen) return;
        const chip = document.querySelector('.mp-backchip');
        if (chip) chip.style.display = 'none';
        const close = () => {
            page.classList.add('is-closing');
            setTimeout(() => { page.remove(); if (chip) chip.style.display = ''; }, 220);
        };
        const messages = chat.messages?.length ? chat.messages : [
            { mine: false, text: chat.preview || '在吗？' },
            { mine: true, text: '在。' },
            { mine: false, text: '那就好。' },
        ];
        const list = h('div', { class: 'mp-sg__msgs' });
        const draw = () => {
            list.innerHTML = '';
            for (const line of messages) list.appendChild(h('div', { class: 'mp-sg__bubble' + (line.mine ? ' mine' : '') },
                line.name && !line.mine ? h('span', { class: 'mp-sg__bname', text: line.name }) : null,
                line.text,
            ));
            list.scrollTop = list.scrollHeight;
        };
        draw();
        const input = h('input', { class: 'mp-cm__input', type: 'text', placeholder: '加密消息…' });
        const send = () => {
            const text = input.value.trim();
            if (!text) return;
            messages.push({ mine: true, text });
            chat.messages = messages;
            chat.preview = text;
            chat.time = '刚刚';
            chat.unread = 0;
            input.value = '';
            draw();
            const stored = getFeed('signal')?.items;
            if (stored) setFeed('signal', stored.map(item => item.id === chat.id ? chat : item));
        };
        const more = async mode => {
            if (!chat.group) return;
            toast(mode === 'replace' ? '正在重新生成…' : '正在追加…');
            try {
                const result = await generateMore({ kind: 'signal', name: chat.name, style: chat.style || '', count: 5 });
                const list = (result.messages || []).map(message => ({
                    name: String(message.author || message.name || '网友').slice(0, 24),
                    text: String(message.text || '').slice(0, 240),
                    mine: false,
                }));
                if (!list.length) { toast('这次没有生成出内容'); return; }
                if (mode === 'replace') messages.length = 0;
                messages.push(...list);
                chat.messages = messages;
                chat.preview = messages[messages.length - 1]?.text || chat.preview;
                chat.time = '刚刚';
                const stored = getFeed('signal')?.items;
                if (stored) setFeed('signal', stored.map(item => item.id === chat.id ? chat : item));
                draw();
                toast(mode === 'replace' ? '已重新生成' : '已追加');
            } catch (error) {
                toast(String(error?.message || '生成失败'), 3000);
            }
        };
        const page = h('div', { class: 'mp-sg-page' },
            h('div', { class: 'mp-sg-page__bar' },
                h('button', { type: 'button', class: 'mp-sg-page__back', onclick: close }, icon('back')),
                h('div', {}, h('div', { class: 'mp-sg-page__title', text: chat.name }), h('div', { class: 'mp-sg-page__sub', text: chat.group ? '端到端加密 · ' + (chat.style || '群组') : '端到端加密' })),
                chat.group ? h('div', { class: 'mp-sg-page__more' },
                    h('button', { type: 'button', class: 'mp-sg-page__more', text: '重新生成', onclick: () => more('replace') }),
                    h('button', { type: 'button', class: 'mp-sg-page__more', text: '追加', onclick: () => more('append') }),
                ) : null,
            ),
            h('div', { class: 'mp-sg-page__scroll' }, list),
            h('div', { class: 'mp-cm__composer' }, input, h('button', { type: 'button', class: 'mp-cm__send', onclick: send }, '发送')),
        );
        screen.appendChild(page);
        setTimeout(() => input.focus?.(), 200);
    }

    render();
    return { refresh: render };
}