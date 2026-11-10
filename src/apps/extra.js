/** Discord / Telegram / Spotify / Gmail：打开先显示兜底内容，再让模型按世界生成。 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { createMusicPlayer } from '../audio.js';
import { getData, getCast, getFeed, setFeed, saveNow } from '../store.js';
import { generateExtra, friendlyError, replyInChat } from '../ai.js';
import { groupSheet } from './group-sheet.js';
import { EXTRA } from '../extra.js';
import { feedContext } from './feed-common.js';
import { openGroupCreate, generateMore } from '../groupgen.js';
import { generateMailReply } from '../mailgen.js';
import { userName, personaAvatarUrl } from '../st.js';


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
    // 便宜的「重画」：只拿现有内容重排，不再叫模型
    const repaint = () => {
        const latest = getFeed(id);
        if (latest) load(latest);
    };
    return { refresh, repaint, render: load };
}

export function mountDiscord(host, { nav }) {
    nav.setChrome?.('dark');
    const { el, body, refresh } = shell('Discord', 'is-dark', profileSheet);
    host.appendChild(el);
    let serverIndex = 0;
    let channelIndex = 0;

    const view = loader('discord', data => {
        const servers = Array.isArray(data.servers) ? data.servers : [];
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
        const channelQuery = String(server._query || '');
        main.appendChild(h('div', { class: 'mp-dc__server' },
            h('span', { class: 'mp-dc__hash', text: '#', onclick: () => openDcGroup() }), h('span', { onclick: () => openDcGroup(), text: server.name }),
            h('button', { type: 'button', class: 'mp-dc__addch', text: '+ 频道', onclick: () => addChannel(data, server) }),
            h('span', { class: 'mp-dc__members', text: (server.memberList?.length || server.channels?.length || 0) + ' 位成员' + (server.style ? ' · ' + server.style : '') }),
        ));
        if (server.notice) {
            main.appendChild(h('div', { class: 'mp-conv__notice', onclick: () => openDcGroup() },
                h('span', { class: 'mp-conv__notice-text', text: server.notice })));
        }
        // 搜索框（只筛频道，不影响聊天内容）
        const searchInput = h('input', {
            class: 'mp-dc__search', type: 'text', placeholder: '搜索频道', value: channelQuery,
            oninput: event => { server._query = event.target.value; view.render(data); },
        });
        main.appendChild(searchInput);

        // 频道分组：跟真实 Discord 一样有分类标题和图标
        const iconFor = name => {
            const text = String(name || '');
            if (/语音|voice|通话/.test(text)) return '🔊';
            if (/公告|announce|通知/.test(text)) return '📢';
            if (/规则|rule/.test(text)) return '📜';
            if (/反馈|feedback|issue|建议/.test(text)) return '💬';
            return '#';
        };
        const query = channelQuery.trim().toLowerCase();
        let lastCategory = null;
        (server.channels || []).forEach((item, index) => {
            if (query && !String(item.name || '').toLowerCase().includes(query)) return;
            const category = item.category || 'CHATS';
            if (category !== lastCategory) {
                lastCategory = category;
                main.appendChild(h('div', { class: 'mp-dc__cat' },
                    h('span', { text: category.toUpperCase() }),
                    h('span', { class: 'mp-dc__cat-caret', text: '⌄' })));
            }
            main.appendChild(h('div', {
                class: 'mp-dc__channel' + (index === channelIndex ? ' on' : ''),
                onclick: () => { channelIndex = index; server._inChat = true; view.render(data); },
            },
                h('span', { class: 'mp-dc__chan-icon', text: iconFor(item.name) }),
                h('span', { class: 'mp-dc__chan-name', text: item.name }),
                item.unread ? h('span', { class: 'mp-dc__unread', text: String(item.unread) }) : null));
        });
        // 真实版顶栏：# 频道名 + 返回 + 搜索/成员/更多
        main.appendChild(h('div', { class: 'mp-dc__bar' },
            h('span', {
                class: 'mp-dc__back', text: '‹',
                onclick: () => { server._inChat = false; view.render(data); },
            }),
            h('span', { class: 'mp-dc__hash2', text: '#' }),
            h('span', { class: 'mp-dc__title', text: channel.name }),
            h('span', { class: 'mp-dc__grow' }),
            h('span', {
                class: 'mp-dc__iconbtn', text: '⌕',
                onclick: () => { server._query = channelQuery ? '' : '#'; view.render(data); },
            }),
            h('span', {
                class: 'mp-dc__iconbtn', text: '☺',
                onclick: () => {
                    const cast = getCast();
                    const online = cast.slice(0, Math.max(1, Math.ceil(cast.length / 2)));
                    const offline = cast.slice(online.length);
                    const rows = list => (list.length
                        ? list.map(person => h('div', { class: 'mp-dc__member' },
                            avatar({ name: person.name, size: 30, link: false }),
                            h('div', {},
                                h('div', { class: 'mp-dc__mname', text: person.name }),
                                person.role ? h('div', { class: 'mp-dc__mrole', text: String(person.role).slice(0, 20) }) : null)))
                        : [h('div', { class: 'mp-dc__mempty', text: '暂时没人' })]);
                    sheet({
                        title: '成员 · ' + server.name,
                        content: h('div', { class: 'mp-dc__members-panel' },
                            h('div', { class: 'mp-dc__mgroup', text: '在线 — ' + online.length }), ...rows(online),
                            h('div', { class: 'mp-dc__mgroup', text: '离线 — ' + offline.length }), ...rows(offline)),
                    });
                },
            }),
            h('span', {
                class: 'mp-dc__iconbtn', text: '⋯',
                onclick: () => openDcGroup(),
            }),
        ));
        main.classList.toggle('in-chat', !!server._inChat);
        main.appendChild(h('div', { class: 'mp-dc__actions' },
            h('button', { type: 'button', text: '重新生成', onclick: () => moreChannel(data, server, channel, 'replace') }),
            h('button', { type: 'button', text: '追加', onclick: () => moreChannel(data, server, channel, 'append') }),
        ));
        // 日期分隔线：今天 / 昨天 / 更早
        const dayLabel = ts => {
            const value = Number(ts) || 0;
            if (!value) return '';
            const date = new Date(value);
            const today = new Date();
            const startOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            const diff = Math.round((startOf(today) - startOf(date)) / 86400000);
            if (diff <= 0) return '今天';
            if (diff === 1) return '昨天';
            return (date.getMonth() + 1) + '月' + date.getDate() + '日';
        };
        let lastDay = '';
        for (const message of channel.messages || []) {
            const day = dayLabel(message.ts);
            if (day && day !== lastDay) {
                lastDay = day;
                main.appendChild(h('div', { class: 'mp-dc__day' },
                    h('span', { class: 'mp-dc__day-line' }),
                    h('span', { class: 'mp-dc__day-text', text: day }),
                    h('span', { class: 'mp-dc__day-line' })));
            }
            main.appendChild(h('div', { class: 'mp-dc__msg' },
                avatar({ name: message.author, size: 28 }),
                h('div', {},
                    h('div', { class: 'mp-dc__line' }, h('b', { text: message.author }), h('span', { text: message.time }),
                        h('span', {
                            class: 'mp-dc__reply', text: '↩',
                            onclick: event => { event.stopPropagation(); replyTo(message); },
                        })),
                    h('div', { class: 'mp-dc__text', text: message.text }),
                ),
            ));
        }
        if (!(channel.messages || []).length) main.appendChild(h('div', { class: 'mp-dc__empty', text: '这个频道还很安静。' }));

        /** Discord 服务器设置：服务器名 / 公告 / 成员。 */
        function openDcGroup() {
            const cast = getCast().map(person => person.name).filter(Boolean);
            if (!Array.isArray(server.memberList) || !server.memberList.length) {
                server.memberList = cast.slice(0, 6);
                if (!server.memberList.length) server.memberList = [server.name];
            }
            groupSheet({
                title: '服务器设置 · ' + server.name,
                name: server.name,
                notice: server.notice || '',
                members: server.memberList,
                onSave: saved => {
                    server.name = saved.name || server.name;
                    server.notice = saved.notice;
                    server.memberList = saved.members;
                    save(data);
                    view.render(data);
                },
            });
        }

        const panel = h('div', { class: 'mp-dc__panel' },
            avatar({ name: userName() || '我', size: 30 }),
            h('div', {}, h('div', { class: 'mp-dc__pname', text: userName() || '我' }), h('div', { class: 'mp-dc__pstatus', text: '在线 · 在旧城' })),
            h('span', { class: 'mp-dc__pmic' }, icon('mic')),
            h('span', { class: 'mp-dc__pmic' }, icon('settings')),
        );
        panel.addEventListener('click', profileSheet);
        const composerInput = h('input', { class: 'mp-dc__input', type: 'text', placeholder: '发消息到 #' + channel.name });
        const composer = h('div', { class: 'mp-dc__composer' },
            h('span', {
                class: 'mp-dc__plus', text: '+',
                onclick: () => { try { dcMediaSheet(data, server, channel); } catch { toast('先输入文字再发媒体'); } },
            }),
            composerInput,
            h('button', {
                type: 'button', class: 'mp-dc__send',
                onclick: () => {
                    const text = composerInput.value.trim();
                    if (!text) return;
                    composerInput.value = '';
                    postMessage(text);
                },
            }, '发送'),
        );
        const mediaRow = h('div', { class: 'mp-tg__media' },
            h('button', { type: 'button', class: 'mp-chip', text: '表情', onclick: () => {
                composerInput.value += ['🙂', '😂', '😭', '🥺', '👀', '👍'][Math.floor(Math.random() * 6)];
                composerInput.focus?.();
            } }),
            h('button', { type: 'button', class: 'mp-chip', text: '图片', onclick: () => dcMediaSheet('图片') }),
            h('button', { type: 'button', class: 'mp-chip', text: '视频', onclick: () => dcMediaSheet('视频') }),
        );
        async function sendMedia(text) {
            return postMessage(text);
        }

        /** Discord 的图片 / 视频：可以自己填链接或描述 + 配文。 */
        function dcMediaSheet(kind) {
            const url = h('input', { class: 'mp-input', type: 'text', placeholder: kind === '图片' ? '图片链接 / 描述（可留空）' : '视频链接 / 描述（可留空）' });
            const cap = h('input', { class: 'mp-input', type: 'text', placeholder: '配一句话（可选）' });
            const box = sheet({
                title: '发' + kind,
                content: h('div', { class: 'mp-field-list' }, url, cap),
                actions: h('button', {
                    class: 'mp-btn primary small', type: 'button', text: '发送',
                    onclick: () => {
                        const head = kind === '图片' ? '📷 [图片] ' : '📹 [视频] ';
                        const body = url.value.trim() || (kind === '图片' ? '一张随手拍的照片' : '一段 15 秒的视频');
                        box.close();
                        sendMedia(head + body + (cap.value.trim() ? '\n' + cap.value.trim() : ''));
                    },
                }),
            });
            return box;
        }

        /** 发一条消息：先插入"正在输入"的占位回复，保证有人接，再换成真话。 */
        async function postMessage(text) {
            channel.messages = channel.messages || [];
            channel.messages.push({ author: userName() || '我', text, time: '刚刚' });
            const pending = { author: '某人', text: '…', time: '刚刚' };
            channel.messages.push(pending);
            save(data);
            view.render(data);
            try {
                const reply = await replyInChat({
                    app: 'Discord',
                    chat: { name: server.name + ' / #' + channel.name, style: server.style || '' },
                    messages: channel.messages.filter(item => item !== pending),
                });
                const cast = getCast().map(person => person.name).filter(Boolean);
                pending.author = cast.length ? cast[Math.floor(Math.random() * cast.length)] : '网友';
                pending.text = reply || '……';
            } catch {
                pending.text = '……';
            }
            save(data);
            view.render(data);
        }
        body.append(h('div', { class: 'mp-dc' }, rail, h('div', { class: 'mp-dc__wrap' }, main, mediaRow, composer, panel)));

        // 引用回复：把原话塞进输入框，发出去就带着「> 作者：内容」
        function replyTo(message) {
            const quote = '> ' + message.author + '：' + String(message.text || '').replace(/\s+/g, ' ').slice(0, 60) + '\n';
            composerInput.value = quote;
            composerInput.focus?.();
            try { composerInput.setSelectionRange(quote.length, quote.length); } catch { /* ignore */ }
        }
    });

    function save(data) {
        setFeed('discord', data);
        saveNow('data');
    }

    function addServer(data) {
        openGroupCreate({
            title: '新建服务器', kind: 'discord',
            onCreate: ({ name, style, data: generated }) => {
                const channels = (generated.channels || []).map(channel => ({
                    name: String(channel.name || '综合').slice(0, 24),
                    messages: (channel.messages || []).slice(0, 8).map(message => ({
                        author: String(message.author || message.name || '网友').slice(0, 24),
                        text: String(message.text || '').slice(0, 240),
                        time: String(message.time || '刚刚').slice(0, 10),
                    })),
                }));
                data.servers = Array.isArray(data.servers) ? data.servers : [];
                data.servers.push({ name, style, channels: channels.length ? channels : [{ name: '综合', messages: [] }] });
                serverIndex = data.servers.length - 1;
                channelIndex = 0;
                save(data);
                view.render(data);
            },
        });
    }

    async function moreChannel(data, server, channel, mode) {
        toast(mode === 'replace' ? '正在重新生成…' : '正在追加…');
        try {
            const result = await generateMore({ kind: 'discord', name: channel.name, style: server.style || '', count: 4 });
            const list = result.messages || result.channels?.[0]?.messages || [];
            const messages = list.map(message => ({
                author: String(message.author || message.name || '网友').slice(0, 24),
                text: String(message.text || '').slice(0, 240),
                time: String(message.time || '刚刚').slice(0, 10),
            }));
            if (!messages.length) { toast('这次没有生成出内容'); return; }
            channel.messages = mode === 'replace' ? messages : [...(channel.messages || []), ...messages];
            save(data);
            view.render(data);
            toast(mode === 'replace' ? '已重新生成' : '已追加');
        } catch (error) {
            toast(String(error?.message || '生成失败'), 3000);
        }
    }

    function addChannel(data, server) {
        openGroupCreate({
            title: '新建频道', kind: 'discord',
            onCreate: ({ name, style, data: generated }) => {
                const first = generated.channels?.[0];
                server.channels = server.channels || [];
                server.channels.push({
                    name, style,
                    messages: (first?.messages || []).slice(0, 8).map(message => ({
                        author: String(message.author || message.name || '网友').slice(0, 24),
                        text: String(message.text || '').slice(0, 240),
                        time: String(message.time || '刚刚').slice(0, 10),
                    })),
                });
                channelIndex = server.channels.length - 1;
                save(data);
                view.render(data);
            },
        });
    }

    refresh.addEventListener('click', view.refresh);
    return { refresh: view.refresh, repaint: view.repaint };
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
                avatar({ name: chat.name, size: 42, link: false }),
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
        openGroupCreate({
            title: '新建群组', kind: 'telegram',
            onCreate: ({ name, style, data: generated }) => {
                const messages = (generated.messages || []).slice(0, 10).map(message => ({
                    name: String(message.author || message.name || '网友').slice(0, 24),
                    text: String(message.text || '').slice(0, 240),
                    mine: false,
                }));
                data.chats = data.chats || [];
                data.chats.unshift({
                    name, style, group: true, members: getCast().length + 1,
                    preview: messages[messages.length - 1]?.text || '群组已创建',
                    time: '刚刚', unread: 0, messages,
                });
                save(data);
                view.render(data);
            },
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
                list.appendChild(h('div', {
                    class: 'mp-tg__bubble' + (line.mine ? ' mine' : ''),
                    onclick: () => {
                        if (line.mine) {
                            // 自己的：点一下撤回
                            const index = messages.indexOf(line);
                            if (index < 0) return;
                            messages.splice(index, 1);
                            chat.messages = messages;
                            chat.preview = messages[messages.length - 1]?.text || chat.preview;
                            draw();
                            saveChat();
                            toast('已撤回');
                            return;
                        }
                        input.value = '> ' + line.name + '：' + String(line.text || '').slice(0, 60) + '\n';
                        input.focus?.();
                    },
                },
                    h('div', { class: 'mp-tg__bname', text: line.name }), line.text));
            }
            // 像「消息」一样：新消息进来就贴在底部
            requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
        };
        draw();
        const input = h('input', { class: 'mp-cm__input', type: 'text', placeholder: '发消息…' });
        const saveChat = () => {
            const data = getFeed('telegram');
            if (data) { data.chats = (data.chats || []).map(item => item.name === chat.name ? chat : item); save(data); }
        };
        const send = async raw => {
            // 可能是按钮事件对象，别把它当文字发出去
            const source = raw && typeof raw === 'object' ? undefined : raw;
            const text = String(source ?? input.value).trim();
            if (!text) return;
            messages.push({ name: userName() || '我', text, mine: true });
            chat.messages = messages;
            chat.preview = text;
            chat.time = '刚刚';
            input.value = '';
            draw();
            saveChat();

            // 先立刻回一句，保证一定有反应；模型回来再把这句替换掉
            const pending = { name: chat.name, text: '…', mine: false };
            messages.push(pending);
            chat.messages = messages;
            draw();
            saveChat();
            // 8 秒还没等到模型，就先把占位换成一句能看的，别留个空气泡
            const guard = setTimeout(() => {
                if (pending.text === '…') { pending.text = '……'; draw(); }
            }, 8000);
            try {
                const reply = await replyInChat({ app: 'Telegram', chat, messages });
                pending.text = reply || '……';
            } catch {
                pending.text = '在的。';
            } finally {
                clearTimeout(guard);
            }
            chat.preview = pending.text;
            draw();
            saveChat();
        };
        /** Telegram 群设置：群名 / 公告 / 成员。 */
        function openTgGroup() {
            const cast = getCast().map(person => person.name).filter(Boolean);
            if (!Array.isArray(chat.memberList) || !chat.memberList.length) {
                chat.memberList = cast.slice(0, 6);
                if (!chat.memberList.length) chat.memberList = [chat.name];
            }
            groupSheet({
                title: '群聊设置 · ' + chat.name,
                name: chat.name,
                notice: chat.notice || '',
                members: chat.memberList,
                onSave: saved => {
                    chat.name = saved.name || chat.name;
                    chat.notice = saved.notice;
                    chat.memberList = saved.members;
                    chat.members = saved.members.length;
                    saveChat();
                    page.remove();
                    // 重新打开对话，让标题和公告生效
                    setTimeout(() => openChat(chat), 60);
                },
            });
        }

        /** 表情 / 图片 / 视频都能自己填，不再是一句写死的文字。 */
        function mediaSheet(kind) {
            if (kind === '表情') {
                let box = null;
                const grid = h('div', { class: 'mp-emoji-grid' },
                    ...['🙂', '😄', '😂', '🤣', '😊', '😍', '🥺', '😭', '😤', '😴', '😏', '🙃',
                        '👍', '👎', '👏', '🙏', '💪', '🤝', '❤️', '💔', '🔥', '✨', '🌙', '☕']
                        .map(char => h('button', {
                            type: 'button', class: 'mp-emoji-btn', text: char,
                            onclick: () => { input.value += char; input.focus?.(); box?.close(); },
                        })));
                box = sheet({ title: '选表情', content: grid });
                return box;
            }
            const url = h('input', { class: 'mp-input', type: 'text', placeholder: kind === '图片' ? '图片链接 / 描述（可留空）' : '视频链接 / 描述（可留空）' });
            const cap = h('input', { class: 'mp-input', type: 'text', placeholder: '配一句话（可选）' });
            const box = sheet({
                title: '发' + kind,
                content: h('div', { class: 'mp-field-list' }, url, cap),
                actions: h('button', {
                    class: 'mp-btn primary small', type: 'button', text: '发送',
                    onclick: () => {
                        const head = kind === '图片' ? '📷 [图片] ' : '📹 [视频] ';
                        const body = url.value.trim() || (kind === '图片' ? '一张随手拍的照片' : '一段 15 秒的视频');
                        box.close();
                        send(head + body + (cap.value.trim() ? '\n' + cap.value.trim() : ''));
                    },
                }),
            });
            return box;
        }

        const more = async mode => {
            if (!chat.group) return;
            toast(mode === 'replace' ? '正在重新生成…' : '正在追加…');
            try {
                const result = await generateMore({ kind: 'telegram', name: chat.name, style: chat.style || '', count: 5 });
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
                const data = getFeed('telegram');
                if (data) { data.chats = (data.chats || []).map(item => item.name === chat.name ? chat : item); save(data); }
                draw();
                toast(mode === 'replace' ? '已重新生成' : '已追加');
            } catch (error) {
                toast(String(error?.message || '生成失败'), 3000);
            }
        };
        const page = h('div', { class: 'mp-tg-page' },
            h('div', { class: 'mp-tg-page__bar' },
                h('button', { type: 'button', class: 'mp-tg-page__back', onclick: close }, icon('back')),
                h('div', {
                    class: 'mp-tg-page__title',
                    onclick: () => { if (chat.group) openTgGroup(); },
                    text: chat.name + (chat.group ? ' · ' + ((chat.memberList || []).length || chat.members || 0) + ' 人' : '') + (chat.style ? ' · ' + chat.style : '') }),
                chat.group ? h('div', { class: 'mp-tg-page__actions' },
                    h('button', { type: 'button', class: 'mp-tg-page__more', text: '重新生成', onclick: () => more('replace') }),
                    h('button', { type: 'button', class: 'mp-tg-page__more', text: '追加', onclick: () => more('append') }),
                ) : null,
            ),
            chat.notice ? h('div', { class: 'mp-conv__notice', onclick: () => openTgGroup() },
                h('span', { class: 'mp-conv__notice-text', text: chat.notice })) : null,
            h('div', { class: 'mp-tg-page__scroll' }, list),
            h('div', { class: 'mp-tg__media' },
                h('button', { type: 'button', class: 'mp-chip', text: '表情', onclick: () => mediaSheet('表情') }),
                h('button', { type: 'button', class: 'mp-chip', text: '图片', onclick: () => mediaSheet('图片') }),
                h('button', { type: 'button', class: 'mp-chip', text: '视频', onclick: () => mediaSheet('视频') }),
            ),
            h('div', { class: 'mp-cm__composer' }, input, h('button', { type: 'button', class: 'mp-cm__send', onclick: () => send() }, '发送')),
        );
        screen.appendChild(page);
        setTimeout(() => input.focus?.(), 200);
    }

    refresh.addEventListener('click', view.refresh);
    return { refresh: view.refresh, repaint: view.repaint };
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
    return { refresh: view.refresh, repaint: view.repaint, destroy: () => player.destroy() };
}

