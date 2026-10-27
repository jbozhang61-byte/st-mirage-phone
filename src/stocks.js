/** 股市：内置公司 + 从正文里发现的新公司。 */
export const SECTORS = ['科技', '能源', '医药', '传媒', '物流', '地产', '金融', '消费'];

const SEED = [
    { name: '远山科技', code: 'YSKJ', sector: '科技', price: 128.4, desc: '做城市感知网络的公司，最近在旧城铺了很多传感器。' },
    { name: '华胥研究院', code: 'HXYJ', sector: '科技', price: 206.8, desc: '研究声骸与共鸣技术的机构，不对外募资，但有一小部分流通股。' },
    { name: '今州能源', code: 'JZNY', sector: '能源', price: 43.2, desc: '今州城的电力与供暖，雪天一来股价就动。' },
    { name: '巡宁物流', code: 'XNWL', sector: '物流', price: 18.7, desc: '夜班司机比白天多，据说没有送不到的地方。' },
    { name: '白鹭传媒', code: 'BLCM', sector: '传媒', price: 9.6, desc: '做纪录片和深夜电台，最近在拍旧城的雪。' },
    { name: '星海制药', code: 'XHZY', sector: '医药', price: 77.5, desc: '研发出一种缓解共鸣副作用的药，还没上市。' },
    { name: '长夜矿业', code: 'KYKY', sector: '能源', price: 56.1, desc: '在北边挖一种会发光的矿，争议很大。' },
    { name: '南风地产', code: 'NFDC', sector: '地产', price: 12.3, desc: '旧城改造的主要开发商，负债不低。' },
    { name: '此间网络', code: 'CJWL', sector: '科技', price: 88.8, desc: '做本地生活服务，几乎每个旧城人手机里都有一个。' },
    { name: '云上航空', code: 'YSHK', sector: '物流', price: 31.4, desc: '飞北境和南方的支线航空，冬天经常延误。' },
    { name: '北岸生物', code: 'BASW', sector: '医药', price: 145.2, desc: '研究海生生物，和研究院有过合作。' },
    { name: '旧城银行', code: 'JCBK', sector: '金融', price: 6.8, desc: '最老的银行，利息低，但大家都把钱放这里。' },
];

function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); }
    return value >>> 0;
}

export function seedCompanies() {
    return SEED.map(item => ({ ...item, prev: item.price }));
}

export function priceWalk(company, salt = 1) {
    const rand = (hash(company.code + ':' + salt) % 1000) / 1000;
    const swing = (rand - 0.48) * 0.09;
    const next = Math.max(0.5, company.price * (1 + swing));
    return Math.round(next * 100) / 100;
}

export function makeCompany(name, world = '') {
    const clean = String(name || '').trim().slice(0, 20);
    if (!clean) return null;
    const code = clean.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'NEW';
    return {
        name: clean,
        code: code + (hash(clean) % 90 + 10),
        sector: SECTORS[hash(clean) % SECTORS.length],
        price: Math.round((8 + (hash(clean) % 290) + Math.random() * 10) * 100) / 100,
        prev: 0,
        desc: world ? '在' + world + '的正文里被提到。' : '从正文里收录的公司。',
    };
}

export function changeOf(company) {
    const base = company.prev || company.price;
    return base ? ((company.price - base) / base) * 100 : 0;
}
