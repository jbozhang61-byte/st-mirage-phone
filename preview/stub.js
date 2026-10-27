/**
 * 预览用的酒馆替身：提供 getContext、模拟生成、头像与聊天记录。
 * 只用于本地看 UI，不会被打包进扩展。
 */

const USER = '林晚';

function svgAvatar(text, from, to) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="' + from + '"/><stop offset="1" stop-color="' + to + '"/>' +
        '</linearGradient></defs>' +
        '<rect width="200" height="200" fill="url(#g)"/>' +
        '<circle cx="150" cy="42" r="46" fill="rgba(255,255,255,.18)"/>' +
        '<text x="100" y="132" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="92" font-weight="600" fill="#fff" text-anchor="middle">' + text + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function svgPhoto(a, b, c) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450">' +
        '<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + c + '"/></linearGradient>' +
        '<filter id="b"><feGaussianBlur stdDeviation="26"/></filter></defs>' +
        '<rect width="600" height="450" fill="url(#s)"/>' +
        '<circle cx="470" cy="120" r="90" fill="' + b + '" opacity=".75" filter="url(#b)"/>' +
        '<circle cx="150" cy="360" r="130" fill="' + a + '" opacity=".5" filter="url(#b)"/>' +
        '<rect y="300" width="600" height="150" fill="rgba(0,0,0,.18)"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const CHARACTERS = [
    {
        name: '夏之', avatar: svgAvatar('夏', '#f0a35e', '#c25f4a'),
        description: '二十六岁，在旧城开一间修表铺。话不多，习惯把关心藏在小事里：记得你怕冷，会提前把茶泡好。',
        personality: '安静、克制、心软，嘴上不肯承认。',
        scenario: '旧城改造前的最后一个冬天。',
    },
    {
        name: '沈知微', avatar: svgAvatar('沈', '#8a86f0', '#4c6fc4'),
        description: '独立书店「岛上」的老板。话多，爱发长语音，看到好句子会立刻拍下来发给朋友。',
        personality: '热烈、跳脱、共情力强。',
        scenario: '书店二楼的窗边总留着一个位置。',
    },
    {
        name: '阿澈', avatar: svgAvatar('澈', '#5fc7a5', '#2b8f7c'),
        description: '十九岁的大学生，你的弟弟。以为全世界都不知道他在偷偷准备一个惊喜。',
        personality: '嘴硬、爱逞强、有点中二。',
        scenario: '期末周，学校宿舍。',
    },
    {
        name: '顾寒', avatar: svgAvatar('顾', '#9aa3b8', '#4e5669'),
        description: '建筑事务所的合伙人，你的旧同事。理性、话少，只有喝多的时候会突然说很多。',
        personality: '冷淡、靠谱、偶尔温柔。',
        scenario: '一个连续加班的冬夜。',
    },
];

const PHOTOS = {
    snow: svgPhoto('#7ba7c9', '#e8f4ff', '#2b3b55'),
    window: svgPhoto('#f0a35e', '#ffd9ae', '#5a2f1f'),
    street: svgPhoto('#5b7cfa', '#b9c8ff', '#171a2b'),
};

const CHAT = [
    { name: '夏之', is_user: false, mes: '外面下雪了。你要是还没回，就先去我店里坐一会儿。' },
    { name: USER, is_user: true, mes: '在路上了，雪有点大。' },
    { name: '夏之', is_user: false, mes: '门口给你留了灯。慢点走，别摔。' },
];

const listeners = new Map();
const eventSource = {
    on(event, handler) { const list = listeners.get(event) || []; list.push(handler); listeners.set(event, list); },
    removeListener(event, handler) { const list = listeners.get(event) || []; listeners.set(event, list.filter(fn => fn !== handler)); },
    once(event, handler) { this.on(event, handler); },
    emit(event, ...args) { for (const fn of listeners.get(event) || []) fn(...args); },
};

