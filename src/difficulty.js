/**
 * 攻略难度 = 人群档位 + 在这个档里的位置。
 *
 * 每一档都是「一类人」，不是靠分数随缘落进去的：
 * 禁忌（神）→ 神话（王族）→ 传说（豪门）→ 地狱（强者）→ 困难（专业人士）
 * → 普通（身边日常）→ 容易（晚辈/新人）→ 轻松（已经在身边的人）
 *
 * 人群认不出来的人，一律按「普通」处理（路人、同事、同学那一类），
 * 保证谁都落在某一档里。
 */

const BANDS = {
    forbidden: [99, 99],
    myth: [96, 98],
    legend: [88, 95],
    hell: [82, 87],
    hard: [66, 81],
    mid: [48, 65],
    easy: [30, 47],
    soft: [6, 29],
};

const TIER_LABEL = {
    forbidden: '禁忌',
    myth: '神话',
    legend: '传说',
    hell: '地狱',
    hard: '困难',
    mid: '普通',
    easy: '容易',
    soft: '轻松',
};

/** 从上往下匹配，先命中的算数：越上面越「压人一头」。 */
const ARCHETYPES = [
    {
        key: 'forbidden',
        words: ['女神', '神明', '神女', '神族', '天使', '魔王', '恶魔', '先知', '神选', '魔女', '邪神', '旧神'],
        people: '神明 / 非人 / 神话生物',
    },
    {
        key: 'myth',
        words: ['皇女', '公主', '女王', '王女', '女帝', '女皇', '圣女', '殿下', '陛下', '王族', '皇族', '王室', '皇室', '下一任女王'],
        people: '王族 / 皇女 / 女王 / 圣女',
    },
    {
        key: 'legend',
        words: ['千金', '大小姐', '贵女', '世家', '财阀', '继承人', '家主', '族长', '掌门', '总裁', '影后', '影帝', '明星', '偶像', '贵族', '宰相', '名媛', '首富', '财团', '大亨'],
        people: '豪门千金 / 继承人 / 明星 / 权贵',
    },
    {
        key: 'hell',
        words: ['将军', '团长', '骑士团长', '杀手', '刺客', '特工', '间谍', '名医', '大律师', '校长', '教父', '法官', '检察官', '冰山', '高冷', '生人勿近', '顶流', '传说中', '军中', '上将', '元帅'],
        people: '强者 / 将军 / 杀手 / 顶流 / 生人勿近',
    },
    {
        key: 'hard',
        words: ['上司', '老板', '领导', '老师', '教授', '医生', '律师', '警察', '军官', '记者', '编辑', '导演', '经纪人', '画家', '歌手', '作家', '设计师', '建筑师', '主播', '声优', '秘书', '店长', '教练', '研究员', '工程师', '店老板', '馆长', '主治', '法医', '侦探'],
        people: '有职业门槛的人：上司 / 医生 / 律师 / 画家 / 店主 等',
    },
    {
        key: 'mid',
        words: ['同事', '同学', '邻居', '常客', '店主', '店员', '网管', '服务员', '咖啡师', '酒保', '房客', '房东', '路人', '网友', '打工', '上班族', '学生'],
        people: '日常里的人：同事 / 同学 / 邻居 / 常客',
    },
    {
        key: 'easy',
        words: ['学妹', '学弟', '实习生', '新人', '徒弟', '晚辈', '粉丝', '后辈', '小辈', '刚来'],
        people: '晚辈 / 学弟学妹 / 新人 / 粉丝',
    },
    {
        key: 'soft',
        words: ['青梅竹马', '发小', '旧朋友', '老朋友', '老友', '多年的朋友', '女友', '男友', '恋人', '未婚妻', '未婚夫', '妻子', '丈夫', '老婆', '老公', '伴侣', '室友', '同桌', '闺蜜', '死党', '红颜'],
        people: '已经在身边的人：青梅竹马 / 老友 / 恋人 / 室友',
    },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function textOf(person = {}) {
    return [
        person.name, person.role, person.relation, person.desc, person.summary,
        person.job, person.style, person.bio,
        ...(Array.isArray(person.tags) ? person.tags : []),
    ].filter(Boolean).join(' ');
}

/** 这个人属于哪一类人；认不出来就当「普通」。 */
export function archetypeOf(person = {}) {
    const text = textOf(person);
    if (text) {
        for (const arche of ARCHETYPES) {
            const hit = arche.words.find(word => text.includes(word));
            if (hit) return { key: arche.key, label: TIER_LABEL[arche.key], people: arche.people, hit };
        }
    }
    return { key: 'mid', label: TIER_LABEL.mid, people: ARCHETYPES.find(item => item.key === 'mid').people, hit: '' };
}

const STAGES = ['陌生', '认识', '互有好感', '暧昧', '恋人', '伴侣'];

/** 在所属档位里的位置：越靠上（越难）还是越靠下（越好攻略）。 */
function progressOf(person) {
    const affection = clamp(Number(person.affection) || 0, 0, 100);
    const found = STAGES.indexOf(person.stage);
    const stage = found < 0 ? 1 : found;
    let progress = (affection / 100) * 0.62 + (stage / (STAGES.length - 1)) * 0.38;
    progress += Math.min(0.12, (Array.isArray(person.boundaries) ? person.boundaries.length : 0) * 0.03);
    progress += Math.min(0.08, (Array.isArray(person.custom) ? person.custom.length : 0) * 0.02);
    progress -= Math.min(0.1, ((person.likes?.length || 0) + (person.sensitive?.length || 0)) * 0.01);
    const given = Number(person.difficulty);
    if (Number.isFinite(given) && given > 0) progress = 1 - clamp(given, 0, 100) / 100;
    return clamp(progress, 0, 1);
}

/** 一个人的攻略难度：{ score, label, key, people, hit }。 */
export function difficultyOf(person = {}) {
    const arche = archetypeOf(person);
    const [low, high] = BANDS[arche.key] || BANDS.mid;
    const progress = progressOf(person);
    const score = Math.round(high - progress * (high - low));
    return { score, label: TIER_LABEL[arche.key], key: arche.key, people: arche.people, hit: arche.hit };
}

/** 按难度从高到低排；同分保持原来的先后。 */
export function sortByDifficulty(list = []) {
    return [...list]
        .map((person, index) => ({ person, index, score: difficultyOf(person).score }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(entry => entry.person);
}

/** 我的攻略力够不够拿下这个人。 */
export function canTake(myPower, person) {
    const need = difficultyOf(person).score;
    const mine = Math.round(Number(myPower) || 0);
    return { need, mine, ok: mine >= need, gap: Math.max(0, need - mine) };
}
