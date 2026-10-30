/**
 * 攻略力：把一个人拆成 颜值 / 谈吐 / 金钱 / 家境 四项，加权成 0-100。
 * 别人是算出来的（同一份资料永远算出同一组数）；
 * 自己的可以存一份覆盖值——「心」里的那个「作弊」按钮就是干这个的。
 */

export const POWER_DIMS = [
    { key: 'looks', label: '颜值', weight: 0.32 },
    { key: 'speech', label: '谈吐', weight: 0.26 },
    { key: 'money', label: '金钱', weight: 0.22 },
    { key: 'family', label: '家境', weight: 0.2 },
];

const GRADES = [
    [88, '顶配'],
    [74, '上等'],
    [60, '中上'],
    [46, '普通'],
    [32, '朴素'],
    [-1, '一般'],
];

const RICH = /财阀|千金|大小姐|总裁|贵族|世家|皇族|皇室|公主|皇女|女王|家主|继承人|豪门|影后|明星/;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function hashOf(text) {
    let hash = 0;
    const str = String(text || '_');
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(hash);
}

function seedOf(person = {}) {
    const text = [person.name, person.role, person.relation, person.desc, person.summary, person.style, person.bio]
        .filter(Boolean).join('|') || '_';
    const hash = hashOf(text);
    const base = 42 + (hash % 34);
    const out = {};
    POWER_DIMS.forEach((dim, index) => {
        out[dim.key] = clamp(base + ((hash >> (index * 3 + 1)) % 25) - 12, 9, 96);
    });
    if (RICH.test(text)) {
        out.money = clamp(out.money + 24, 9, 99);
        out.family = clamp(out.family + 28, 9, 99);
        out.speech = clamp(out.speech + 9, 9, 99);
    }
    return out;
}

/** 四项数值；person.power 有值就覆盖（自己开挂用的）。 */
export function statsOf(person = {}) {
    const seed = seedOf(person);
    const override = person && typeof person.power === 'object' && person.power ? person.power : null;
    const dims = {};
    for (const dim of POWER_DIMS) {
        const raw = Number(override?.[dim.key]);
        dims[dim.key] = Math.round(clamp(Number.isFinite(raw) ? raw : seed[dim.key], 1, 100));
    }
    return dims;
}

export function powerOf(person = {}) {
    const dims = statsOf(person);
    const score = Math.round(POWER_DIMS.reduce((sum, dim) => sum + dims[dim.key] * dim.weight, 0));
    const grade = (GRADES.find(([min]) => score >= min) || GRADES[GRADES.length - 1])[1];
    return {
        score,
        grade,
        cheated: !!(person && person.power),
        rows: POWER_DIMS.map(dim => ({ key: dim.key, label: dim.label, value: dims[dim.key] })),
    };
}
