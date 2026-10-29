/** 股市：行情、持仓、自选、交易记录，内置公司 + 从正文同步。 */
import { h, icon, sheet, toast } from '../render.js';
import { getData, saveNow } from '../store.js';
import { seedCompanies, changeOf, makeCompany, priceWalk } from '../stocks.js';
import { extractCompanies } from '../ai.js';
import { currentCharacter } from '../st.js';
import { openSearchSheet } from './search-sheet.js';

export function mountStocks(host, { nav }) {
    nav.setChrome?.('dark');
    let tab = '行情';
    let selected = null;

    const el = h('div', { class: 'mp-stk' });
    const body = h('div', { class: 'mp-stk__body' });
    const tabsEl = h('div', { class: 'mp-stk__tabs' });
    const head = h('div', { class: 'mp-stk__head' },
        h('div', {},
            h('div', { class: 'mp-stk__title', text: '股市' }),
            h('div', { class: 'mp-stk__sub', text: '旧城交易所 · 模拟盘' }),
        ),
        h('div', { class: 'mp-stk__tools' },
            h('button', { type: 'button', class: 'mp-stk__tool', 'aria-label': '搜索', onclick: () => openSearch() }, icon('search')),
            h('button', { type: 'button', class: 'mp-stk__tool', 'aria-label': '从正文同步', onclick: () => sync() }, icon('download')),
            h('button', { type: 'button', class: 'mp-stk__tool', 'aria-label': '刷新行情', onclick: () => tick(true) }, icon('refresh')),
        ),
    );
    el.append(head, tabsEl, body);
    host.appendChild(el);

    function ensure() {
        const data = getData();
        data.stocks = data.stocks || { companies: [], holdings: {}, cash: 100000, lastTick: 0 };
        const stock = data.stocks;
        if (!stock.companies.length) stock.companies = seedCompanies();
        stock.holdings = stock.holdings || {};
        stock.watchlist = Array.isArray(stock.watchlist) ? stock.watchlist : [];
        stock.trades = Array.isArray(stock.trades) ? stock.trades : [];
        stock.assetHistory = Array.isArray(stock.assetHistory) ? stock.assetHistory : [];
        for (const company of stock.companies) {
            if (!Array.isArray(company.history) || !company.history.length) {
                company.history = [Math.round(company.price * (0.96 + Math.random() * 0.04) * 100) / 100, company.price];
            }
        }
        return stock;
    }

    function totalOf(stock) {
        let value = 0;
        for (const company of stock.companies) {
            const qty = Number(stock.holdings[company.code]?.qty) || 0;
            value += qty * company.price;
        }
        return { total: stock.cash + value, marketValue: value };
    }

    function tick(manual = false) {
        const stock = ensure();
        const now = Date.now();
        if (!manual && now - stock.lastTick < 30000) return;
        const salt = Math.floor(now / 60000);
        for (const company of stock.companies) {
            company.prev = company.price;
            company.price = priceWalk(company, salt);
            company.history = [...(company.history || []), company.price].slice(-40);
        }
        stock.lastTick = now;
        const { total } = totalOf(stock);
        stock.assetHistory = [...(stock.assetHistory || []), { ts: now, total }].slice(-80);
        saveNow('data');
        if (manual) toast('行情已更新');
        render();
    }

    function setTab(next) {
        tab = next;
        render();
    }

    function paintTabs() {
        tabsEl.innerHTML = '';
        for (const name of ['行情', '持仓', '自选']) {
            tabsEl.appendChild(h('button', {
                type: 'button', class: 'mp-stk__tab' + (tab === name ? ' on' : ''), text: name,
                onclick: () => setTab(name),
            }));
        }
    }

    function render() {
        const stock = ensure();
        paintTabs();
        body.innerHTML = '';
        const { total, marketValue } = totalOf(stock);
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

        if (tab === '持仓') {
            paintHoldings(stock);
        } else if (tab === '自选') {
            paintWatch(stock);
        } else {
            paintMarket(stock);
        }
        body.appendChild(h('button', { type: 'button', class: 'mp-stk__add', onclick: () => addManual() }, icon('plus'), '手动添加一家公司'));
    }

    function paintMarket(stock) {
        const sorted = [...stock.companies].sort((a, b) => changeOf(b) - changeOf(a));
        body.appendChild(movers('涨幅榜', sorted.slice(0, 3), 'up'));
        body.appendChild(movers('跌幅榜', sorted.slice(-3).reverse(), 'down'));

        const sectors = [...new Set(stock.companies.map(item => item.sector))];
        for (const sector of sectors) {
            body.appendChild(h('div', { class: 'mp-stk__sector', text: sector }));
            for (const company of stock.companies.filter(item => item.sector === sector)) {
                body.appendChild(companyRow(stock, company));
            }
        }
    }

    function movers(title, list, cls) {
        const row = h('div', { class: 'mp-stk__movers' },
            h('div', { class: 'mp-stk__movers-title', text: title }),
            h('div', { class: 'mp-stk__moverlist' }),
        );
        const listEl = row.lastChild;
        for (const company of list) {
            const change = changeOf(company);
            listEl.appendChild(h('button', { type: 'button', class: 'mp-stk__mover', onclick: () => openDetail(company) },
                h('b', { text: company.name }),
                h('span', { class: cls, text: (change >= 0 ? '+' : '') + change.toFixed(2) + '%' }),
            ));
        }
        return row;
    }

    function companyRow(stock, company) {
        const change = changeOf(company);
        const watching = stock.watchlist.includes(company.code);
        const star = h('span', {
            class: 'mp-stk__star' + (watching ? ' on' : ''),
            onclick: event => {
                event.stopPropagation();
                if (watching) stock.watchlist = stock.watchlist.filter(code => code !== company.code);
                else stock.watchlist.push(company.code);
                saveNow('data');
                render();
            },
        }, icon('star'));
        return h('button', { type: 'button', class: 'mp-stk__row', onclick: () => openDetail(company) },
            h('div', { class: 'mp-stk__name' }, h('b', { text: company.name }), h('span', { class: 'mp-stk__code', text: company.code })),
            h('div', { class: 'mp-stk__price' },
                star,
                h('b', { text: company.price.toFixed(2) }),
                h('span', { class: change >= 0 ? 'up' : 'down', text: (change >= 0 ? '+' : '') + change.toFixed(2) + '%' }),
            ),
        );
    }

    function paintHoldings(stock) {
        const rows = stock.companies.filter(company => Number(stock.holdings[company.code]?.qty) > 0);
        if (!rows.length) {
            body.appendChild(h('div', { class: 'mp-stk__empty', text: '还没有持仓。去行情里买一点。' }));
        }
        for (const company of rows) {
            const holding = stock.holdings[company.code];
            const avg = holding.qty ? holding.cost / holding.qty : 0;
            const value = holding.qty * company.price;
            const pnl = value - holding.cost;
            body.appendChild(h('button', { type: 'button', class: 'mp-stk__holding', onclick: () => openDetail(company) },
                h('div', { class: 'mp-stk__name' }, h('b', { text: company.name }), h('span', { class: 'mp-stk__code', text: holding.qty + ' 股 · 成本 ' + avg.toFixed(2) })),
                h('div', { class: 'mp-stk__price' },
                    h('b', { text: '¥' + fmt(value) }),
                    h('span', { class: pnl >= 0 ? 'up' : 'down', text: (pnl >= 0 ? '+' : '') + fmt(pnl) }),
                ),
            ));
        }
        body.appendChild(h('div', { class: 'mp-stk__sector', text: '最近交易' }));
        if (!stock.trades.length) body.appendChild(h('div', { class: 'mp-stk__empty', text: '还没有交易记录。' }));
        for (const trade of [...stock.trades].reverse().slice(0, 12)) {
            body.appendChild(h('div', { class: 'mp-stk__trade-row' },
                h('span', { text: trade.side === 'buy' ? '买入' : '卖出' }),
                h('b', { text: trade.name }),
                h('span', { text: trade.qty + ' 股 · ¥' + trade.price.toFixed(2) }),
            ));
        }
    }

    function paintWatch(stock) {
        const list = stock.companies.filter(company => stock.watchlist.includes(company.code));
        if (!list.length) {
            body.appendChild(h('div', { class: 'mp-stk__empty', text: '还没有自选股。点公司右侧的 ☆ 添加。' }));
            return;
        }
        for (const company of list) body.appendChild(companyRow(stock, company));
    }

    function openSearch() {
        const stock = ensure();
        openSearchSheet({
            title: '搜索股票',
            placeholder: '搜公司名或代码',
            items: stock.companies,
            textOf: company => company.name + ' ' + company.code + ' ' + company.sector,
            onPick: company => openDetail(company),
        });
    }

    function openDetail(company) {
        selected = company;
        const stock = ensure();
        const holding = stock.holdings?.[company.code] || { qty: 0, cost: 0 };
        const change = changeOf(company);
        const history = company.history || [company.price];
        const high = Math.max(...history, company.price);
        const low = Math.min(...history, company.price);
        const qtyInput = h('input', { type: 'number', min: '1', step: '1', value: '10', class: 'mp-stk__qty' });
        const estimate = h('div', { class: 'mp-stk__estimate', text: '约 ¥' + fmt(company.price * 10) });
        const updateEstimate = () => { estimate.textContent = '约 ¥' + fmt(company.price * Math.max(1, Math.floor(Number(qtyInput.value) || 0))); };
        qtyInput.addEventListener('input', updateEstimate);
        const quick = (qty) => h('button', { type: 'button', class: 'mp-stk__quick', text: qty === 0 ? '全仓' : String(qty), onclick: () => {
            qtyInput.value = qty === 0 ? String(Math.floor(stock.cash / company.price)) : String(qty);
            updateEstimate();
        } });

        const action = side => {
            const qty = Math.max(1, Math.floor(Number(qtyInput.value) || 0));
            const cost = qty * company.price;
            if (side === 'buy') {
                if (stock.cash < cost) { toast('现金不够'); return; }
                stock.cash -= cost;
                const prev = stock.holdings[company.code] || { qty: 0, cost: 0 };
                stock.holdings[company.code] = { qty: prev.qty + qty, cost: prev.cost + cost };
            } else {
                if (!holding.qty || holding.qty < qty) { toast('没有这么多股票'); return; }
                stock.cash += cost;
                stock.holdings[company.code] = { qty: holding.qty - qty, cost: Math.max(0, holding.cost * ((holding.qty - qty) / holding.qty)) };
            }
            stock.trades = [...(stock.trades || []), { ts: Date.now(), side, code: company.code, name: company.name, qty, price: company.price }].slice(-60);
            saveNow('data');
            s.close();
            toast(side === 'buy' ? '买入 ' + qty + ' 股' : '卖出 ' + qty + ' 股');
            render();
        };

        const s = sheet({
            title: company.name + ' · ' + company.code,
            content: h('div', { class: 'mp-stk__detail' },
                h('div', { class: 'mp-stk__detail-price' },
                    h('b', { text: company.price.toFixed(2) }),
                    h('span', { class: change >= 0 ? 'up' : 'down', text: (change >= 0 ? '+' : '') + change.toFixed(2) + '%' }),
                ),
                h('div', { class: 'mp-stk__stats' },
                    h('span', { text: '最高 ' + high.toFixed(2) }),
                    h('span', { text: '最低 ' + low.toFixed(2) }),
                    h('span', { text: '昨收 ' + (company.prev || company.price).toFixed(2) }),
                ),
                h('div', { class: 'mp-stk__chart' }, sparkline(company)),
                h('p', { class: 'mp-stk__desc', text: company.desc }),
                h('div', { class: 'mp-stk__hold' }, holding.qty
                    ? '持有 ' + holding.qty + ' 股 · 成本 ' + (holding.cost / holding.qty).toFixed(2) + ' · 盈亏 ' + ((company.price - holding.cost / holding.qty) * holding.qty >= 0 ? '+' : '') + fmt((company.price - holding.cost / holding.qty) * holding.qty)
                    : '还没有持仓'),
                h('div', { class: 'mp-stk__qtyrow' }, qtyInput, quick(10), quick(100), quick(0)),
                estimate,
                h('div', { class: 'mp-stk__trade' },
                    h('button', { type: 'button', class: 'mp-stk__sell', onclick: () => action('sell') }, '卖出'),
                    h('button', { type: 'button', class: 'mp-stk__buy', onclick: () => action('buy') }, '买入'),
                ),
            ),
        });
    }

    function sparkline(company) {
        const values = (company.history && company.history.length > 1 ? company.history : [company.price * 0.98, company.price]).slice(-24);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const width = 240, height = 80;
        const path = values.map((value, index) => {
            const x = (index / Math.max(1, values.length - 1)) * width;
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
                company.history = [company.price];
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
                    company.history = [company.price];
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