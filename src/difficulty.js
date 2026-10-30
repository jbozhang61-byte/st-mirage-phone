/**
 * 攻略难度：0-100，分数越高越难追。
 * 「心动」按真实好感 + 关系阶段算；「相遇」按候选人的气质 / 标签算，
 * AI 直接给了 difficulty 就优先用 AI 的。
 */

const HEART_STAGES = ['陌生', '认识', '互有好感', '暧昧', '恋人', '伴侣'];

const TIERS = [
    { min: 82, label: '地狱', key: 'hell' },
    { min: 66, label: '困难', key: 'hard' },
    { min: 48, label: '普通', key: 'mid' },
    { min: 30, label: '容易', key: 'easy' },
    { min: -1, label: '轻松', key: 'soft' },
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

/** 一个人的攻略难度：{ score, label, key }。 */
export function difficultyOf(person = {}) {
    const score = scoreMatch(person);
    const tier = tierOf(score);
    return { score, label: tier.label, key: tier.key };
}

/** 按难度从高到低排；同分保持原来的先后。 */
export function sortByDifficulty(list = []) {
    return [...list]
        .map((person, index) => ({ person, index, score: difficultyOf(person).score }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(entry => entry.person);
}
