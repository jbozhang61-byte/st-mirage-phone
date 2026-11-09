/** 拼多多 / 淘宝 / 京东 / 亚马逊：商品流、搜索、详情、购物车。 */
import { h, icon, sheet, toast } from '../render.js';
import { getData, saveNow } from '../store.js';
import { artFor } from '../art.js';
import { generateShoppingProducts } from '../storyseed.js';

const BRANDS = {
    pdd: {
        name: '拼多多', sub: 'PDD', currency: '¥', tagline: '百亿补贴 · 拼着买更便宜',
        categories: ['全部', '百亿补贴', '生活', '数码', '食品'],
        seeds: [
            ['加厚保暖法兰绒睡衣', 39.9, '生活', '冬天在旧城穿刚好', 120000],
            ['旧城同款搪瓷杯', 9.9, '生活', '杯口有一圈蓝边', 86000],
            ['雪夜暖手宝', 19.9, '数码', '充电一次暖一整晚', 54000],
            ['速食小馄饨 20 只', 12.8, '食品', '夜班回来煮一碗', 210000],
            ['毛线围巾', 25.9, '生活', '颜色像路灯下的雪', 33000],
            ['桌面小夜灯', 15.9, '数码', '暖黄光，不刺眼', 41000],
        ],
    },
    taobao: {
        name: '淘宝', sub: 'TAOBAO', currency: '¥', tagline: '万能的淘宝 · 你想要的我都有',
        categories: ['全部', '女装', '家居', '数码', '文具'],
        seeds: [
            ['复古格纹大衣', 268, '女装', '旧城冬天很适合', 4200],
            ['手冲咖啡套装', 159, '家居', '周末慢慢磨豆子', 1800],
            ['机械键盘 87 键', 329, '数码', '夜里打字很轻', 960],
            ['黄铜书签', 29.9, '文具', '刻一句很短的话', 5300],
            ['羊毛毡手套', 68, '女装', '指尖不冻', 2400],
            ['香薰蜡烛 · 雪松', 79, '家居', '像雪后的木头', 3100],
        ],
    },
    jd: {
        name: '京东', sub: 'JD', currency: '¥', tagline: '京东自营 · 次日达',
        categories: ['全部', '自营', '数码', '家电', '食品'],
        seeds: [
            ['降噪耳机', 899, '数码', '通勤和夜班都能用', 7200],
            ['电热水壶 1.5L', 129, '家电', '烧水很快', 15000],
            ['机械键盘', 429, '数码', '自营次日达', 3800],
            ['牛奶一箱', 69.9, '食品', '早餐来不及就喝一盒', 28000],
            ['加湿器', 199, '家电', '旧城的冬天太干', 6400],
            ['移动硬盘 2T', 559, '数码', '把照片都存下来', 2100],
        ],
    },
    amazon: {
        name: 'Amazon', sub: 'AMAZON', currency: '$', tagline: '全球购 · Prime 两日达',
        categories: ['全部', '海外购', '图书', '数码', '家居'],
        seeds: [
            ['The Night Market', 18.99, '图书', '一本关于旧城的英文小说', 2400],
            ['Travel Adapter', 24.99, '数码', '多国插头', 5100],
            ['Wool Throw Blanket', 39.99, '家居', '沙发上盖着刚好', 1800],
            ['Noise Cancelling Earbuds', 129.99, '数码', '长途飞行用', 9600],
            ['Snow Globe', 22.5, '家居', '里面是一座小城', 700],
            ['Notebook Set', 14.99, '图书', '三本一套', 3300],
        ],
    },
};

export function mountShop(brandId) {
    return (host, { nav }) => mount(host, nav, brandId);
}