let callCount = 0;
const REPLIES = {
    夏之: [
        '[图片] 窗台上堆了薄薄一层雪',
        '到了就好。',
        '茶还热着。',
    ],
    沈知微: [
        '我跟你说，今天书店来了个客人，站在诗集那排前哭了十分钟。',
        '我假装在整理书，其实一直偷偷看。',
        '[语音] 后来她买了一本里尔克，走的时候跟我说谢谢。我差点也哭了。',
    ],
    阿澈: [
        '姐',
        '我这个月生活费还有剩吗',
        '没有的话也没关系，我吃泡面就行',
        '[表情] 🥺',
    ],
    顾寒: [
        '还没睡？',
        '楼下便利店的灯还亮着。要不要下来。',
    ],
};

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function pickReply(system, prompt) {
    const name = CHARACTERS.find(c => system.includes('扮演「' + c.name + '」'))?.name
        || CHARACTERS.find(c => system.includes(c.name))?.name
        || '夏之';
    const list = REPLIES[name] || REPLIES['夏之'];
    callCount += 1;
    if (callCount % 4 === 0) return ['……', '你先说。'].join('\n');
    return list.join('\n');
}

export function installStub() {
    const context = {
        name1: USER,
        name2: '夏之',
        characters: CHARACTERS,
        chat: CHAT,
        chatId: 'preview-chat',
        characterId: 0,
        chatMetadata: {},
        extensionSettings: {},
        powerUserSettings: { persona_description: '旧城的插画师，习惯在深夜出门。' },
        eventTypes: {},
        eventSource,
        isMobile: false,
        getCurrentChatId: () => 'preview-chat',
        getRequestHeaders: () => ({}),
        getThumbnailUrl: (type, file) => (String(file || '').startsWith('data:') ? file : ''),
        saveMetadataDebounced: () => {},
        saveMetadata: () => {},
        saveSettingsDebounced: () => {},
        setExtensionPrompt: () => {},
        generateQuietPrompt: async () => '',
        generateRaw: async ({ system = '', systemPrompt = '', prompt = '', responseLength }) => {
            await sleep(520);
            system = system || systemPrompt || '';
            if (system.includes('整理助手') || system.includes('找出「')) {
                return JSON.stringify({ people: [
                    { name: '夏之', role: '修表匠', relation: '很多年的旧朋友', desc: '在旧城开一间修表铺，话不多。', style: '句子很短。' },
                    { name: '沈知微', role: '书店老板', relation: '一起读书的朋友', desc: '话多，爱发语音。', style: '语速快。' },
                    { name: '阿澈', role: '大学生', relation: '你的弟弟', desc: '嘴硬，爱逞强。', style: '一句话拆三条。' },
                    { name: '顾寒', role: '建筑师', relation: '旧同事', desc: '理性、话少。', style: '极简。' },
                ] });
            }
            if (system.includes('TikTok')) {
                return JSON.stringify({ videos: [
                    { author: '夏之', title: '下雪那天，门口的灯亮了一夜', desc: '本来只是忘了关，后来觉得这样也挺好。', tags: ['城市夜景', '下雪了'], likes: 12000, comments: 231, shares: 42, music: '慢速钢琴', mood: 'cold' },
                    { author: '阿澈', title: '期末周第三天，泡面吃完了', desc: '开始吃饼干。人在宿舍，心在书店。', tags: ['大学生', '日常'], likes: 3200, comments: 88, shares: 12, music: '原声', mood: 'warm' },
                    { author: '城市的陌生人', title: '地铁上假装看手机的人', desc: '其实只是在躲开别人的目光。', tags: ['共鸣'], likes: 23000, comments: 1200, shares: 300, music: '环境音', mood: 'street' },
                ] });
            }
            if (system.includes('微博')) {
                return JSON.stringify({
                    hot: [
                        { title: '旧城今年第一场雪', heat: '128万', tag: '热' },
                        { title: '修表铺门口的灯又亮了', heat: '76万', tag: '新' },
                        { title: '深夜书店还开着吗', heat: '42万', tag: '' },
                    ],
                    posts: [
                        { author: '沈知微', time: '12分钟前', text: '雪停了。门口那盏灯忘了关，就这样亮了一整夜。', topic: '#旧城的冬天#', likes: 3200, comments: 210, reposts: 88 },
                        { author: '夏之', time: '1小时前', text: '今天的客人不多，把柜子里的旧表都擦了一遍。', topic: '#修表铺日常#', likes: 1800, comments: 62, reposts: 20 },
                    ],
                });
            }
            if (system.includes('小红书')) {
                return JSON.stringify({ notes: [
                    { author: '沈知微', title: '在旧城住到第三年，才发现的四家小店', text: '修表铺其实也卖旧表带。书店二楼有一箱没拆封的诗集。', likes: 4300, collects: 2100, mood: 'warm' },
                    { author: '阿澈', title: '下雪天最适合待着的房间', text: '一盏黄灯、一条毯子、一杯热牛奶。', likes: 8900, collects: 5200, mood: 'cold' },
                    { author: '路过的人', title: '深夜书单｜适合睡不着的时候', text: '不要太厚，不要有太多情节。', likes: 2300, collects: 1800, mood: 'night' },
                ] });
            }
            if (system.includes('哔哩哔哩')) {
                return JSON.stringify({ videos: [
                    { author: '夏之', title: '【4K】旧城的雪，和一间开到凌晨的修表铺', tag: '生活', views: '32.1万', danmaku: '1.2万', duration: '18:42', mood: 'cold' },
                    { author: '手工阿木', title: '把一块停了二十年的表修好，是什么体验', tag: '手工', views: '12.8万', danmaku: '4300', duration: '24:10', mood: 'warm' },
                    { author: '沈知微', title: '深夜书店｜朗读会现场', tag: '人文', views: '8.6万', danmaku: '2100', duration: '42:05', mood: 'night' },
                ] });
            }
            if (system.includes('朋友圈') && system.includes('JSON')) {
                return JSON.stringify({
                    posts: [
                        { author: '沈知微', text: '今天有人站在诗集那排前哭了十分钟。我没敢上去问，只把空调调高了两度。', likes: ['夏之', '阿澈'], comments: [{ by: '夏之', text: '你每次都这样。' }, { by: '阿澈', text: '书店还招人吗，我缺钱' }] },
                        { author: '阿澈', text: '期末周第三天：泡面吃完了，开始吃饼干。', likes: ['沈知微'], comments: [{ by: '沈知微', text: '来书店，有热可可。' }] },
                        { author: '顾寒', text: '三点的工地，灯比星星多。', likes: [], comments: [{ by: '沈知微', text: '早点回去睡。' }] },
                    ],
                });
            }
            if (system.includes('评论') || prompt.includes('生成 1 到 4 个点赞')) {
                return JSON.stringify({ likes: ['夏之', '沈知微'], comments: [{ by: '夏之', text: '早点睡。' }, { by: '沈知微', text: '这张拍得真好。' }] });
            }
            if (system.includes('日记')) {
                return '今天下了入冬以来的第一场雪。\n\n修表铺里没什么客人，我把那盏旧台灯擦了又擦。她发消息说在路上了，我就把门口的灯留着，茶也重新泡了一杯。雪落在玻璃上，过了一会儿就化了。\n\n有些话还是没说。想着等她进门，先问一句冷不冷。';
            }
            if (system.includes('手机聊天软件')) {
                return pickReply(system, prompt);
            }
            return '嗯。';
        },
    };
    globalThis.__miragePersonaAvatar = svgAvatar('林', '#ffb36b', '#b46a5a');
    globalThis.SillyTavern = { getContext: () => context };
    globalThis.__miragePreview = { characters: CHARACTERS, photos: PHOTOS, user: USER, eventSource };
    return context;
}