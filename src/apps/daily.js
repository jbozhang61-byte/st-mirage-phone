/** 日历 / 直播 / 豆瓣 / 闲鱼 / 出行：和正文连动的日常 App。 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { getData, saveNow, getCast, ensureThread } from '../store.js';
import { userName } from '../st.js';
import { artFor } from '../art.js';
import { generateCalendarEvents, generateLiveRooms, generateDouban, generateXianyu } from '../storyseed.js';

function store(id, init) {
    const data = getData();
    data.appsData = data.appsData && typeof data.appsData === 'object' ? data.appsData : {};
    if (!data.appsData[id] || typeof data.appsData[id] !== 'object') data.appsData[id] = init();
    return data.appsData[id];
}

function save() { saveNow('data'); }

function today() { return new Date().toISOString().slice(0, 10); }

/* --------------------------------- 日历 --------------------------------- */

export function mountCalendar(host, { nav }) {
    nav.setChrome?.('dark');
    const body = h('div', { class: 'mp-cal__body' });
    const el = h('div', { class: 'mp-cal' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '日历', h('small', { text: 'CALENDAR' })),
            h('button', { class: 'mp-nav__btn accent', type: 'button', 'aria-label': '添加日程', onclick: () => addEvent() }, icon('plus')),
        ),
        body,
    );
    host.appendChild(el);
    let selected = today();

    function events() {
        return store('calendar', () => ({ items: [] })).items;
    }

    function render() {
        const list = events();
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const first = new Date(year, month, 1).getDay();
        const days = new Date(year, month + 1, 0).getDate();
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'mp-cal__month', text: year + ' 年 ' + (month + 1) + ' 月' }));
        const grid = h('div', { class: 'mp-cal__grid' });
        for (const label of ['日', '一', '二', '三', '四', '五', '六']) grid.appendChild(h('span', { class: 'mp-cal__wd', text: label }));
        for (let i = 0; i < first; i++) grid.appendChild(h('span'));
        for (let day = 1; day <= days; day++) {
            const date = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            const has = list.some(item => item.date === date);
            grid.appendChild(h('button', {
                type: 'button', class: 'mp-cal__day' + (date === today() ? ' is-today' : '') + (date === selected ? ' on' : ''),
                onclick: () => { selected = date; render(); },
            }, String(day), has ? h('i', { class: 'mp-cal__dot' }) : null));
        }
        body.appendChild(grid);

        const dayEvents = list.filter(item => item.date === selected).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        body.appendChild(h('div', { class: 'mp-cal__daytitle', text: selected + (dayEvents.length ? ' · ' + dayEvents.length + ' 件事' : ' · 没有安排') }));
        for (const item of dayEvents) {
            body.appendChild(h('div', { class: 'mp-cal__event' },
                h('div', { class: 'mp-cal__time', text: item.time || '全天' }),
                h('div', {}, h('b', { text: item.title }), item.note ? h('div', { class: 'mp-cal__note', text: item.note }) : null),
                h('button', { type: 'button', class: 'mp-cal__del', onclick: () => {
                    const data = store('calendar', () => ({ items: [] }));
                    data.items = data.items.filter(entry => entry.id !== item.id);
                    save(); render();
                } }, icon('trash')),
            ));
        }
        body.appendChild(h('button', { type: 'button', class: 'mp-cal__ai', onclick: () => extract() }, icon('sparkle'), '从正文里提取日程'));
    }

    function addEvent() {
        const title = h('input', { class: 'mp-input', type: 'text', placeholder: '要做什么' });
        const date = h('input', { class: 'mp-input', type: 'date', value: selected });
        const time = h('input', { class: 'mp-input', type: 'time', value: '19:00' });
        const note = h('input', { class: 'mp-input', type: 'text', placeholder: '和谁、在哪' });
        const s = sheet({
            title: '添加日程',
            content: h('div', { class: 'mp-field-list' },
                h('div', {}, h('label', { text: '标题' }), title),
                h('div', {}, h('label', { text: '日期' }), date),
                h('div', {}, h('label', { text: '时间' }), time),
                h('div', {}, h('label', { text: '备注' }), note),
            ),
            actions: h('button', { class: 'mp-btn primary small', type: 'button', text: '保存', onclick: () => {
                if (!title.value.trim()) { toast('写个标题'); return; }
                const data = store('calendar', () => ({ items: [] }));
                data.items.push({ id: 'c' + Date.now().toString(36), title: title.value.trim().slice(0, 50), date: date.value || selected, time: time.value, note: note.value.trim().slice(0, 120) });
                save(); s.close(); render();
            } }),
        });
    }

    async function extract() {
        toast('正在从正文里找日程…');
        try {
            const list = await generateCalendarEvents();
            const data = store('calendar', () => ({ items: [] }));
            let added = 0;
            for (const event of list) {
                if (data.items.some(item => item.title === event.title && item.date === event.date)) continue;
                data.items.push({ ...event, id: 'c' + Date.now().toString(36) + added });
                added++;
            }
            save(); render();
            toast(added ? '新增 ' + added + ' 条日程' : '正文里没有新日程');
        } catch (error) { toast(String(error?.message || '提取失败'), 3000); }
    }

    render();
    return { refresh: render };
}