function mount(host, nav, brandId) {
    const brand = BRANDS[brandId] || BRANDS.taobao;
    const hadCache = (getData().shopping?.[brandId]?.products || []).length > 0;
    nav.setChrome?.(brandId === 'amazon' ? 'dark' : 'light');
    let keyword = '';
    let category = '全部';
    let generating = false;

    const el = h('div', { class: 'mp-shop mp-shop--' + brandId });
    const body = h('div', { class: 'mp-shop__body' });
    const tabs = h('div', { class: 'mp-shop__tabs' });
    const navEl = h('div', { class: 'mp-shop__bar' },
        h('button', { type: 'button', class: 'mp-nav__btn', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
        h('div', { class: 'mp-shop__brand' }, brand.name, h('small', { text: brand.sub })),
        h('div', { class: 'mp-shop__tools' },
            h('button', { type: 'button', class: 'mp-shop__tool', 'aria-label': '刷新', onclick: () => refresh() }, icon('refresh')),
            h('button', { type: 'button', class: 'mp-shop__tool', 'aria-label': '购物车', onclick: () => cartSheet() }, icon('bag')),
        ),
    );
    const search = h('input', { class: 'mp-shop__search', type: 'text', placeholder: '搜商品、品牌' });
    search.addEventListener('input', () => { keyword = search.value.trim(); render(); });
    el.append(navEl, search, tabs, body);
    host.appendChild(el);

    function state() {
        const data = getData();
        data.shopping = data.shopping && typeof data.shopping === 'object' ? data.shopping : {};
        const shop = data.shopping[brandId] && typeof data.shopping[brandId] === 'object' ? data.shopping[brandId] : {};
        shop.products = Array.isArray(shop.products) ? shop.products : [];
        shop.cart = Array.isArray(shop.cart) ? shop.cart : [];
        shop.orders = Array.isArray(shop.orders) ? shop.orders : [];
        if (!shop.products.length) {
            shop.products = brand.seeds.map((item, index) => ({
                id: brandId + '-seed-' + index,
                title: item[0], price: item[1], category: item[2], desc: item[3], sold: item[4],
                image: artFor(brandId + item[0], brandId === 'amazon' ? 'night' : 'dusk'),
            }));
        }
        data.shopping[brandId] = shop;
        return shop;
    }

    function money(value) {
        return brand.currency + (Number(value) || 0).toFixed(2);
    }

    function paintTabs() {
        tabs.innerHTML = '';
        for (const name of brand.categories) {
            tabs.appendChild(h('button', {
                type: 'button', class: 'mp-shop__tab' + (category === name ? ' on' : ''), text: name,
                onclick: () => { category = name; paintTabs(); render(); },
            }));
        }
    }

    function filtered(shop) {
        let list = shop.products;
        if (category !== '全部') list = list.filter(item => item.category === category || (category === '自营' && item.jd));
        if (keyword) {
            const key = keyword.toLowerCase();
            list = list.filter(item => [item.title, item.desc, item.category].join(' ').toLowerCase().includes(key));
        }
        return list;
    }

    function render() {
        const shop = state();
        paintTabs();
        body.innerHTML = '';
        const list = filtered(shop);
        const grid = h('div', { class: 'mp-shop__grid' });
        for (const item of list) grid.appendChild(productCard(item));
        body.appendChild(grid);
        if (!list.length) body.appendChild(h('div', { class: 'mp-shop__empty', text: '没有找到相关商品。' }));
        if (!keyword && category === '全部') {
            body.appendChild(h('button', { type: 'button', class: 'mp-shop__more', onclick: () => refresh() }, generating ? '正在上新…' : '换一批商品'));
        }
    }

    function productCard(item) {
        return h('button', { type: 'button', class: 'mp-shop__card', onclick: () => openProduct(item) },
            h('div', { class: 'mp-shop__cover', style: { backgroundImage: item.image } },
                h('span', { class: 'mp-shop__tag', text: item.category }),
            ),
            h('div', { class: 'mp-shop__title', text: item.title }),
            h('div', { class: 'mp-shop__price', text: money(item.price) }),
            h('div', { class: 'mp-shop__sold', text: (item.sold || 0).toLocaleString('zh-CN') + ' 人已买' }),
        );
    }

    function openProduct(item) {
        const shop = state();
        const qty = h('input', { class: 'mp-input', type: 'number', min: '1', value: '1' });
        const qtyValue = () => Math.max(1, Math.floor(Number(qty.value) || 1));
        const add = () => {
            const count = qtyValue();
            const row = shop.cart.find(entry => entry.id === item.id);
            if (row) row.qty += count;
            else shop.cart.push({ id: item.id, title: item.title, price: item.price, qty: count });
            saveNow('data');
            toast('已加入购物车');
            s.close();
        };
        const buy = () => {
            const count = qtyValue();
            shop.orders.push({ id: 'o' + Date.now().toString(36), title: item.title, price: item.price, qty: count, ts: Date.now() });
            saveNow('data');
            s.close();
            toast('已下单：' + item.title);
        };
        const s = sheet({
            title: item.title,
            content: h('div', { class: 'mp-shop__detail' },
                h('div', { class: 'mp-shop__detail-cover', style: { backgroundImage: item.image } }),
                h('div', { class: 'mp-shop__detail-price', text: money(item.price) }),
                h('div', { class: 'mp-shop__detail-desc', text: item.desc }),
                h('div', { class: 'mp-shop__detail-meta', text: (item.sold || 0).toLocaleString('zh-CN') + ' 人已买 · ' + brand.tagline }),
                h('div', { class: 'mp-shop__qty' }, h('span', { text: '数量' }), qty),
                h('div', { class: 'mp-shop__detail-actions' },
                    h('button', { type: 'button', class: 'mp-shop__cartbtn', onclick: add }, '加入购物车'),
                    h('button', { type: 'button', class: 'mp-shop__buybtn', onclick: buy }, '立即购买'),
                ),
            ),
        });
    }

    function cartSheet() {
        const shop = state();
        const list = h('div', { class: 'mp-field-list' });
        const total = () => shop.cart.reduce((sum, row) => sum + row.price * row.qty, 0);
        const draw = () => {
            list.innerHTML = '';
            if (!shop.cart.length) {
                list.appendChild(h('div', { class: 'mp-shop__empty', text: '购物车还是空的。' }));
            }
            for (const row of shop.cart) {
                list.appendChild(h('div', { class: 'mp-shop__cartrow' },
                    h('div', {}, h('b', { text: row.title }), h('div', { class: 'mp-shop__sold', text: money(row.price) + ' × ' + row.qty })),
                    h('button', { type: 'button', class: 'mp-shop__remove', onclick: () => { shop.cart = shop.cart.filter(entry => entry.id !== row.id); saveNow('data'); draw(); } }, icon('trash')),
                ));
            }
            list.appendChild(h('div', { class: 'mp-shop__total' }, h('span', { text: '合计' }), h('b', { text: money(total()) })));
        };
        draw();
        const s = sheet({
            title: '购物车',
            content: list,
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '结算',
                onclick: () => {
                    if (!shop.cart.length) { toast('购物车是空的'); return; }
                    const amount = total();
                    shop.orders.push({ id: 'o' + Date.now().toString(36), items: [...shop.cart], total: amount, ts: Date.now() });
                    shop.cart = [];
                    saveNow('data');
                    s.close();
                    toast('已下单，共 ' + money(amount));
                    render();
                },
            }),
        });
    }

    async function refresh() {
        if (generating) return;
        generating = true;
        toast('正在上新…');
        try {
            const products = await generateShoppingProducts(brand.name);
            const shop = state();
            if (products.length) {
                shop.products = products.map((item, index) => ({
                    ...item,
                    id: brandId + '-' + Date.now().toString(36) + index,
                    image: artFor(brandId + item.title, brandId === 'amazon' ? 'night' : 'dusk'),
                }));
            } else {
                shop.products = shop.products.map(item => ({ ...item, sold: (item.sold || 0) + Math.floor(Math.random() * 800) }));
            }
            saveNow('data');
            render();
            toast('已更新商品');
        } catch (error) {
            toast('上新失败：' + (error?.message || error), 3000);
        } finally {
            generating = false;
        }
    }

    paintTabs();
    render();
    if (!hadCache) setTimeout(() => refresh(), 600);
    return { refresh: render };
}