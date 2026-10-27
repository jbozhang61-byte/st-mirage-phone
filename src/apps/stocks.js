/** 股市：内置公司 + 从正文同步新公司，能买卖。 */
import { h, icon, sheet, toast } from '../render.js';
import { getData, saveNow } from '../store.js';
import { seedCompanies, changeOf, makeCompany, priceWalk } from '../stocks.js';
import { extractCompanies } from '../ai.js';
import { currentCharacter } from '../st.js';

export function mountStocks(host, { nav }) {
    nav.setChrome?.('dark');
    let selected = null;
    const el = h('div', { class: 'mp-stk' });
    const body = h('div', { class: 'mp-stk__body' });
    const head = h('div', { class: 'mp-stk__head' },
        h('div', {},
            h('div', { class: 'mp-stk__title', text: '股市' }),
            h('div', { class: 'mp-stk__sub', text: '旧城交易所 · 模拟盘' }),
        ),
        h('div', { class: 'mp-stk__tools' },
            h('button', { type: 'button', class: 'mp-stk__tool', 'aria-label': '从正文同步', onclick: () => sync() }, icon('download')),
            h('button', { type: 'button', class: 'mp-stk__tool', 'aria-label': '刷新行情', onclick: () => tick(true) }, icon('refresh')),
        ),
    );
    el.append(head, body);
    host.appendChild(el);

    function ensure() {
        const data = getData();
        data.stocks = data.stocks || { companies: [], holdings: {}, cash: 100000, lastTick: 0 };
        if (!data.stocks.companies.length) data.stocks.companies = seedCompanies();
        return data.stocks;
    }

    function tick(manual = false) {
        const stock = ensure();
        const now = Date.now();
        if (!manual && now - stock.lastTick < 30000) return;
        const salt = Math.floor(now / 60000);
        for (const company of stock.companies) {
            company.prev = company.price;
            company.price = priceWalk(company, salt);
        }
        stock.lastTick = now;
        saveNow('data');
        if (manual) toast('行情已更新');
        render();
    }

    function render() {
        const stock = ensure();
        body.innerHTML = '';
        const holdings = stock.holdings || {};
        let marketValue = 0;
        for (const company of stock.companies) {
            const qty = Number(holdings[company.code]?.qty) || 0;
            marketValue += qty * company.price;
        }
        const total = stock.cash + marketValue;
        const profit = total - 100000;

        body.appendChild(h('div', { class: 'mp-stk__asset' },
            h('div', { class: 'mp-stk__asset-label', text: '总资产' }),
            h('div', { class: 'mp-stk__asset-value', text: '¥' + fmt(total) }),
            h('div', { class: 'mp-stk__asset-row' },
                h('span', { text: '现金 ¥' + fmt(stock.cash) }),
                h('span', { text: '持仓 ¥' + fmt(marketValue) }),
                h('span', { class: profit >= 0 ? 'up' : 'down', text: (profit >= 0 ? '+' : '') + fmt(profit) }),
            ),
        ));

        const sectors = [...new Set(stock.companies.map(item => item.sector))];
        for (const sector of sectors) {
            body.appendChild(h('div', { class: 'mp-stk__sector', text: sector }));
            for (const company of stock.companies.filter(item => item.sector === sector)) {
                const change = changeOf(company);
                body.appendChild(h('button', {
                    type: 'button', class: 'mp-stk__row', onclick: () => openDetail(company),
                },
                    h('div', { class: 'mp-stk__name' }, h('b', { text: company.name }), h('span', { class: 'mp-stk__code', text: company.code })),
                    h('div', { class: 'mp-stk__price' }, h('b', { text: company.price.toFixed(2) }), h('span', { class: change >= 0 ? 'up' : 'down', text: (change >= 0 ? '+' : '') + change.toFixed(2) + '%' })),
                ));
            }
        }

        body.appendChild(h('button', { type: 'button', class: 'mp-stk__add', onclick: () => addManual() }, icon('plus'), '手动添加一家公司'));
    }

    function openDetail(company) {
        selected = company;
        const stock = ensure();
        const holding = stock.holdings?.[company.code] || { qty: 0, cost: 0 };
        const change = changeOf(company);

        const qtyInput = h('input', { type: 'number', min: '1', step: '1', value: '10', class: 'mp-stk__qty' });
        const action = async (side) => {
            const qty = Math.max(1, Math.floor(Number(qtyInput.value) || 0));
            const cost = qty * company.price;
            if (side === 'buy') {
                if (stock.cash < cost) { toast('现金不够'); return; }
                stock.cash -= cost;
                const prev = stock.holdings[company.code] || { qty: 0, cost: 0 };
                const totalCost = prev.cost + cost;
                stock.holdings[company.code] = { qty: prev.qty + qty, cost: totalCost };
                toast('买入 ' + qty + ' 股 ' + company.name);
            } else {
                if (!holding.qty || holding.qty < qty) { toast('没有这么多股票'); return; }
                stock.cash += cost;
                stock.holdings[company.code] = { qty: holding.qty - qty, cost: Math.max(0, holding.cost * ((holding.qty - qty) / holding.qty)) };
                toast('卖出 ' + qty + ' 股');
            }
            saveNow('data');
            s.close();
            render();
        };
        const s = sheet({
            title: company.name + ' · ' + company.code,
            content: h('div', { class: 'mp-stk__detail' },
                h('div', { class: 'mp-stk__detail-price' }, h('b', { text: company.price.toFixed(2) }), h('span', { class: change >= 0 ? 'up' : 'down', text: (change >= 0 ? '+' : '') + change.toFixed(2) + '%' })),
                h('div', { class: 'mp-stk__chart' }, sparkline(company)),
                h('p', { class: 'mp-stk__desc', text: company.desc }),
                h('div', { class: 'mp-stk__hold', text: '持有 ' + (holding.qty || 0) + ' 股 · 成本 ' + (holding.qty ? (holding.cost / holding.qty).toFixed(2) : '—') }),
                h('div', { class: 'mp-stk__trade' }, qtyInput,
                    h('button', { type: 'button', class: 'mp-stk__sell', onclick: () => action('sell') }, '卖出'),
                    h('button', { type: 'button', class: 'mp-stk__buy', onclick: () => action('buy') }, '买入'),
                ),
            ),
        });

    }

    function sparkline(company) {
        const values = [];
        const base = Math.max(1, company.price);
        for (let i = 0; i < 7; i++) {
            const wave = Math.sin((i + (company.code.length || 1)) * 1.7) * 0.06;
            values.push(base * (1 + wave));
        }
        values[6] = company.price;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const width = 240, height = 80;
        const path = values.map((value, index) => {
            const x = (index / 6) * width;
            const y = height - ((value - min) / Math.max(0.01, max - min)) * (height - 12) - 6;
            return (index ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
        }).join(' ');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 240 80');
        svg.setAttribute('class', 'mp-stk__spark');
        svg.innerHTML = '<path d="' + path + '" fill="none" stroke="' + (changeOf(company) >= 0 ? '#ff6b6b' : '#4fc3a1') + '" stroke-width="2"/>';
        return svg;
    }

    async function sync() {
        toast('正在从正文里找公司…');
        try {
            const names = await extractCompanies();
            const stock = ensure();
            const world = currentCharacter()?.name || '';
            let added = 0;
            for (const name of names) {
                if (!name || stock.companies.some(item => item.name === name)) continue;
                const company = makeCompany(name, world);
                if (!company) continue;
                company.prev = company.price;
                stock.companies.push(company);
                added++;
            }
            if (added) { saveNow('data'); render(); toast('新增 ' + added + ' 家公司'); }
            else toast('正文里没有新公司');
        } catch (error) {
            toast('同步失败：' + (error?.message || error), 3000);
        }
    }

    function addManual() {
        const input = h('input', { type: 'text', placeholder: '公司名', class: 'mp-stk__qty' });
        const s = sheet({
            title: '添加公司',
            content: h('div', { class: 'mp-stk__detail' }, input),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '添加',
                onclick: () => {
                    const company = makeCompany(input.value, currentCharacter()?.name || '');
                    if (!company) { toast('名字不能为空'); return; }
                    const stock = ensure();
                    if (stock.companies.some(item => item.name === company.name)) { toast('已经有了'); return; }
                    company.prev = company.price;
                    stock.companies.push(company);
                    saveNow('data');
                    s.close();
                    render();
                },
            }),
        });
    }

    tick();
    render();
    return { refresh: render };
}

function fmt(value) {
    return Math.round(value).toLocaleString('zh-CN');
}