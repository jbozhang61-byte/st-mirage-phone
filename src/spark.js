/**
 * 相遇：一个用来「招人」的交友 App。
 * 输入你想要的人，给出几个候选人；最多同时和两个人约会。
 */
export const MAX_DATES = 2;
export const STAGES = ['刚认识', '聊得来', '有点暧昧', '约会中', '确定关系'];

export const VIBES = [
    { id: 'warm', label: '温柔', text: '温柔、耐心，会记得你说过的小事' },
    { id: 'danger', label: '危险', text: '有点危险、不好掌控，但很吸引人' },
    { id: 'young', label: '年下', text: '比你小，直接、黏人、藏不住情绪' },
    { id: 'mature', label: '成熟', text: '成熟、克制，习惯把事情安排好' },
    { id: 'mystery', label: '神秘', text: '话不多，身上有没说出口的东西' },
];

export function sparkSystemPrompt({ world, people, user }) {
    return [
        '你在为一个交友 App 生成匹配候选人。',
        '世界：' + (world || '一个普通的城市'),
        people.length ? '这个世界里已经有的人：' + people.join('、') : '',
        '用户：' + user,
        '候选人是这个世界里真实存在的人，不是明星，也不要和已有的人重名。',
        '每个人都要具体：职业、年纪、说话方式、一个小缺点。',
        'difficulty 是攻略难度，0-100 的整数，越大越难追（看性格、边界、生活状态）。',
        '三个人要拉开差距：一个 80 以上，一个 55 左右，一个 35 以下。',
        '只输出 JSON：',
        '{"candidates":[{"name":"名字","age":"27","job":"职业","tags":["标签1","标签2"],"bio":"一两句介绍，带一点缺点","opening":"TA 会主动发来的第一句话","tone":"warm|danger|young|mature|mystery","difficulty":72}]}',
    ].filter(Boolean).join('\n');
}

export function sparkUserPrompt({ description, vibes }) {
    const chosen = VIBES.filter(vibe => vibes.includes(vibe.id)).map(vibe => vibe.text);
    return [
        description ? '用户想要的人：' + description : '用户没有具体描述，给几个气质不同的人。',
        chosen.length ? '偏好：' + chosen.join('；') : '',
        '给 3 个候选人，气质不要太像。',
    ].filter(Boolean).join('\n');
}

const POOL = [
    { name: '沈岸', age: '29', job: '旧书店夜班店员', tags: ['温和', '慢热'], bio: '白天睡觉，晚上看店。会把客人落下的书签收好，等人回来拿。', opening: '昨晚是不是你来过？有本书你翻到一半，我帮你留着了。', tone: 'warm' },
    { name: '林见鹿', age: '24', job: '独立乐队鼓手', tags: ['直接', '夜行动物'], bio: '说话不绕弯，排练完会一个人坐在台阶上吃便利店饭团。', opening: '你上次说想听现场，这周五，来不来？', tone: 'danger' },
    { name: '周予安', age: '22', job: '美院学生', tags: ['黏人', '画画'], bio: '画画到凌晨，饿了就给你发消息。情绪写在脸上，藏不住。', opening: '在干嘛。我画不下去了，想听你说话。', tone: 'young' },
    { name: '程屿', age: '34', job: '建筑事务所合伙人', tags: ['克制', '可靠'], bio: '习惯把日程排满，偶尔会在加班后问你要不要吃夜宵。', opening: '楼下那家还开着。要下来吗，我等你十分钟。', tone: 'mature' },
    { name: '江迟', age: '31', job: '电台主播', tags: ['神秘', '声音'], bio: '凌晨两点的节目，几乎不说自己的事。听众都以为他没有生活。', opening: '刚才那首歌，是给你的。你没听见吧。', tone: 'mystery' },
    { name: '许南', age: '26', job: '花店老板', tags: ['明亮', '细心'], bio: '记得每个常客喜欢什么花，自己却总买最便宜的那束。', opening: '今天进了很新鲜的雪柳，给你留了一把。', tone: 'warm' },
];

export function sparkFallback({ description, vibes, offset = 0 }) {
    const pool = [...POOL];
    if (vibes?.length) {
        pool.sort((a, b) => Number(vibes.includes(b.tone)) - Number(vibes.includes(a.tone)));
    }
    const picked = [];
    for (let i = 0; i < 3; i++) {
        const source = pool[(i + offset) % pool.length];
        picked.push({ ...source, bio: description ? source.bio + '（你说想要：' + String(description).slice(0, 20) + '）' : source.bio });
    }
    return { candidates: picked };
}

export function dateSystemPrompt({ world, person, stage, dates, user }) {
    return [
        '你在写一段约会。世界：' + (world || '一个普通的城市'),
        '人物：' + person.name + '，' + (person.role || '') + '。' + (person.desc || ''),
        '关系阶段：' + stage + '。已经见过 ' + dates + ' 次。',
        '用户：' + user,
        '写一个具体的小场景：在哪、做了什么、一个让关系往前挪一点的瞬间。不要写成总结。',
        '只输出 JSON：{"title":"这次约会的标题","scene":"三到五句的场景","moment":"一个可以带回聊天的瞬间"}',
    ].join('\n');
}

export function dateFallback({ person, stage }) {
    return {
        title: '和' + person.name + '的一次见面',
        scene: '约在傍晚。' + person.name + '比你先到，坐在靠窗的位置，面前放着两杯水，其中一杯推到你那边。你们聊了些不重要的事，直到路灯亮起来，他才说「再坐一会儿吧」。',
        moment: '离开的时候，' + person.name + '把围巾往上拉了拉，说下次换他来找你。',
    };
}
