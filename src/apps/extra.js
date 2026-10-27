/** Discord / Telegram / Spotify / Gmail：打开先显示兜底内容，再让模型按世界生成。 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { createMusicPlayer } from '../audio.js';
import { getData, getCast, getFeed } from '../store.js';
import { generateExtra, friendlyError } from '../ai.js';
import { EXTRA } from '../extra.js';
import { feedContext } from './feed-common.js';
import { userName, characterAvatar, personaAvatarUrl } from '../st.js';
import { setOneShot } from '../st.js';

function profileSheet() {
    const name = userName() || '我';
    const current = getData();
    const cast = getCast();
    const phone = '13' + String(Math.abs(name.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 7162)) % 900000000 + 100000000).slice(0, 9);
    const content = h('div', { class: 'mp-me' },
        h('div', { class: 'mp-me__top' },
            avatar({ name, size: 58, src: personaAvatarUrl() }),
            h('div', {}, h('div', { class: 'mp-me__name', text: name }), h('div', { class: 'mp-me__phone', text: '+86 ' + phone.slice(0, 3) + ' ' + phone.slice(3, 7) + ' ' + phone.slice(7) })),
        ),
        h('div', { class: 'mp-me__stats' },
            stat('在这个世界', (current.meta?.city || '旧城')),
            stat('手机联系人', String(cast.length)),
            stat('未读消息', String(current.threads?.reduce((sum, thread) => sum + (thread.unread || 0), 0) || 0)),
        ),
        h('div', { class: 'mp-me__bio', text: '「相遇」里认识的人、Discord 的服务器、Telegram 的群组，都在这里。' }),
    );
    sheet({ title: '个人', content });
}
function stat(label, value) {
    return h('div', { class: 'mp-me__stat' }, h('span', { class: 'mp-me__stat-value', text: value }), h('span', { class: 'mp-me__stat-label', text: label }));
}

function shell(title, cls, onProfile) {
    const body = h('div', { class: 'mp-extra__body' });
    const refresh = h('button', { type: 'button', class: 'mp-extra__refresh', 'aria-label': '刷新' }, icon('refresh'));
    const me = h('button', { type: 'button', class: 'mp-extra__me', 'aria-label': '个人', onclick: onProfile }, avatar({ name: userName() || '我', size: 24 }));
    const el = h('div', { class: 'mp-extra ' + cls },
        h('div', { class: 'mp-extra__head' },
            h('div', { class: 'mp-extra__title', text: title }),
            h('div', { class: 'mp-extra__head-actions' }, refresh, me),
        ), body);
    return { el, body, refresh };
}

function loader(id, render) {
    let busy = false;
    const config = EXTRA[id];
    const load = data => render(data);
    const refresh = () => {
        if (busy) return;
        busy = true;
        toast('正在刷新…');
        generateExtra(id).then(next => { load(next); toast('刷新好了'); })
            .catch(error => toast(friendlyError(error), 3000))
            .finally(() => { busy = false; });
    };
    const cached = getFeed(id);
    load(cached || config.fallback(feedContext()));
    if (!cached) generateExtra(id).then(load).catch(() => {});
    return { refresh, render: load };
}

export function mountDiscord(host, { nav }) {
    nav.setChrome?.('dark');
    const { el, body, refresh } = shell('Discord', 'is-dark', profileSheet);
    host.appendChild(el);
    let serverIndex = 0;
    let channelIndex = 0;

    const view = loader('discord', data => {
        const servers = data.servers || [];
        if (!servers.length) return;
        serverIndex = Math.min(serverIndex, servers.length - 1);
        const server = servers[serverIndex];
        channelIndex = Math.min(channelIndex, Math.max(0, (server.channels || []).length - 1));
        const channel = (server.channels || [])[channelIndex] || { name: '综合', messages: [] };
        body.innerHTML = '';

        const rail = h('div', { class: 'mp-dc__rail' }, h('div', { class: 'mp-dc__railhome' }, icon('message')));
        servers.forEach((item, index) => {
            rail.appendChild(h('div', {
                class: 'mp-dc__railicon' + (index === serverIndex ? ' on' : ''),
                title: item.name, text: (item.name || '#').slice(0, 1),
                onclick: () => { serverIndex = index; channelIndex = 0; view.render(data); },
            }));
        });
        rail.appendChild(h('div', { class: 'mp-dc__railadd', text: '+', onclick: () => addServer(data) }));

        const main = h('div', { class: 'mp-dc__main' });
        main.appendChild(h('div', { class: 'mp-dc__server' },
            h('span', { class: 'mp-dc__hash', text: '#' }), server.name,
            h('button', { type: 'button', class: 'mp-dc__addch', text: '+ 频道', onclick: () => addChannel(data, server) }),
            h('span', { class: 'mp-dc__members', text: (server.channels?.length || 0) + ' 个频道' }),
        ));
        (server.channels || []).forEach((item, index) => {
            main.appendChild(h('div', {
                class: 'mp-dc__channel' + (index === channelIndex ? ' on' : ''),
                text: '#' + item.name,
                onclick: () => { channelIndex = index; view.render(data); },
            }));
        });
        main.appendChild(h('div', { class: 'mp-dc__channel-title', text: '#' + channel.name }));
        for (const message of channel.messages || []) {
            main.appendChild(h('div', { class: 'mp-dc__msg' },
                avatar({ name: message.author, size: 28 }),
                h('div', {},
                    h('div', { class: 'mp-dc__line' }, h('b', { text: message.author }), h('span', { text: message.time })),
                    h('div', { class: 'mp-dc__text', text: message.text }),
                ),
            ));
        }
        if (!(channel.messages || []).length) main.appendChild(h('div', { class: 'mp-dc__empty', text: '这个频道还很安静。' }));

        const panel = h('div', { class: 'mp-dc__panel' },
            avatar({ name: userName() || '我', size: 30 }),
            h('div', {}, h('div', { class: 'mp-dc__pname', text: userName() || '我' }), h('div', { class: 'mp-dc__pstatus', text: '在线 · 在旧城' })),
            h('span', { class: 'mp-dc__pmic' }, icon('mic')),
            h('span', { class: 'mp-dc__pmic' }, icon('settings')),
        );
        panel.addEventListener('click', profileSheet);
        const composerInput = h('input', { class: 'mp-dc__input', type: 'text', placeholder: '发消息到 #' + channel.name });
        const composer = h('div', { class: 'mp-dc__composer' },
            composerInput,
            h('button', {
                type: 'button', class: 'mp-dc__send',
                onclick: () => {
                    const text = composerInput.value.trim();
                    if (!text) return;
                    channel.messages = channel.messages || [];
                    channel.messages.push({ author: userName() || '我', text, time: '刚刚' });
                    save(data);
                    view.render(data);
                },
            }, '发送'),
        );
        body.append(h('div', { class: 'mp-dc' }, rail, h('div', { class: 'mp-dc__wrap' }, main, composer, panel)));
    });

    function save(data) {
        setFeed('discord', data);
        saveNow('data');
    }

    function addServer(data) {
        const input = h('input', { class: 'mp-input', type: 'text', placeholder: '服务器名字' });
        const s = sheet({
            title: '新建服务器',
            content: h('div', { class: 'mp-field-list' }, input),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '创建',
                onclick: () => {
                    const name = input.value.trim();
                    if (!name) return;
                    data.servers.push({ name, channels: [{ name: '综合', messages: [] }] });
                    serverIndex = data.servers.length - 1;
                    channelIndex = 0;
                    save(data);
                    s.close();
                    view.render(data);
                    toast('服务器已创建');
                },
            }),
        });
    }

    function addChannel(data, server) {
        const input = h('input', { class: 'mp-input', type: 'text', placeholder: '频道名字' });
        const s = sheet({
            title: '新建频道',
            content: h('div', { class: 'mp-field-list' }, input),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '创建',
                onclick: () => {
                    const name = input.value.trim();
                    if (!name) return;
                    server.channels = server.channels || [];
                    server.channels.push({ name, messages: [] });
                    channelIndex = server.channels.length - 1;
                    save(data);
                    s.close();
                    view.render(data);
                    toast('频道已创建');
                },
            }),
        });
    }

    refresh.addEventListener('click', view.refresh);
    return { refresh: view.refresh };
}

export function mountTelegram(host, { nav }) {
    nav.setChrome?.('dark');
    const { el, body, refresh } = shell('Telegram', 'is-tg', profileSheet);
    host.appendChild(el);

    let tgFilter = 'all';
    const view = loader('telegram', data => {
        body.innerHTML = '';
        const me = h('div', { class: 'mp-tg__me', onclick: profileSheet },
            avatar({ name: userName() || '我', size: 40 }),
            h('div', { class: 'mp-tg__memain' }, h('div', { class: 'mp-tg__mename', text: userName() || '我' }), h('div', { class: 'mp-tg__mephone', text: '我的个人资料' })),
            icon('chevron'),
        );
        body.appendChild(me);
        const add = h('button', { type: 'button', class: 'mp-tg__add', onclick: () => addGroup(data) }, icon('plus'), '新建群组');
        body.appendChild(add);
        const chips = h('div', { class: 'mp-tg__chips' });
        for (const [id, label] of [['all', '全部'], ['unread', '未读'], ['group', '群组']]) {
            chips.appendChild(h('button', {
                type: 'button', class: 'mp-tg__chip' + (tgFilter === id ? ' on' : ''), text: label,
                onclick: () => { tgFilter = id; view.render(data); },
            }));
        }
        body.appendChild(chips);
        for (const chat of (data.chats || []).filter(item => tgFilter === 'all' || (tgFilter === 'unread' ? item.unread : item.group))) {
            body.appendChild(h('div', { class: 'mp-tg__chat', onclick: () => openChat(chat) },
                avatar({ name: chat.name, size: 42, group: chat.group }),
                h('div', { class: 'mp-tg__main' },
                    h('div', { class: 'mp-tg__line' },
                        h('b', { text: chat.name }),
                        chat.group ? h('span', { class: 'mp-tg__members', text: chat.members ? chat.members + ' 人' : '群组' }) : null,
                        h('span', { class: 'mp-tg__time', text: chat.time })),
                    h('div', { class: 'mp-tg__preview', text: chat.preview }),
                ),
                chat.unread ? h('span', { class: 'mp-tg__badge', text: String(chat.unread) }) : null,
            ));
        }
    });

    function save(data) { setFeed('telegram', data); saveNow('data'); }

    function addGroup(data) {
        const input = h('input', { class: 'mp-input', type: 'text', placeholder: '群组名字' });
        const s = sheet({
            title: '新建群组',
            content: h('div', { class: 'mp-field-list' }, input),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '创建',
                onclick: () => {
                    const name = input.value.trim();
                    if (!name) return;
                    data.chats = data.chats || [];
                    data.chats.unshift({ name, preview: '群组已创建', time: '刚刚', unread: 0, group: true, members: 1 });
                    save(data);
                    s.close();
                    view.render(data);
                    toast('群组已创建');
                },
            }),
        });
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
            { name: chat.name, text: chat.preview || '在吗？', mine: false },
            { name: userName() || '我', text: '在。', mine: true },
            { name: chat.name, text: chat.group ? '今晚有人来吗？' : '刚到家，等我一下。', mine: false },
        ];
        const list = h('div', { class: 'mp-tg__msgs' });
        const draw = () => {
            list.innerHTML = '';
            for (const line of messages) {
                list.appendChild(h('div', { class: 'mp-tg__bubble' + (line.mine ? ' mine' : '') },
                    h('div', { class: 'mp-tg__bname', text: line.name }), line.text));
            }
        };
        draw();
        const input = h('input', { class: 'mp-cm__input', type: 'text', placeholder: '发消息…' });
        const send = () => {
            const text = input.value.trim();
            if (!text) return;
            messages.push({ name: userName() || '我', text, mine: true });
            chat.messages = messages;
            chat.preview = text;
            chat.time = '刚刚';
            input.value = '';
            draw();
            const data = getFeed('telegram');
            if (data) { data.chats = (data.chats || []).map(item => item.name === chat.name ? chat : item); save(data); }
        };
        const page = h('div', { class: 'mp-tg-page' },
            h('div', { class: 'mp-tg-page__bar' },
                h('button', { type: 'button', class: 'mp-tg-page__back', onclick: close }, icon('back')),
                h('div', { class: 'mp-tg-page__title', text: chat.name + (chat.group ? ' · ' + (chat.members || 0) + ' 人' : '') }),
            ),
            h('div', { class: 'mp-tg-page__scroll' }, list),
            h('div', { class: 'mp-cm__composer' }, input, h('button', { type: 'button', class: 'mp-cm__send', onclick: send }, '发送')),
        );
        screen.appendChild(page);
        setTimeout(() => input.focus?.(), 200);
    }

    refresh.addEventListener('click', view.refresh);
    return { refresh: view.refresh };
}

export function mountSpotify(host, { nav }) {
    nav.setChrome?.('dark');
    const { el, body, refresh } = shell('Spotify', 'is-sp', profileSheet);
    host.appendChild(el);
    let dataRef = null;
    const refs = {};

    const player = createMusicPlayer({
        onTick(state) {
            if (refs.fill) refs.fill.style.width = Math.round((state.elapsed / state.duration) * 100) + '%';
            if (refs.cur) refs.cur.textContent = timeText(state.elapsed);
            if (refs.dur) refs.dur.textContent = timeText(state.duration);
            if (refs.playIcon) refs.playIcon.innerHTML = '';
            if (refs.playIcon) refs.playIcon.appendChild(icon(state.playing ? 'pause' : 'play', '', 20));
            if (refs.rows) {
                for (const [title, row] of refs.rows) row.classList.toggle('is-playing', state.playing && state.track?.title === title);
            }
        },
    });

    function timeText(seconds) {
        const value = Math.max(0, Math.round(seconds || 0));
        return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
    }

    function paint(data) {
        dataRef = data;
        body.innerHTML = '';
        const now = data.now || (data.tracks || [])[0] || { title: '雪停之后', artist: '旧城电台', time: '3:24' };
        const cover = h('div', { class: 'mp-sp__cover', text: (now.title || '雪').slice(0, 1) });
        const playIcon = h('span', { class: 'mp-sp__playicon' }, icon('play', '', 20));
        const playBtn = h('button', { type: 'button', class: 'mp-sp__play', 'aria-label': '播放' }, playIcon);
        refs.playIcon = playIcon;
        playBtn.addEventListener('click', () => {
            player.toggle(now);
            paint(data);
        });

        const fill = h('i', { class: 'mp-sp__fill' });
        refs.fill = fill;
        refs.cur = h('span', { class: 'mp-sp__elapsed', text: '0:00' });
        refs.dur = h('span', { class: 'mp-sp__total', text: now.time || '3:24' });

        body.appendChild(h('div', { class: 'mp-sp__now' },
            cover,
            h('div', { class: 'mp-sp__meta' }, h('div', { class: 'mp-sp__track', text: now.title }), h('div', { class: 'mp-sp__artist', text: now.artist })),
            playBtn,
        ));
        body.appendChild(h('div', { class: 'mp-sp__progress' },
            h('div', { class: 'mp-sp__bar' }, fill),
            h('div', { class: 'mp-sp__times' }, refs.cur, refs.dur),
        ));
        body.appendChild(h('div', { class: 'mp-sp__volume' }, icon('volume', '', 15), h('input', {
            type: 'range', min: '0', max: '100', value: '72',
            oninput: event => player.setVolume(Number(event.target.value) / 100),
        })));

        body.appendChild(h('div', { class: 'mp-sp__label', text: '本周循环' }));
        refs.rows = new Map();
        for (const track of data.tracks || []) {
            const row = h('div', {
                class: 'mp-sp__row',
                onclick: () => { player.play(track); paint(data); },
            },
                h('span', { class: 'mp-sp__index', text: '♪' }),
                h('div', { class: 'mp-sp__rowmain' }, h('div', { class: 'mp-sp__rowtitle', text: track.title }), h('div', { class: 'mp-sp__artist', text: track.artist })),
                h('span', { class: 'mp-sp__time', text: track.time }),
            );
            refs.rows.set(track.title, row);
            body.appendChild(row);
        }
        if (!data.tracks?.length) body.appendChild(h('div', { class: 'mp-st-hint', text: '还没有歌，刷新试试。' }));
    }

    const view = loader('spotify', data => paint(data));
    refresh.addEventListener('click', view.refresh);
    return { refresh: view.refresh, destroy: () => player.destroy() };
}

export function mountGmail(host, { nav }) {
    nav.setChrome?.('light');
    const { el, body, refresh } = shell('Gmail', 'is-gm', profileSheet);
    host.appendChild(el);
    const openMail = mail => {
        sheet({
            title: mail.subject,
            content: h('div', { class: 'mp-gm__detail' },
                h('div', { class: 'mp-gm__detail-from', text: mail.from + ' · ' + mail.time }),
                h('div', { class: 'mp-gm__detail-body', text: (mail.body || mail.preview || '') + '\n\n' + '（这是一封来自这个世界的邮件。回复功能还在路上。）' }),
            ),
            actions: h('button', { class: 'mp-btn small', type: 'button', text: '回复', onclick: () => toast('回复功能还没接') }),
        });
    };

    const view = loader('gmail', data => {
        body.innerHTML = '';
        for (const mail of data.emails || []) {
            body.appendChild(h('div', { class: 'mp-gm__row' },
                h('div', { class: 'mp-gm__from', text: (mail.from || '?').slice(0, 1) }),
                h('div', { class: 'mp-gm__main', onclick: () => openMail(mail) },
                    h('div', { class: 'mp-gm__line' }, h('b', { text: mail.from }), h('span', { class: 'mp-gm__time', text: mail.time })),
                    h('div', { class: 'mp-gm__subject', text: mail.subject }),
                    h('div', { class: 'mp-gm__preview', text: mail.preview }),
                ),
            ));
        }
    });
    refresh.addEventListener('click', view.refresh);
    return { refresh: view.refresh };
}