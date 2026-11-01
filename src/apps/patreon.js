/** Patreon：给创作者打钱，看会员内容。 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { getCast, getData, saveNow } from '../store.js';

const TIERS = [
    { price: 8, name: '围观' },
    { price: 28, name: '会员' },
    { price: 98, name: '赞助人' },
];

function creators() {
    const cast = getCast();
    const list = cast.slice(0, 8).map((person, index) => ({
        name: person.name,
        role: person.role || person.relation || '创作者',
        tier: index % TIERS.length,
        post: (person.desc || '在这里更新日常、幕后和一些不适合公开发的东西。').slice(0, 90),
    }));
    if (list.length) return list;
    return [{ name: '旧城电台', role: '独立播客', tier: 1, post: '这周的节目还在剪，会员可以提前听完整版。' }];
}

export function mountPatreon(host, { nav }) {
    const body = h('div', { class: 'mp-webapp__body' });
    const el = h('div', { class: 'mp-webapp' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, 'Patreon', h('small', { text: '订阅' })),
            h('div', { class: 'mp-nav__spacer' }),
        ),
        body,
    );
    host.appendChild(el);

    const data = getData();
    data.patreon = data.patreon && typeof data.patreon === 'object' ? data.patreon : { subs: {} };
    if (!data.patreon.subs || typeof data.patreon.subs !== 'object') data.patreon.subs = {};

    function render() {
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'mp-webapp__hero' },
            h('div', { class: 'mp-webapp__logo' }, icon('heart')),
            h('div', { class: 'mp-webapp__title', text: '这个世界的创作者' }),
            h('div', { class: 'mp-webapp__sub', text: '订阅之后，会员帖才会解锁。' }),
        ));
        for (const person of creators()) {
            const sub = data.patreon.subs[person.name];
            body.appendChild(h('button', {
                type: 'button', class: 'mp-webapp__result', onclick: () => open(person),
                style: { display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', width: '100%' },
            },
                avatar({ name: person.name, size: 42, link: false }),
                h('div', { style: { flex: '1 1 auto', minWidth: '0' } },
                    h('div', { class: 'mp-webapp__result-title', text: person.name + (sub ? ' · 已订阅' : '') }),
                    h('div', { class: 'mp-webapp__result-snippet', text: person.role + ' · 最低 ' + TIERS[person.tier].price + ' / 月' }),
                ),
                icon('chevron'),
            ));
        }
    }

    function open(person) {
        const tier = TIERS[person.tier];
        const sub = data.patreon.subs[person.name];
        const dialog = sheet({
            title: person.name,
            content: h('div', { class: 'mp-field-list' },
                h('div', { class: 'mp-st-hint', text: person.role + ' · ' + (sub ? '已订阅 ' + tier.name : '会员内容未解锁') }),
                h('div', { class: 'mp-me__bio', text: sub ? person.post : '🔒 ' + '订阅后可见：' + (person.post || '会员帖').slice(0, 40) + '…' }),
                h('div', { class: 'mp-st-hint', text: '档位：围观 ' + TIERS[0].price + ' / 会员 ' + TIERS[1].price + ' / 赞助人 ' + TIERS[2].price + '（每月）' }),
            ),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button',
                text: sub ? '已订阅' : '订阅 ' + tier.price + ' / 月',
                onclick: () => {
                    if (sub) { toast('已经在订阅了'); return; }
                    data.patreon.subs[person.name] = { tier: tier.name, price: tier.price, ts: Date.now() };
                    saveNow('data');
                    dialog.close();
                    render();
                    toast('订阅成功，会员内容解锁了');
                },
            }),
        });
        return dialog;
    }

    render();
    return { refresh: render };
}