/* --------------------------------- 直播 --------------------------------- */

export function mountLive(host, { nav }) {
    nav.setChrome?.('dark');
    const body = h('div', { class: 'mp-live__body' });
    const el = h('div', { class: 'mp-live' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '直播', h('small', { text: 'LIVE' })),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '刷新', onclick: () => refresh() }, icon('refresh')),
        ),
        body,
    );
    host.appendChild(el);

    function rooms() {
        const cast = getCast();
        const data = store('live', () => ({ rooms: cast.slice(0, 4).map((person, index) => ({
            id: 'l' + index, title: ['深夜电台：说说今天', '一起看雪', '随便聊聊', '旧城夜班'][index] || '直播中',
            streamer: person.name, viewers: 300 + index * 170, category: '聊天', messages: [],
        })) }));
        return data;
    }

    function render() {
        const data = rooms();
        body.innerHTML = '';
        for (const room of data.rooms) {
            body.appendChild(h('button', { type: 'button', class: 'mp-live__card', onclick: () => openRoom(room) },
                h('div', { class: 'mp-live__cover', style: { backgroundImage: artFor(room.id + room.title, 'dusk') } },
                    h('span', { class: 'mp-live__badge', text: 'LIVE' }),
                    h('span', { class: 'mp-live__viewers', text: room.viewers + ' 人' }),
                    h('span', { class: 'mp-live__play' }, icon('play', '', 24)),
                ),
                h('div', { class: 'mp-live__title', text: room.title }),
                h('div', { class: 'mp-live__meta' }, avatar({ name: room.streamer, size: 20 }), h('span', { text: room.streamer }), h('span', { class: 'mp-live__cat', text: room.category })),
            ));
        }
        if (!data.rooms.length) body.appendChild(h('div', { class: 'mp-live__empty', text: '现在没有人在直播。' }));
    }

    async function refresh() {
        toast('正在连上直播…');
        try {
            const rooms = await generateLiveRooms();
            if (rooms.length) {
                const data = rooms();
                data.rooms = rooms.map((room, index) => ({ ...room, id: 'l' + Date.now().toString(36) + index }));
                save(); render();
            }
            toast('直播已更新');
        } catch (error) { toast(String(error?.message || '刷新失败'), 3000); }
    }

    function openRoom(room) {
        const screen = document.querySelector('.mp-screen');
        if (!screen) return;
        const chip = document.querySelector('.mp-backchip');
        if (chip) chip.style.display = 'none';
        const close = () => { page.classList.add('is-closing'); setTimeout(() => { page.remove(); if (chip) chip.style.display = ''; }, 220); };
        const messages = (room.messages && room.messages.length ? room.messages : [{ name: room.streamer, text: '晚上好，今天也在这里。' }]).slice();
        const list = h('div', { class: 'mp-live__chat' });
        const draw = () => {
            list.innerHTML = '';
            for (const msg of messages) list.appendChild(h('div', { class: 'mp-live__msg' }, h('b', { text: msg.name }), h('span', { text: msg.text })));
            list.scrollTop = list.scrollHeight;
        };
        draw();
        const input = h('input', { class: 'mp-cm__input', type: 'text', placeholder: '发一条弹幕…' });
        const send = () => {
            const text = input.value.trim();
            if (!text) return;
            messages.push({ name: userName() || '我', text });
            room.messages = messages;
            input.value = '';
            draw();
            save();
        };
        const page = h('div', { class: 'mp-live-page' },
            h('div', { class: 'mp-live-page__bar' },
                h('button', { type: 'button', class: 'mp-nav__btn', onclick: close }, icon('back')),
                h('div', { class: 'mp-live-page__title', text: room.title }),
                h('span', { class: 'mp-live__badge', text: 'LIVE' }),
            ),
            h('div', { class: 'mp-live-page__stage', style: { backgroundImage: artFor(room.id + room.title, 'night') } },
                h('div', { class: 'mp-live-page__streamer' }, avatar({ name: room.streamer, size: 40 }), h('b', { text: room.streamer }), h('span', { text: room.viewers + ' 人正在看' })),
            ),
            list,
            h('div', { class: 'mp-cm__composer' }, input, h('button', { type: 'button', class: 'mp-cm__send', onclick: send }, '发送')),
        );
        screen.appendChild(page);
        setTimeout(() => input.focus?.(), 200);
    }

    render();
    return { refresh: render };
}

