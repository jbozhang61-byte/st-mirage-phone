/**
 * 消息：会话列表 + 对话。手机里最重要的一页。
 */
import { h, icon, avatar, timeText, dayText, sheet, confirmSheet, toast, haptic, hashOf } from '../render.js';
import { getData, getSettings, findThread, appendMessages, markRead, removeThread, saveNow, uid } from '../store.js';
import { characterAvatar, personaAvatarUrl, userName, setOneShot } from '../st.js';
import { findPerson } from '../store.js';
import { replyToThread, isBusy, aiEvents, quoteForBring, friendlyError } from '../ai.js';
import { storeImage, resolveImage } from '../images.js';
import { parseLine } from '../prompts.js';
import { speak, stopTts } from '../tts.js';

const EMOJIS = ['😊', '😂', '🥺', '😭', '😳', '😴', '😡', '🫂', '🌙', '☀️', '🌸', '🍰', '☕', '🎧', '💤', '❤️'];

export function mountChat(host, { nav, params }) {
    return params?.threadId ? mountConversation(host, nav, params.threadId) : mountList(host, nav);
}

/* ================================= 会话列表 ================================= */

function mountList(host, nav) {
    const el = h('div', { class: 'mp-conv' });
    const body = h('div', { class: 'mp-body' });
    el.appendChild(h('div', { class: 'mp-nav' },
        h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '主屏', onclick: () => nav.home() }, icon('back')),
        h('div', { class: 'mp-nav__title' }, '消息', h('small', { text: 'MESSAGES' })),
        h('div', { class: 'mp-nav__spacer' }),
        h('button', {
            class: 'mp-nav__btn accent', type: 'button', 'aria-label': '新会话',
            onclick: () => nav.go('contacts'),
        }, icon('plus')),
    ));
    el.appendChild(body);
    host.appendChild(el);

    function render() {
        const data = getData();
        const threads = [...data.threads].sort((a, b) => {
            if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
            return (b.updated || 0) - (a.updated || 0);
        });
        const keep = body.scrollTop;
        body.innerHTML = '';
        if (!threads.length) {
            body.appendChild(h('div', { class: 'mp-empty' },
                h('div', { class: 'mp-empty__icon' }, icon('message')),
                h('div', { class: 'mp-empty__title', text: '手机还很安静' }),
                h('div', { class: 'mp-empty__text', text: '去通讯录挑一个角色，或者等剧情里的 TA 主动找你。' }),
                h('button', { class: 'mp-btn primary', type: 'button', text: '打开通讯录', onclick: () => nav.go('contacts') }),
            ));
            return;
        }
        const list = h('div', { class: 'mp-threads' });
        for (const thread of threads) {
            list.appendChild(threadRow(thread, nav, render));
        }
        body.appendChild(list);
        body.scrollTop = keep;
    }

    const onReply = () => render();
    aiEvents.addEventListener('reply', onReply);
    render();
    return {
        refresh: render,
        destroy() { aiEvents.removeEventListener('reply', onReply); },
    };
}

function threadRow(thread, nav, refresh) {
    const last = thread.msgs[thread.msgs.length - 1];
    const title = thread.name || thread.members.join('、');
    let suppress = false;
    const row = h('div', {
        class: 'mp-thread' + (thread.pinned ? ' is-pinned' : ''),
        onclick: () => { if (suppress) { suppress = false; return; } nav.go('chat', { threadId: thread.id }); },
    },
        avatar({ name: thread.members[0], src: characterAvatar(thread.members[0]), size: 46 }),
        h('div', { class: 'mp-thread__main' },
            h('div', { class: 'mp-thread__top' },
                h('span', { class: 'mp-thread__name' }, title, thread.pinned ? h('span', { class: 'mp-thread__pin' }, icon('pin')) : null),
                h('span', { class: 'mp-thread__time', text: last ? (isToday(last.ts) ? timeText(last.ts) : dayText(last.ts)) : '' }),
            ),
            h('div', { class: 'mp-thread__bottom' },
                h('span', { class: 'mp-thread__preview', text: previewOf(thread) }),
                thread.unread ? h('span', { class: 'mp-thread__badge', text: thread.unread > 99 ? '99+' : String(thread.unread) }) : null,
                thread.muted ? h('span', { class: 'mp-thread__badge is-mute' }) : null,
            ),
        ),
    );
    row.addEventListener('contextmenu', event => {
        event.preventDefault();
        suppress = true;
        threadMenu(thread, refresh);
    });
    let pressTimer = 0;
    row.addEventListener('pointerdown', () => {
        pressTimer = setTimeout(() => { suppress = true; threadMenu(thread, refresh); }, 550);
    });
    row.addEventListener('pointerup', () => clearTimeout(pressTimer));
    row.addEventListener('pointerleave', () => clearTimeout(pressTimer));
    return row;
}

