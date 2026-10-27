/**
 * 钱包：红包和转账记录，余额按聊天里真实的钱算。
 */
import { h, icon, avatar, relativeText, toast } from '../render.js';
import { getData, findThread } from '../store.js';
import { characterAvatar } from '../st.js';

export function mountWallet(host, { nav }) {
    const body = h('div', { class: 'mp-body' });
    const el = h('div', { class: 'mp-conv' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '钱包', h('small', { text: 'WALLET' })),
            h('div', { class: 'mp-nav__spacer' }),
        ),
        body,
    );
    host.appendChild(el);

    function collect() {
        const data = getData();
        const rows = [];
        for (const thread of data.threads) {
            for (const msg of thread.msgs) {
                if (msg.type !== 'redpacket' && msg.type !== 'transfer') continue;
                const amount = Number(msg.meta?.amount || 0);
                if (!amount) continue;
                const incoming = msg.from === 'them';
                if (msg.type === 'redpacket' && incoming && !msg.meta?.opened) continue;
                rows.push({
                    id: msg.id,
                    dir: incoming ? 'in' : 'out',
                    type: msg.type,
                    amount,
                    title: (incoming ? (msg.sender || thread.members[0]) : '你') + (msg.type === 'redpacket' ? (incoming ? ' 发来红包' : ' 发出红包') : (incoming ? ' 转账给你' : ' 转账')),
                    note: msg.text || '',
                    ts: msg.ts,
                    thread,
                });
            }
        }
        rows.sort((a, b) => b.ts - a.ts);
        const income = rows.filter(r => r.dir === 'in').reduce((sum, r) => sum + r.amount, 0);
        const expense = rows.filter(r => r.dir === 'out').reduce((sum, r) => sum + r.amount, 0);
        return { rows, balance: income - expense, income, expense };
    }

    let filter = 'all';

    function render() {
        const { rows, balance, income, expense } = collect();
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'mp-wallet-card' },
            h('div', { class: 'mp-wallet-card__label', text: '余额（虚构）' }),
            h('div', { class: 'mp-wallet-card__amount', text: '¥ ' + balance.toFixed(2) }),
            h('div', { class: 'mp-wallet-card__row' },
                h('span', { text: '收入 ¥' + income.toFixed(2) }),
                h('span', { text: '支出 ¥' + expense.toFixed(2) }),
            ),
        ));

        if (!rows.length) {
            body.appendChild(h('div', { class: 'mp-empty', style: { paddingTop: '26px' } },
                h('div', { class: 'mp-empty__icon' }, icon('wallet')),
                h('div', { class: 'mp-empty__title', text: '还没有金钱往来' }),
                h('div', { class: 'mp-empty__text', text: '在聊天里发一个红包或转账，这里就会记下来。' }),
                h('button', { class: 'mp-btn primary', type: 'button', text: '去聊天', onclick: () => nav.go('chat') }),
            ));
            return;
        }

        const chips = h('div', { class: 'mp-chips mp-wallet-filter' });
        for (const [id, label] of [['all', '全部'], ['in', '收入'], ['out', '支出']]) {
            chips.appendChild(h('button', {
                class: 'mp-chip' + (filter === id ? ' on' : ''), type: 'button', text: label,
                onclick: () => { filter = id; render(); },
            }));
        }
        body.appendChild(chips);

        body.appendChild(h('div', { class: 'mp-letter', text: '明细' }));
        const list = h('div', { class: 'mp-bills' });
        for (const row of rows.filter(item => filter === 'all' || item.dir === filter)) {
            list.appendChild(h('div', {
                class: 'mp-bill',
                onclick: () => openBill(row),
            },
                avatar({ name: row.thread.members[0], src: characterAvatar(row.thread.members[0]), size: 36 }),
                h('div', { class: 'mp-bill__main' },
                    h('div', { class: 'mp-bill__title', text: row.title }),
                    h('div', { class: 'mp-bill__sub', text: (row.type === 'redpacket' ? '红包' : '转账') + (row.note ? ' · ' + row.note : '') }),
                ),
                h('div', { class: 'mp-bill__amount ' + row.dir, text: (row.dir === 'in' ? '+' : '-') + ' ¥' + row.amount.toFixed(2) }),
            ));
        }
        body.appendChild(list);
    }

    function openBill(row) {
        sheet({
            title: row.dir === 'in' ? '收到' : '支出',
            content: h('div', { class: 'mp-wallet-detail' },
                h('div', { class: 'mp-wallet-detail__amount', text: (row.dir === 'in' ? '+' : '-') + ' ¥' + row.amount.toFixed(2) }),
                h('div', { class: 'mp-wallet-detail__line', text: '对方：' + (row.thread.members[0] || '') }),
                h('div', { class: 'mp-wallet-detail__line', text: '类型：' + (row.type === 'redpacket' ? '红包' : '转账') }),
                row.note ? h('div', { class: 'mp-wallet-detail__line', text: '备注：' + row.note }) : null,
            ),
            actions: h('button', { class: 'mp-btn primary small', type: 'button', text: '去聊天', onclick: () => { s.close(); nav.openThread(row.thread.id); } }),
        });
    }

    render();
    return { refresh: render };
}