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

    /** 这个人的帖子：一条公开、两条会员限定。 */
    function postsOf(person) {
        const seedText = String(person.post || '').trim() || '在这里更新日常和幕后。';
        const saved = data.patreon.posts?.[person.name];
        if (Array.isArray(saved) && saved.length) return saved;
        const list = [
            { id: 'free-1', title: '公开更新', text: seedText, locked: false, likes: 12 + (person.name.length * 3), at: '昨天' },
            { id: 'paid-1', title: '会员限定：这周没发出来的部分', text: seedText.slice(0, 40) + '……后面那段太长，也怕影响不好，就只放在这里了。', locked: true, likes: 36, at: '三天前' },
            { id: 'paid-2', title: '会员限定：一些随手记', text: '凌晨三点醒着，写了几行，也许以后会变成正式的东西。先把草稿贴在这里。', locked: true, likes: 21, at: '上周' },
        ];
        data.patreon.posts = data.patreon.posts || {};
        data.patreon.posts[person.name] = list;
        return list;
    }

    /** 打开某个创作者的主页：能看到他发过什么，订阅后才解锁会员帖。 */
    function open(person) {
        const tier = TIERS[person.tier];
        const sub = data.patreon.subs[person.name];
        const list = postsOf(person);
        const page = h('div', { class: 'mp-soc-page' });
        const close = () => page.remove();
        const body = h('div', { class: 'mp-soc-page__scroll' });
        const draw = () => {
            body.innerHTML = '';
            body.appendChild(h('div', { class: 'mp-pt__hero' },
                avatar({ name: person.name, size: 56, link: false }),
                h('div', {},
                    h('div', { class: 'mp-pt__name', text: person.name }),
                    h('div', { class: 'mp-pt__meta', text: person.role + ' · 最低 ' + tier.price + ' / 月 · 订阅 ' + (17 + person.name.length) + ' 人' })),
            ));
            for (const post of list) {
                const locked = post.locked && !sub;
                body.appendChild(h('div', { class: 'mp-pt__post' + (locked ? ' is-locked' : '') },
                    h('div', { class: 'mp-pt__post-top' },
                        h('span', { class: 'mp-pt__post-tag', text: locked ? '🔒 会员限定' : '公开' }),
                        h('span', { class: 'mp-pt__post-time', text: post.at })),
                    h('div', { class: 'mp-pt__post-title', text: post.title }),
                    h('div', { class: 'mp-pt__post-text', text: locked ? '订阅 ' + tier.name + '（' + tier.price + ' / 月）后可见' : post.text }),
                    h('div', { class: 'mp-pt__post-act', text: '♥ ' + post.likes }),
                ));
            }
            body.appendChild(h('button', {
                type: 'button', class: 'mp-btn primary small',
                style: { margin: '14px 14px 24px' },
                text: sub ? '已订阅 ' + sub.tier : '订阅 ' + tier.price + ' / 月',
                onclick: () => {
                    if (sub) { toast('已经在订阅了'); return; }
                    data.patreon.subs[person.name] = { tier: tier.name, price: tier.price, ts: Date.now() };
                    saveNow('data');
                    toast('订阅成功，会员内容解锁了');
                    draw();
                    render();
                },
            }));
        };
        draw();
        page.append(
            h('div', { class: 'mp-soc-page__bar' },
                h('button', { type: 'button', class: 'mp-soc-page__back', onclick: close }, icon('back')),
                h('div', { class: 'mp-soc-page__title', text: person.name })),
            body,
        );
        const screen = document.querySelector('.mp-screen') || host;
        screen.appendChild(page);
        return page;
    }

    render();
    return { refresh: render };
}