function threadMenu(thread, refresh) {
    const s = sheet({ title: thread.members.join('、'), content: h('div', { class: 'mp-field-list' },
        h('div', { class: 'mp-chips' },
            h('button', { class: 'mp-chip', type: 'button', onclick: () => { thread.pinned = !thread.pinned; saveNow('data'); s.close(); refresh(); } }, icon('pin'), thread.pinned ? '取消置顶' : '置顶'),
            h('button', { class: 'mp-chip', type: 'button', onclick: () => { thread.muted = !thread.muted; saveNow('data'); s.close(); refresh(); } }, icon('bell'), thread.muted ? '取消免打扰' : '免打扰'),
            h('button', { class: 'mp-chip', type: 'button', onclick: () => { s.close(); removeThread(thread.id); refresh(); } }, icon('trash'), '删除会话'),
        ),
    ) });
    return s;
}

function previewOf(thread) {
    const msg = thread.msgs[thread.msgs.length - 1];
    if (!msg) return '开始聊天吧';
    const prefix = msg.from === 'me' ? '你：' : '';
    if (msg.type === 'voice') return prefix + '[语音]';
    if (msg.type === 'photo') return prefix + '[图片]';
    if (msg.type === 'sticker') return prefix + '[表情] ' + msg.text;
    if (msg.type === 'redpacket') return prefix + '[红包] ' + msg.text;
    if (msg.type === 'transfer') return prefix + '[转账] ' + msg.text;
    if (msg.type === 'location') return prefix + '[位置] ' + msg.text;
    if (msg.type === 'sys') return msg.text;
    return prefix + msg.text;
}

/* ================================= 对话 ================================= */