export function mountGmail(host, { nav }) {
    nav.setChrome?.('light');
    const { el, body, refresh } = shell('Gmail', 'is-gm', profileSheet);
    host.appendChild(el);
    const openMail = mail => {
        const screen = document.querySelector('.mp-screen');
        if (!screen) return;
        const chip = document.querySelector('.mp-backchip');
        if (chip) chip.style.display = 'none';
        const close = () => {
            page.classList.add('is-closing');
            setTimeout(() => { page.remove(); if (chip) chip.style.display = ''; }, 220);
        };
        const repliesEl = h('div', { class: 'mp-gm__replies' });
        const drawReplies = () => {
            repliesEl.innerHTML = '';
            for (const reply of (mail.replies || [])) {
                repliesEl.appendChild(h('div', { class: 'mp-gm__reply' + (reply.mine ? ' mine' : '') },
                    h('div', { class: 'mp-gm__reply-from', text: reply.mine ? (userName() || '我') : (reply.from || mail.from) }),
                    h('div', { class: 'mp-gm__reply-text', text: reply.text }),
                ));
            }
            repliesEl.scrollTop = repliesEl.scrollHeight;
        };
        drawReplies();
        const input = h('textarea', { class: 'mp-input', rows: '2', placeholder: '回复这封邮件…' });
        const send = async () => {
            const text = input.value.trim();
            if (!text) return;
            mail.replies = Array.isArray(mail.replies) ? mail.replies : [];
            mail.replies.push({ from: userName() || '我', text, time: '刚刚', mine: true });
            mail.preview = '你：' + text;
            mail.time = '刚刚';
            saveMail(mail);
            input.value = '';
            drawReplies();
            const data = getFeed('gmail');
            if (data) { data.emails = (data.emails || []).map(item => item === mail ? mail : item); saveNow('data'); }
            const reply = await generateMailReply({ mail }).catch(() => '');
            if (reply) {
                mail.replies.push({ from: mail.from, text: reply, time: '刚刚', mine: false });
                mail.preview = reply;
                saveMail(mail);
                drawReplies();
            }
        };
        const page = h('div', { class: 'mp-gm-page' },
            h('div', { class: 'mp-gm-page__bar' },
                h('button', { type: 'button', class: 'mp-gm-page__back', onclick: close }, icon('back')),
                h('div', { class: 'mp-gm-page__title', text: '邮件' }),
                h('button', { type: 'button', class: 'mp-gm-page__back', onclick: close }, icon('close')),
            ),
            h('div', { class: 'mp-gm-page__scroll' },
                h('div', { class: 'mp-gm-page__subject', text: mail.subject }),
                h('div', { class: 'mp-gm-page__meta', text: mail.from + ' · ' + mail.time }),
                h('div', { class: 'mp-gm-page__body', text: mail.body || mail.preview || '' }),
                h('div', { class: 'mp-gm-page__divider', text: '回复' }),
                repliesEl,
            ),
            h('div', { class: 'mp-gm-page__composer' }, input, h('button', { type: 'button', class: 'mp-btn primary small', text: '发送', onclick: send })),
        );
        screen.appendChild(page);
        const data = getFeed('gmail');
        if (data) data.emails = (data.emails || []).map(item => item === mail ? mail : item);
        setTimeout(() => input.focus?.(), 220);
    };

    function saveMail(mail) {
        const data = getFeed('gmail');
        if (!data) return;
        data.emails = (data.emails || []).map(item => item === mail ? mail : item);
        setFeed('gmail', data);
        saveNow('data');
    }

    const view = loader('gmail', data => {
        body.innerHTML = '';
        for (const mail of data.emails || []) {
            body.appendChild(h('div', { class: 'mp-gm__row', onclick: () => openMail(mail) },
                h('div', { class: 'mp-gm__from', text: (mail.from || '?').slice(0, 1) }),
                h('div', { class: 'mp-gm__main' },
                    h('div', { class: 'mp-gm__line' }, h('b', { text: mail.from }), h('span', { class: 'mp-gm__time', text: mail.time })),
                    h('div', { class: 'mp-gm__subject', text: mail.subject }),
                    h('div', { class: 'mp-gm__preview', text: mail.preview }),
                ),
            ));
        }
    });
    refresh.addEventListener('click', view.refresh);
    return { refresh: view.refresh, repaint: view.repaint };
}