/* --------------------------------- 豆瓣 --------------------------------- */

export function mountDouban(host, { nav }) {
    nav.setChrome?.('dark');
    const body = h('div', { class: 'mp-db__body' });
    const tabs = h('div', { class: 'mp-db__tabs' });
    const el = h('div', { class: 'mp-db' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '豆瓣', h('small', { text: 'DOUBAN' })),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '刷新', onclick: () => refresh() }, icon('refresh')),
        ),
        tabs, body,
    );
    host.appendChild(el);
    let kind = '书';

    function dataFor() { return store('douban', () => ({ '书': [], '影': [], '音': [] })); }

    function paintTabs() {
        tabs.innerHTML = '';
        for (const name of ['书', '影', '音']) tabs.appendChild(h('button', {
            type: 'button', class: 'mp-db__tab' + (kind === name ? ' on' : ''), text: name,
            onclick: () => { kind = name; paintTabs(); render(); },
        }));
    }

    function render() {
        const data = dataFor();
        paintTabs();
        body.innerHTML = '';
        const list = data[kind] || [];
        for (const item of list) {
            body.appendChild(h('button', { type: 'button', class: 'mp-db__row', onclick: () => openItem(item) },
                h('div', { class: 'mp-db__cover', text: item.title.slice(0, 1) }),
                h('div', { class: 'mp-db__main' },
                    h('div', { class: 'mp-db__title', text: item.title }),
                    h('div', { class: 'mp-db__creator', text: [item.creator, item.year ? String(item.year) : ''].filter(Boolean).join(' · ') }),
                    h('div', { class: 'mp-db__stars' }, '★ ' + Number(item.rating || 0).toFixed(1), h('span', { text: ' · ' + item.reviewer })),
                    h('div', { class: 'mp-db__review', text: item.review }),
                ),
            ));
        }
        if (!list.length) body.appendChild(h('div', { class: 'mp-db__empty', text: '还没有' + kind + '，点右上角刷新。' }));
        body.appendChild(h('button', { type: 'button', class: 'mp-db__refresh', onclick: () => refresh() }, icon('sparkle'), '让角色来评分'));
    }

    function openItem(item) {
        sheet({ title: item.title, content: h('div', { class: 'mp-field-list' },
            h('div', { class: 'mp-db__detailmeta', text: [item.creator, item.year ? String(item.year) : '', '★ ' + Number(item.rating || 0).toFixed(1)].filter(Boolean).join(' · ') }),
            h('div', { class: 'mp-db__review', text: item.review }),
            h('div', { class: 'mp-st-hint', text: item.reviewer + ' 的短评' }),
        ) });
    }

    async function refresh() {
        toast('正在让角色打分…');
        try {
            const list = await generateDouban(kind);
            if (list.length) {
                const data = dataFor();
                data[kind] = list.map((item, index) => ({ ...item, id: kind + Date.now().toString(36) + index }));
                save(); render();
            }
            toast('已更新');
        } catch (error) { toast(String(error?.message || '刷新失败'), 3000); }
    }

    paintTabs(); render();
    return { refresh: render };
}

/* --------------------------------- 闲鱼 --------------------------------- */

export function mountXianyu(host, { nav }) {
    nav.setChrome?.('dark');
    const body = h('div', { class: 'mp-xy__body' });
    const el = h('div', { class: 'mp-xy' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '闲鱼', h('small', { text: 'SECOND HAND' })),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '刷新', onclick: () => refresh() }, icon('refresh')),
        ),
        body,
    );
    host.appendChild(el);

    function list() { return store('xianyu', () => ({ items: [] })).items; }

    function render() {
        const items = list();
        body.innerHTML = '';
        const grid = h('div', { class: 'mp-xy__grid' });
        for (const item of items) {
            grid.appendChild(h('button', { type: 'button', class: 'mp-xy__card', onclick: () => openItem(item) },
                h('div', { class: 'mp-xy__img', style: { backgroundImage: artFor(item.id + item.title, 'night') } }, h('span', { class: 'mp-xy__cond', text: item.condition })),
                h('div', { class: 'mp-xy__title', text: item.title }),
                h('div', { class: 'mp-xy__price', text: '¥' + item.price }),
                h('div', { class: 'mp-xy__seller', text: item.seller }),
            ));
        }
        body.appendChild(grid);
        if (!items.length) body.appendChild(h('div', { class: 'mp-xy__empty', text: '还没有人出东西。' }));
    }

    function openItem(item) {
        const cast = getCast().map(person => person.name);
        const s = sheet({
            title: item.title,
            content: h('div', { class: 'mp-field-list' },
                h('div', { class: 'mp-xy__detailimg', style: { backgroundImage: artFor(item.id + item.title, 'night') } }),
                h('div', { class: 'mp-xy__price', text: '¥' + item.price }),
                h('div', { class: 'mp-xy__desc', text: item.desc }),
                h('div', { class: 'mp-st-hint', text: item.seller + ' · ' + item.condition }),
            ),
            actions: h('button', { class: 'mp-btn primary small', type: 'button', text: '联系卖家', onclick: () => {
                s.close();
                if (cast.includes(item.seller)) {
                    const thread = ensureThread([item.seller], { note: '闲鱼卖家' });
                    if (thread) nav.go('chat', { threadId: thread.id });
                } else toast('已私信卖家');
            } }),
        });
    }

    async function refresh() {
        toast('正在翻闲鱼…');
        try {
            const items = await generateXianyu();
            if (items.length) {
                const data = store('xianyu', () => ({ items: [] }));
                data.items = items.map((item, index) => ({ ...item, id: 'x' + Date.now().toString(36) + index }));
                save(); render();
            }
            toast('已更新');
        } catch (error) { toast(String(error?.message || '刷新失败'), 3000); }
    }

    render();
    return { refresh: render };
}