function mountConversation(host, nav, threadId) {
    let thread = findThread(threadId);
    if (!thread) {
        host.appendChild(h('div', { class: 'mp-empty' }, h('div', { class: 'mp-empty__title', text: '这个会话不在了' })));
        return {};
    }
    let generating = isBusy(threadId);
    let typing = false;
    let pinBottom = true;
    let scrollLock = 0;
    const burstTimers = [];

    // 兼容旧消息：把存成纯文本的 [s转账] / [红包] 重新解析成卡片
    (function migrateTags() {
        let changed = false;
        for (const msg of thread.msgs || []) {
            if (msg.type !== 'text' || !/^[\[【]/.test(String(msg.text || ''))) continue;
            const parsed = parseLine(msg.text);
            if (!parsed || parsed.type === 'text') continue;
            msg.type = parsed.type;
            msg.text = parsed.text;
            msg.meta = { ...(msg.meta || {}), ...(parsed.meta || {}) };
            changed = true;
        }
        if (changed) saveNow('data');
    })();

    const el = h('div', { class: 'mp-conv' });
    const bg = h('div', { class: 'mp-conv__bg' });
    const titleEl = h('div', { class: 'mp-nav__title' });
    const headAvatar = h('span', { class: 'mp-conv__avatarbox' });
    const statusEl = h('div', { class: 'mp-conv__status' });

    const head = h('div', { class: 'mp-nav' },
        h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.go('chat') }, icon('back')),
        h('div', { class: 'mp-nav__spacer' }),
        h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '更多', onclick: () => openMenu() }, icon('more')),
    );
    head.appendChild(h('div', { class: 'mp-conv__head' }, headAvatar, h('div', {}, titleEl, statusEl)));

    const scroll = h('div', { class: 'mp-conv__scroll' });
    const composer = buildComposer();
    el.append(bg, head, scroll, composer.root);
    host.appendChild(el);

    function renderHead() {
        thread = findThread(threadId) || thread;
        titleEl.textContent = thread.name || thread.members.join('、');
        headAvatar.innerHTML = '';
        headAvatar.appendChild(avatar({ name: thread.members[0], src: characterAvatar(thread.members[0]), size: 32 }));
        const person = thread.members.length === 1 ? findPerson(thread.members[0]) : null;
        statusEl.textContent = typing || generating ? '正在输入…' : (thread.members.length > 1 ? thread.members.length + ' 人群聊' : (person?.role || '在线'));
        statusEl.classList.toggle('is-typing', typing || generating);
    }

    function renderMessages() {
        const atBottom = isNearBottom();
        const prevTop = scroll.scrollTop;
        const prevHeight = scroll.scrollHeight;
        scroll.innerHTML = '';
        let lastName = '';
        let lastName2 = '';
        const all = Array.isArray(thread.msgs) ? thread.msgs : [];
        const visible = all.length > 120 ? all.slice(-120) : all;
        if (all.length > visible.length) {
            scroll.appendChild(h('div', { class: 'mp-time-mark', text: '更早的 ' + (all.length - visible.length) + ' 条消息已收起' }));
        }
        for (const msg of visible) {
            const showName = thread.members.length > 1 && msg.from === 'them' && msg.sender !== lastName;
            const showAvatar = !(msg.from === lastName2);
            lastName2 = msg.from;
            lastName = msg.sender;
            scroll.appendChild(messageEl(msg, showName, showAvatar));
        }
        if (typing || generating) {
            scroll.appendChild(h('div', { class: 'mp-typing' },
                avatar({ name: thread.members[0], src: characterAvatar(thread.members[0]), size: 30 }),
                h('div', { class: 'mp-typing__bubble' }, h('i'), h('i'), h('i')),
            ));
        }
        if (all.length === 0) {
            scroll.appendChild(starterBlock());
        }
        const keepBottom = typing || generating || atBottom || pinBottom || all.length < 2;
        if (keepBottom) {
            scroll.scrollTop = scroll.scrollHeight;
            requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
        } else if (prevHeight > 0) {
            scroll.scrollTop = Math.max(0, prevTop + (scroll.scrollHeight - prevHeight));
        }
        renderHead();
    }

    function starterBlock() {
        const suggestions = ['在吗？', '今天过得怎么样', '我有点想你'];
        return h('div', { class: 'mp-starter' },
            h('div', { class: 'mp-starter__title', text: '和「' + thread.members.join('、') + '」的第一句话' }),
            h('div', { class: 'mp-starter__chips' },
                suggestions.map(text => h('button', {
                    class: 'mp-chip', type: 'button', text,
                    onclick: () => { composer.input.value = text; composer.input.focus(); },
                })),
            ),
        );
    }

    function messageEl(msg, showName, showAvatar = true) {
        const mine = msg.from === 'me';
        if (msg.type === 'sys') {
            return h('div', { class: 'mp-time-mark', text: msg.text });
        }
        const inner = bubbleContent(msg);
        const canRead = !mine && msg.text && ['text', 'voice'].includes(msg.type) && getSettings().tts?.enabled;
        const ttsButton = canRead ? h('button', {
            type: 'button', class: 'mp-msg__tts', 'aria-label': '朗读',
            onclick: event => { event.stopPropagation(); speak(msg.text, { rate: getSettings().tts?.rate }); },
        }, icon('volume')) : null;
        const row = h('div', { class: 'mp-msg' + (mine ? ' me' : '') + (msg.state === 'failed' ? ' is-failed' : '') + (showAvatar ? '' : ' is-tail') },
            showAvatar
                ? avatar({ name: mine ? userName() : msg.sender || thread.members[0], src: mine ? personaAvatarUrl() : characterAvatar(msg.sender || thread.members[0]), size: 30 })
                : h('span', { class: 'mp-msg__gap' }),
            h('div', { class: 'mp-msg__col' },
                showName && !mine ? h('div', { class: 'mp-msg__sender', text: msg.sender || thread.members[0] }) : null,
                inner,
                ttsButton,
            ),
        );
        row.addEventListener('contextmenu', event => {
            event.preventDefault();
            messageMenu(msg);
        });
        let pressTimer = 0;
        row.addEventListener('pointerdown', () => { pressTimer = setTimeout(() => messageMenu(msg), 600); });
        row.addEventListener('pointerup', () => clearTimeout(pressTimer));
        row.addEventListener('pointerleave', () => clearTimeout(pressTimer));
        return row;
    }

    function bubbleContent(msg) {
        const mine = msg.from === 'me';
        if (msg.type === 'voice') return voiceBubble(msg);
        if (msg.type === 'photo') {
            const url = msg.meta?.url || resolveImage(msg.meta?.photoId);
            if (url) {
                return h('div', { class: 'mp-photo' },
                    h('img', { src: url, alt: '' }),
                    msg.text && msg.text !== '一张照片' ? h('div', { class: 'mp-photo__cap', text: msg.text }) : null,
                );
            }
            // 没有真图时，用一枚「拍立得」占位，颜色由文字决定，看起来是有意为之
            const hue = hashOf(msg.text) % 360;
            const art = h('div', {
                class: 'mp-photo__art',
                style: { background: 'linear-gradient(145deg, hsl(' + hue + ', 42%, 58%), hsl(' + ((hue + 46) % 360) + ', 34%, 34%))' },
            }, h('span', { class: 'mp-photo__glow' }), icon('camera'));
            return h('div', { class: 'mp-photo-card' }, art, h('div', { class: 'mp-photo__cap', text: msg.text || '一张照片' }));
        }
        if (msg.type === 'redpacket') return redPacket(msg, mine);
        if (msg.type === 'transfer') return transferCard(msg);
        if (msg.type === 'location') return locationCard(msg);
        if (msg.type === 'sticker') return h('div', { class: 'mp-bubble mp-bubble__sticker', text: msg.text });
        return h('div', { class: 'mp-bubble', text: msg.text });
    }

    function voiceBubble(msg) {
        const sec = Math.max(1, Math.round(msg.meta?.sec || 4));
        const bars = [];
        for (let i = 0; i < 14; i++) {
            const height = 6 + ((i * 7 + sec * 3) % 10);
            bars.push(h('i', { style: { height: height + 'px', animationDelay: (i * 60) + 'ms' } }));
        }
        const box = h('div', { class: 'mp-voice' },
            h('div', { class: 'mp-wave' }, bars),
            h('span', { class: 'mp-voice__len', text: sec + '"' }),
        );
        const wrap = h('div', { class: 'mp-voice-wrap' }, box);
        let playing = false;
        let timer = 0;
        box.addEventListener('click', () => {
            playing = !playing;
            box.classList.toggle('is-playing', playing);
            if (!playing) { clearTimeout(timer); return; }
            timer = setTimeout(() => {
                playing = false;
                box.classList.remove('is-playing');
                const shown = wrap.querySelector('.mp-voice__text');
                if (!shown && msg.text) wrap.appendChild(h('div', { class: 'mp-voice__text', text: msg.text }));
            }, Math.min(6000, sec * 700));
        });
        return wrap;
    }

    function redPacket(msg, mine) {
        const opened = !!msg.meta?.opened;
        const card = h('div', { class: 'mp-redpacket' + (opened ? ' is-opened' : '') },
            h('div', { class: 'mp-redpacket__top' },
                h('div', { class: 'mp-redpacket__icon' }, icon('envelope')),
                h('div', {},
                    h('div', { class: 'mp-redpacket__title', text: msg.text || '恭喜发财，大吉大利' }),
                    h('div', { class: 'mp-redpacket__sub', text: mine ? '你发出的红包' : '来自' + (msg.sender || thread.members[0]) }),
                ),
            ),
            h('div', { class: 'mp-redpacket__foot' },
                h('span', { text: mine ? (opened ? '已领取' : '等对方领取') : (opened ? '已领取' : '领取红包') }),
                h('span', { text: '¥' + Number(msg.meta?.amount || 0).toFixed(2) }),
            ),
        );
        if (!mine && !opened) {
            card.addEventListener('click', () => {
                msg.meta = { ...(msg.meta || {}), opened: true };
                saveNow('data');
                toast('已领取 ¥' + Number(msg.meta.amount || 0).toFixed(2) + '，存入钱包');
                haptic(12);
                renderMessages();
            });
        }
        return card;
    }

    function transferCard(msg) {
        return h('div', { class: 'mp-transfer' },
            h('div', { class: 'mp-transfer__row' }, icon('transfer'), h('span', { text: msg.from === 'me' ? '转账给' + (msg.sender || thread.members[0]) : '转账' })),
            h('div', { class: 'mp-transfer__amount', text: '¥' + Number(msg.meta?.amount || 0).toFixed(2) }),
            h('div', { class: 'mp-transfer__note', text: msg.text || '' }),
        );
    }

    function locationCard(msg) {
        return h('div', { class: 'mp-location', onclick: () => toast('地图还没画完，先记住这个地方：' + msg.text) },
            h('div', { class: 'mp-location__map' }, h('span', { class: 'mp-location__pin' }, icon('location'))),
            h('div', { class: 'mp-location__name', text: msg.text || '某个地方' }),
        );
    }

    function messageMenu(msg) {
        sheet({ title: '这条消息', content: h('div', { class: 'mp-field-list' },
            h('div', { class: 'mp-chips' },
                h('button', { class: 'mp-chip', type: 'button', text: '复制', onclick: async () => { try { await navigator.clipboard.writeText(msg.text || ''); toast('已复制'); } catch { toast('复制失败'); } } }),
                msg.from === 'them' ? h('button', { class: 'mp-chip', type: 'button', text: '带进剧情', onclick: () => bring() }) : null,
                h('button', { class: 'mp-chip', type: 'button', text: '删除', onclick: () => { thread.msgs = thread.msgs.filter(m => m.id !== msg.id); saveNow('data'); renderMessages(); } }),
            ),
        ) });
    }

    function bring() {
        setOneShot(quoteForBring(thread));
        nav.toast('会在酒馆下一次回复时带上这段对话');
    }

    let menuSheet = null;
    function openMenu() {
        menuSheet = sheet({ title: '会话设置', content: h('div', { class: 'mp-field-list' },
            h('div', { class: 'mp-chips' },
                h('button', { class: 'mp-chip', type: 'button', onclick: () => { menuSheet?.close(); bring(); } }, icon('sparkle'), '带进剧情'),
                h('button', { class: 'mp-chip', type: 'button', onclick: () => { menuSheet?.close(); askReply(); } }, icon('message'), '让 TA 回一条'),
                h('button', { class: 'mp-chip', type: 'button', onclick: () => { menuSheet?.close(); editNote(); } }, icon('edit'), '关系备注'),
                h('button', { class: 'mp-chip', type: 'button', onclick: () => { menuSheet?.close(); clearThread(); } }, icon('trash'), '清空记录'),
            ),
        ) });
    }

    function editNote() {
        const input = h('input', { class: 'mp-input', type: 'text', value: thread.note || '', placeholder: '例如：认识三年的朋友，说话很冲' });
        const s = sheet({
            title: '关系备注', content: h('div', { class: 'mp-field-list' }, h('div', {}, h('label', { text: '会写进提示词，帮 TA 记得你们的关系' }), input)),
            actions: h('button', { class: 'mp-btn primary small', type: 'button', text: '保存', onclick: () => { thread.note = input.value.trim(); saveNow('data'); renderHead(); s.close(); } }),
        });
    }

    async function clearThread() {
        const ok = await confirmSheet('清空这段聊天的所有消息？', { ok: '清空', danger: true });
        if (!ok) return;
        thread.msgs = [];
        thread.unread = 0;
        saveNow('data');
        renderMessages();
    }

    /* ------------------------------ 输入区 ------------------------------ */

    function buildComposer() {
        const input = h('textarea', { rows: '1', placeholder: '发消息…', 'aria-label': '消息输入框' });
        const sendBtn = h('button', { class: 'mp-composer__send', type: 'button', 'aria-label': '发送', disabled: true }, icon('send'));
        const plusBtn = h('button', { class: 'mp-composer__plus', type: 'button', 'aria-label': '更多', onclick: () => toggleQuick() }, icon('plus'));
        const quick = h('div', { class: 'mp-quick' },
            quickChip('图片', 'image', () => photoSheet()),
            quickChip('语音', 'mic', () => voiceSheet()),
            quickChip('红包', 'envelope', () => moneySheet('redpacket')),
            quickChip('转账', 'transfer', () => moneySheet('transfer')),
            quickChip('位置', 'location', () => locationSheet()),
            quickChip('表情', 'sparkle', () => emojiSheet()),
        );
        quick.style.display = 'flex';
        const panel = h('div', { class: 'mp-composer__panel' });
        const panelItems = [
            ['图片', 'image', () => photoSheet()],
            ['语音', 'mic', () => voiceSheet()],
            ['红包', 'envelope', () => moneySheet('redpacket')],
            ['转账', 'transfer', () => moneySheet('transfer')],
            ['位置', 'location', () => locationSheet()],
            ['表情', 'sparkle', () => emojiSheet()],
        ];
        for (const [label, iconName, action] of panelItems) {
            panel.appendChild(h('button', {
                type: 'button', class: 'mp-panel__item',
                onclick: () => { closePanel(); action(); },
            }, h('span', { class: 'mp-panel__ico' }, icon(iconName)), h('span', { text: label })));
        }
        const handle = h('button', { type: 'button', class: 'mp-composer__handle', 'aria-label': '展开操作面板' }, h('i'));
        let handleStart = null;
        handle.addEventListener('pointerdown', event => {
            handleStart = { y: event.clientY };
            handle.setPointerCapture?.(event.pointerId);
        });
        handle.addEventListener('pointerup', event => {
            if (!handleStart) return;
            const dy = event.clientY - handleStart.y;
            handleStart = null;
            if (dy < -18) openPanel();
            else if (dy > 18) closePanel();
            else if (panel.classList.contains('on')) closePanel();
            else openPanel();
        });
        const wrap = h('div', { class: 'mp-composer' }, handle, panel, quick,
            h('div', { class: 'mp-composer__row' }, plusBtn,
                h('div', { class: 'mp-composer__field' }, input),
                sendBtn,
            ));
        const row = wrap.querySelector('.mp-composer__row');
        enableDragScroll(quick);

        input.addEventListener('input', () => {
            autoGrow();
            sendBtn.disabled = !input.value.trim() || generating;
        });
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                send();
            }
        });
        sendBtn.addEventListener('click', send);

        function autoGrow() {
            input.style.height = 'auto';
            input.style.height = Math.min(168, input.scrollHeight) + 'px';
        }

        function openPanel() {
            panel.classList.add('on');
            plusBtn.classList.add('is-open');
        }

        function closePanel() {
            panel.classList.remove('on');
            plusBtn.classList.remove('is-open');
        }

        function toggleQuick() {
            if (panel.classList.contains('on')) closePanel();
            else openPanel();
        }

        function quickChip(label, iconName, onClick) {
            return h('button', { type: 'button', onclick: onClick }, icon(iconName), label);
        }

        async function send() {
            const text = input.value.trim();
            if (!text || generating) return;
            pinBottom = true;
            sendMe({ type: 'text', text });
            input.value = '';
            autoGrow();
            sendBtn.disabled = true;
            scrollLock = Date.now() + 1600;
            scrollToBottom(false);
            forceBottomBurst();
            await askReply();
        }

        function sendMe(payload) {
            pinBottom = true;
            const msg = { id: uid(), from: 'me', type: payload.type || 'text', text: payload.text || '', meta: payload.meta || {}, ts: Date.now() };
            appendMessages(thread.id, msg);
            haptic(6);
            renderMessages();
            scroll.scrollTop = scroll.scrollHeight;
            scrollToBottom(false);
            forceBottomBurst();
            return msg;
        }

        async function askReply() {
            if (generating) return;
            pinBottom = true;
            generating = true;
            typing = true;
            forceBottomBurst();
            sendBtn.disabled = true;
            renderMessages();
            try {
                const messages = await replyToThread(thread.id);
                if (!messages.length) toast('TA 这次没有回复');
            } catch (error) {
                console.warn(error);
                toast('生成失败：' + friendlyError(error), 3800);
            } finally {
                generating = false;
                typing = false;
                thread = findThread(thread.id) || thread;
                markRead(threadId);
                renderMessages();
                scrollToBottom(false);
                forceBottomBurst();
                sendBtn.disabled = !input.value.trim();
            }
        }

        function photoSheet() {
            const file = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
            const desc = h('input', { class: 'mp-input', type: 'text', placeholder: '配一句话（可以留空）' });
            const pick = h('button', { class: 'mp-btn', type: 'button', text: '选一张照片' });
            const preview = h('div', { class: 'mp-photo-preview' });
            let stored = null;
            pick.addEventListener('click', () => file.click());
            file.addEventListener('change', async () => {
                const f = file.files?.[0];
                if (!f) return;
                try {
                    stored = await storeImage(f);
                    preview.innerHTML = '';
                    preview.appendChild(h('img', { src: stored.url, alt: '' }));
                    toast('照片已准备好');
                } catch (error) {
                    toast('读不到这张图片：' + error.message);
                }
            });
            const s = sheet({
                title: '发一张照片',
                content: h('div', { class: 'mp-field-list' }, preview, pick, file, desc),
                actions: h('button', {
                    class: 'mp-btn primary small', type: 'button', text: '发送',
                    onclick: () => {
                        s.close();
                        sendMe({ type: 'photo', text: desc.value.trim() || '一张照片', meta: stored ? { photoId: stored.id, url: stored.url } : {} });
                        askReply();
                    },
                }),
            });
        }

        function voiceSheet() {
            const area = h('textarea', { class: 'mp-input', rows: '3', placeholder: '按语音内容的长度自动生成时长' });
            const s = sheet({
                title: '发语音',
                content: h('div', { class: 'mp-field-list' }, area, h('div', { class: 'mp-st-hint', text: '对方会收到一条语音，点开可以看文字。' })),
                actions: h('button', {
                    class: 'mp-btn primary small', type: 'button', text: '发送',
                    onclick: () => {
                        const text = area.value.trim();
                        if (!text) return;
                        s.close();
                        sendMe({ type: 'voice', text, meta: { sec: Math.min(60, Math.max(2, Math.round(text.length * 0.3))) } });
                        askReply();
                    },
                }),
            });
        }

        function moneySheet(kind) {
            const amount = h('input', { class: 'mp-input', type: 'number', min: '0.01', step: '1', value: kind === 'redpacket' ? '8.88' : '52' });
            const note = h('input', { class: 'mp-input', type: 'text', placeholder: kind === 'redpacket' ? '祝福语（恭喜发财，大吉大利）' : '备注（可以留空）' });
            const s = sheet({
                title: kind === 'redpacket' ? '发红包' : '转账',
                content: h('div', { class: 'mp-field-list' },
                    h('div', {}, h('label', { text: '金额' }), amount),
                    h('div', {}, h('label', { text: kind === 'redpacket' ? '祝福语' : '备注' }), note)),
                actions: h('button', {
                    class: 'mp-btn primary small', type: 'button', text: '发送',
                    onclick: () => {
                        const value = Math.max(0.01, Number(amount.value) || 0);
                        s.close();
                        sendMe({
                            type: kind,
                            text: note.value.trim() || (kind === 'redpacket' ? '恭喜发财，大吉大利' : ''),
                            meta: { amount: value },
                        });
                        askReply();
                    },
                }),
            });
        }

        function locationSheet() {
            const place = h('input', { class: 'mp-input', type: 'text', placeholder: '例如：老城区的桥边' });
            const s = sheet({
                title: '发位置',
                content: h('div', { class: 'mp-field-list' }, place),
                actions: h('button', {
                    class: 'mp-btn primary small', type: 'button', text: '发送',
                    onclick: () => {
                        const text = place.value.trim();
                        if (!text) return;
                        s.close();
                        sendMe({ type: 'location', text });
                        askReply();
                    },
                }),
            });
            setTimeout(() => place.focus(), 200);
        }

        function emojiSheet() {
            const grid = h('div', { class: 'mp-emoji-grid' });
            for (const emoji of EMOJIS) {
                grid.appendChild(h('button', {
                    type: 'button', class: 'mp-emoji', text: emoji,
                    onclick: () => { s.close(); sendMe({ type: 'sticker', text: emoji }); askReply(); },
                }));
            }
            const s = sheet({ title: '表情', content: h('div', { class: 'mp-field-list' }, grid) });
        }

        return { root: wrap, input, sendBtn, row, askReply };
    }

    function isNearBottom() {
        return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 120;
    }

    function cancelBurst() {
        while (burstTimers.length) clearTimeout(burstTimers.pop());
    }

    function forceBottomBurst() {
        cancelBurst();
        for (const delay of [0, 50, 150, 300, 600, 900, 1400]) {
            burstTimers.push(setTimeout(() => {
                scroll.scrollTop = scroll.scrollHeight;
                scrollLock = Date.now() + 300;
            }, delay));
        }
    }

    function scrollToBottom(smooth = false) {
        pinBottom = true;
        scrollLock = Date.now() + 600;
        const jump = () => { scroll.scrollTop = scroll.scrollHeight; scrollLock = Date.now() + 600; };
        requestAnimationFrame(() => {
            if (smooth) scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' });
            else jump();
            requestAnimationFrame(jump);
        });
    }

    const pinNow = () => {
        if (!pinBottom && !typing && !generating) return;
        requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });
    };
    scroll.addEventListener('pointerdown', cancelBurst, { passive: true });
    scroll.addEventListener('wheel', cancelBurst, { passive: true });
    scroll.addEventListener('scroll', () => {
        // 渲染清空、键盘重排引发的滚动事件不算“用户往上翻”
        if (Date.now() < scrollLock) return;
        pinBottom = isNearBottom();
    }, { passive: true });
    const contentObserver = typeof MutationObserver === 'function'
        ? new MutationObserver(() => pinNow())
        : null;
    contentObserver?.observe(scroll, { childList: true });
    const resizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => pinNow())
        : null;
    resizeObserver?.observe(scroll);

    function askReply() {
        return composer.askReply();
    }

    /* ------------------------------ 事件 ------------------------------ */

    const onTyping = event => {
        const detail = event.detail || {};
        if (detail.threadId !== threadId) return;
        typing = !!detail.typing;
        renderHead();
        if (typing) scrollToBottom(false);
    };
    const onReply = event => {
        const detail = event.detail || {};
        if (detail.threadId !== threadId) return;
        thread = findThread(threadId) || thread;
        markRead(threadId);
        pinBottom = true;
        renderMessages();
        pinBottom = true;
        scrollToBottom(false);
        forceBottomBurst();
        const tts = getSettings().tts;
        if (tts?.enabled && tts.auto) {
            const last = (detail.messages || [])[detail.messages.length - 1];
            if (last?.text) speak(last.text, { rate: tts.rate });
        }
    };
    const onViewportChange = () => {
        if (typing || generating || isNearBottom()) scrollToBottom(false);
    };
    globalThis.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });
    aiEvents.addEventListener('typing', onTyping);
    aiEvents.addEventListener('reply', onReply);

    markRead(threadId);
    renderMessages();
    setTimeout(() => scrollToBottom(false), 60);

    return {
        refresh() {
            thread = findThread(threadId) || thread;
            renderMessages();
        },
        setTyping(id, value) {
            if (id !== threadId) return;
            typing = value;
            renderHead();
            renderMessages();
        },
        destroy() {
            contentObserver?.disconnect();
            resizeObserver?.disconnect();
            globalThis.visualViewport?.removeEventListener('resize', onViewportChange);
            aiEvents.removeEventListener('typing', onTyping);
            aiEvents.removeEventListener('reply', onReply);
            stopTts();
        },
    };
}

function isToday(ts) {
    const d = new Date(ts);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
/** 横向拖动 / 鼠标滚轮滚动快捷栏 */
function enableDragScroll(el) {
    let drag = null;
    let lastDrag = 0;
    el.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        drag = { x: event.clientX, left: el.scrollLeft, moved: false };
        el.setPointerCapture?.(event.pointerId);
    });
    el.addEventListener('pointermove', event => {
        if (!drag) return;
        const dx = event.clientX - drag.x;
        if (Math.abs(dx) > 4) {
            drag.moved = true;
            el.scrollLeft = drag.left - dx;
            event.preventDefault();
        }
    });
    const end = () => {
        if (drag?.moved) lastDrag = Date.now();
        drag = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', event => {
        if (Date.now() - lastDrag < 320) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);
    el.addEventListener('wheel', event => {
        const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        if (!delta) return;
        el.scrollLeft += delta;
        event.preventDefault();
    }, { passive: false });
}