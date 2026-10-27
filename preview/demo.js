/**
 * 预览用的演示数据：三段聊天、几条朋友圈、备忘录和相册。
 */
const min = 60 * 1000;
const hour = 60 * min;
const day = 24 * hour;

export function seed(data) {
    const now = Date.now();
    const photos = globalThis.__miragePreview?.photos || {};

    data.world = {
        extractedAt: now - day * 5,
        cast: [
            { id: 'p1', name: '夏之', role: '修表匠', relation: '很多年的旧朋友', desc: '二十六岁，在旧城开一间修表铺。话不多，习惯把关心藏在小事里。', style: '句子很短，很少用感叹号，偶尔会突然说一句很重的话。' },
            { id: 'p2', name: '沈知微', role: '书店老板', relation: '一起读书的朋友', desc: '独立书店「岛上」的老板，话多，爱发长语音，看到好句子会立刻拍下来。', style: '语速快，爱用括号补充，语音比文字多。' },
            { id: 'p3', name: '阿澈', role: '大学生 / 弟弟', relation: '你的弟弟', desc: '十九岁，以为全世界都不知道他在偷偷准备惊喜。', style: '嘴硬，爱逞强，喜欢发「🥺」和「。」，一句话拆成三条发。' },
            { id: 'p4', name: '顾寒', role: '建筑师', relation: '旧同事', desc: '理性、话少，只有喝多的时候会突然说很多。', style: '极简，不用表情，偶尔一句关心会显得很突兀。' },
        ],
    };

    data.meta.city = '旧城';
    data.meta.momentsSeen = 0;
    data.meta.createdAt = now - day * 6;

    data.threads = [
        {
            id: 't1',
            name: '夏之',
            kind: 'dm',
            members: ['夏之'],
            note: '认识很多年的旧朋友。他开修表铺，话少，习惯把关心放在小事里。',
            unread: 2,
            pinned: true,
            updated: now - 3 * min,
            msgs: [
                { id: 'm1', from: 'them', sender: '夏之', type: 'text', text: '今天修了一块很旧的表，表盖里面刻了字。', ts: now - 42 * min },
                { id: 'm2', from: 'me', type: 'text', text: '刻的什么', ts: now - 40 * min },
                { id: 'm3', from: 'them', sender: '夏之', type: 'text', text: '「给阿禾」。', ts: now - 39 * min },
                { id: 'm4', from: 'me', type: 'text', text: '……那不是我外婆的名字吗', ts: now - 37 * min },
                { id: 'm5', from: 'them', sender: '夏之', type: 'photo', text: '窗台上堆了薄薄一层雪', meta: { url: photos.snow }, ts: now - 20 * min },
                { id: 'm6', from: 'them', sender: '夏之', type: 'voice', text: '别多想，先过来。外面冷。', meta: { sec: 7 }, ts: now - 18 * min },
                { id: 'm7', from: 'me', type: 'redpacket', text: '给你买热茶', meta: { amount: 8.88 }, ts: now - 14 * min },
                { id: 'm8', from: 'them', sender: '夏之', type: 'voice', text: '谢谢。其实我煮了姜茶。', meta: { sec: 5 }, ts: now - 12 * min },
                { id: 'm9', from: 'me', type: 'transfer', text: '那就当我请自己喝', meta: { amount: 52 }, ts: now - 9 * min },
                { id: 'm10', from: 'them', sender: '夏之', type: 'location', text: '旧城 · 修表铺', ts: now - 6 * min },
                { id: 'm11', from: 'them', sender: '夏之', type: 'text', text: '灯给你留着。', ts: now - 3 * min },
            ],
        },
        {
            id: 't2',
            name: '沈知微',
            kind: 'dm',
            members: ['沈知微'],
            note: '书店老板，话多，爱发长语音。',
            unread: 1,
            updated: now - 26 * min,
            msgs: [
                { id: 'n1', from: 'them', sender: '沈知微', type: 'text', text: '书店今天停电，我点了三根蜡烛，像在做什么古老仪式。', ts: now - hour },
                { id: 'n2', from: 'them', sender: '沈知微', type: 'photo', text: '蜡烛、旧书和一整面墙的影子', meta: { url: photos.window }, ts: now - hour + 3 * min },
                { id: 'n3', from: 'me', type: 'text', text: '听起来比平时好看。', ts: now - 52 * min },
                { id: 'n4', from: 'them', sender: '沈知微', type: 'voice', text: '我就知道你会这么说。所以我把窗边那个位置留着了。', meta: { sec: 9 }, ts: now - 26 * min },
            ],
        },
        {
            id: 't3',
            name: '周末去哪',
            kind: 'group',
            members: ['沈知微', '夏之', '阿澈'],
            note: '三个人乱聊的群。',
            unread: 3,
            updated: now - 2 * hour,
            msgs: [
                { id: 'g1', from: 'them', sender: '沈知微', type: 'text', text: '周日下午书店有个小型朗读会，来不来。', ts: now - 3 * hour },
                { id: 'g2', from: 'them', sender: '阿澈', type: 'text', text: '我可以去蹭吃的吗', ts: now - 3 * hour + 2 * min },
                { id: 'g3', from: 'them', sender: '夏之', type: 'text', text: '你先把期末考完。', ts: now - 3 * hour + 4 * min },
                { id: 'g4', from: 'me', type: 'text', text: '算我一个。', ts: now - 2 * hour - 20 * min },
                { id: 'g5', from: 'them', sender: '沈知微', type: 'text', text: '好，窗边那个位置还是你的。', ts: now - 2 * hour },
                { id: 'g6', from: 'them', sender: '阿澈', type: 'sticker', text: '🥺', ts: now - 2 * hour + 1 * min },
            ],
        },
    ];

    data.moments = [
        {
            id: 'p1',
            author: '沈知微',
            text: '今天有人站在诗集那排前哭了十分钟。我没敢上去问，只把空调调高了两度。',
            ts: now - 3 * hour,
            likes: ['夏之', '阿澈'],
            comments: [
                { id: 'c1', by: '夏之', text: '你每次都这样。', ts: now - 2 * hour },
                { id: 'c2', by: '阿澈', text: '书店还招人吗，我缺钱', ts: now - 110 * min },
            ],
        },
        {
            id: 'p2',
            author: '夏之',
            text: '雪下得不大，但足够把门口那盏灯衬得很好看。',
            ts: now - 5 * hour,
            likes: ['林晚', '沈知微', '顾寒'],
            comments: [{ id: 'c3', by: '沈知微', text: '灯是你自己装的吧，别装不知道。', ts: now - 4 * hour }],
        },
        {
            id: 'p3',
            author: '阿澈',
            text: '期末周第三天：泡面吃完了，开始吃饼干。',
            ts: now - day,
            likes: ['沈知微'],
            comments: [{ id: 'c4', by: '沈知微', text: '来书店，有热可可。', ts: now - day + hour }],
        },
    ];

    data.notes = [
        { id: 'note1', text: '给夏之带一块旧表链。他说不用，但抽屉里那盒零件已经分好类了。', ts: now - 2 * hour, pinned: true },
        { id: 'note2', text: '沈知微说书店二楼有一箱旧诗集，下周去看看。\n记得带相机。', ts: now - day, pinned: false },
        { id: 'note3', text: '阿澈的生日快到了。\n他嘴上说不要礼物，但上次路过橱窗的时候站了很久。', ts: now - 2 * day, pinned: false },
    ];

    data.photos = [
        { id: 'ph1', url: photos.street, cap: '雪夜的街', ts: now - 2 * hour },
        { id: 'ph2', url: photos.window, cap: '书店的蜡烛', ts: now - day },
        { id: 'ph3', url: photos.snow, cap: '窗台上的雪', ts: now - 2 * day },
    ];
    return data;
}