/* --------------------------------- 出行 --------------------------------- */

export function mountTravel(host, { nav }) {
    nav.setChrome?.('dark');
    const body = h('div', { class: 'mp-tv__body' });
    const el = h('div', { class: 'mp-tv' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '出行', h('small', { text: 'TRAVEL' })),
            h('div', { class: 'mp-nav__spacer' }),
        ),
        body,
    );
    host.appendChild(el);
    let mode = '打车';
    let from = getData().meta?.city || '旧城';
    let to = '北境';

    function orders() { return store('travel', () => ({ orders: [] })); }

    function render() {
        body.innerHTML = '';
        const tabs = h('div', { class: 'mp-tv__tabs' });
        for (const name of ['打车', '火车']) tabs.appendChild(h('button', {
            type: 'button', class: 'mp-tv__tab' + (mode === name ? ' on' : ''), text: name,
            onclick: () => { mode = name; render(); },
        }));
        body.appendChild(tabs);
        const fromInput = h('input', { class: 'mp-input', type: 'text', value: from, placeholder: '从哪出发' });
        const toInput = h('input', { class: 'mp-input', type: 'text', value: to, placeholder: '去哪' });
        body.appendChild(h('div', { class: 'mp-tv__form' }, fromInput, h('span', { text: '→' }), toInput));
        const go = () => {
            from = fromInput.value.trim() || from;
            to = toInput.value.trim() || to;
            renderResults();
        };
        body.appendChild(h('button', { type: 'button', class: 'mp-tv__go', text: mode === '打车' ? '叫车' : '查车次', onclick: go }));
        const results = h('div', { class: 'mp-tv__results' });
        body.appendChild(results);

        function renderResults(initial = true) {
            if (initial) return;
            results.innerHTML = '';
            if (mode === '打车') {
                for (const [name, price, eta] of [['快车', 26, '6 分钟'], ['专车', 48, '8 分钟'], ['拼车', 14, '12 分钟']]) {
                    results.appendChild(h('div', { class: 'mp-tv__option' },
                        h('div', {}, h('b', { text: name }), h('div', { class: 'mp-tv__sub', text: eta + ' 后到' })),
                        h('span', { class: 'mp-tv__price', text: '¥' + price }),
                        h('button', { type: 'button', class: 'mp-btn small', text: '叫车', onclick: () => book(name + ' · ' + from + ' → ' + to, price) }),
                    ));
                }
            } else {
                for (const [name, time, price] of [['K2041', '19:40', 88], ['G812', '20:15', 168], ['D331', '21:02', 112]]) {
                    results.appendChild(h('div', { class: 'mp-tv__option' },
                        h('div', {}, h('b', { text: name }), h('div', { class: 'mp-tv__sub', text: time + ' · ' + from + ' → ' + to })),
                        h('span', { class: 'mp-tv__price', text: '¥' + price }),
                        h('button', { type: 'button', class: 'mp-btn small', text: '订票', onclick: () => book(name + ' · ' + from + ' → ' + to, price) }),
                    ));
                }
            }
        }

        function book(title, price) {
            const data = orders();
            data.orders.push({ id: 't' + Date.now().toString(36), title, price, ts: Date.now() });
            save();
            toast('已下单：' + title);
        }
        renderResults(false);
        const data = orders();
        if (data.orders.length) {
            body.appendChild(h('div', { class: 'mp-tv__orders-title', text: '最近订单' }));
            for (const order of data.orders.slice(-3).reverse()) {
                body.appendChild(h('div', { class: 'mp-tv__order' }, h('b', { text: order.title }), h('span', { text: '¥' + order.price })));
            }
        }
    }

    render();
    return { refresh: render };
}
