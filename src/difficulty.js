/**
 * 攻略难度：0-100，分数越高越难追。
 * 「心动」按真实好感 + 关系阶段算；「相遇」按候选人的气质 / 标签算，
 * AI 直接给了 difficulty 就优先用 AI 的。
 */

const HEART_STAGES = ['陌生', '认识', '互有好感', '暧昧', '恋人', '伴侣'];

const TIERS = [
    { min: 99, label: '禁忌', key: 'forbidden' },
    { min: 95, label: '神话', key: 'myth' },
    { min: 88, label: '传说', key: 'legend' },
    { min: 82, label: '地狱', key: 'hell' },
    { min: 66, label: '困难', key: 'hard' },
    { min: 48, label: '普通', key: 'mid' },
    { min: 30, label: '容易', key: 'easy' },
    { min: -1, label: '轻松', key: 'soft' },
];

/**
 * 地狱之上只留给「特殊人物」：身份本身就压人一头，光靠好感堆不到。
 * 命中身份就保底 88 / 96 分，没命中的普通人最高只到 87（地狱）。
 */
const SPECIAL = [
    { key: 'forbidden', floor: 99, words: ['女神', '神明', '神女', '神族', '天使', '魔王', '恶魔', '先知', '神选', '魔女'] },
    { key: 'myth', floor: 96, words: ['皇女', '公主', '女王', '王女', '女帝', '女皇', '圣女', '殿下', '陛下'] },
    { key: 'legend', floor: 88, words: ['千金', '大小姐', '贵女', '世家', '财阀', '继承人', '家主', '族长', '总裁', '影后', '明星', '偶像', '贵族', '宰相', '祭司长'] },
];

const TONE_BASE = { danger: 76, mystery: 84, mature: 62, young: 42, warm: 36 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function tierOf(score) {
    const value = clamp(Math.round(Number(score) || 0), 0, 100);
    return TIERS.find(tier => value >= tier.min) || TIERS[TIERS.length - 1];
}

/** 心动：好感越高、关系越近，越好攻略；边界和自定义标签会加难度。 */
function scoreHeart(person) {
    const affection = clamp(Number(person.affection) || 0, 0, 100);
    const found = HEART_STAGES.indexOf(person.stage);
    const stage = found < 0 ? 1 : found;
    const progress = (affection / 100) * 0.62 + (stage / (HEART_STAGES.length - 1)) * 0.38;
    let score = 96 - progress * 74;
    score += Math.min(12, (Array.isArray(person.boundaries) ? person.boundaries.length : 0) * 5);
    score += Math.min(9, (Array.isArray(person.custom) ? person.custom.length : 0) * 3);
    score -= Math.min(12, ((person.likes?.length || 0) + (person.sensitive?.length || 0)) * 1.2);
    return clamp(Math.round(score), 6, 99);
}

/** 相遇：优先用 AI 给的数，其次按气质和标签估。 */
function scoreMatch(person) {
    const given = Number(person.difficulty);
    if (Number.isFinite(given) && given > 0) return clamp(Math.round(given), 6, 99);
    if (Number.isFinite(Number(person.affection))) return scoreHeart(person);
    let score = TONE_BASE[person.tone] ?? 52;
    score += Math.min(12, (Array.isArray(person.tags) ? person.tags.length : 0) * 4);
    if (String(person.bio || '').length > 60) score += 3;
    return clamp(Math.round(score), 6, 99);
}

/** 在名字 / 身份 / 简介里找特殊身份，返回命中的那一档。 */
export function specialOf(person = {}) {
    const text = [
        person.name, person.role, person.relation, person.desc, person.summary,
        person.job, person.style, person.bio,
        ...(Array.isArray(person.tags) ? person.tags : []),
    ].filter(Boolean).join(' ');
    if (!text) return null;
    for (const tier of SPECIAL) {
        const hit = tier.words.find(word => text.includes(word));
        if (hit) return { key: tier.key, floor: tier.floor, hit };
    }
    return null;
}

/** 一个人的攻略难度：{ score, label, key, special }。 */
export function difficultyOf(person = {}) {
    let score = scoreMatch(person);
    const special = specialOf(person);
    if (special) score = Math.max(score, special.floor);
    else score = Math.min(score, 87);   // 普通人封顶在地狱
    const tier = tierOf(score);
    return { score, label: tier.label, key: tier.key, special: special ? special.hit : '' };
}

/** 按难度从高到低排；同分保持原来的先后。 */
export function sortByDifficulty(list = []) {
    return [...list]
        .map((person, index) => ({ person, index, score: difficultyOf(person).score }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(entry => entry.person);
}
