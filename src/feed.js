/**
 * 应用商店里几个内容类 App 的「内容配方」：
 * 提示词、解析、以及没有 AI / 生成失败时的兜底内容。
 */
import { extractJson, trim } from './prompts.js';

function pick(list, index) {
    if (!list.length) return '某人';
    return list[index % list.length];
}

function baseContext({ world, people, user, story }) {
    const lines = [];
    if (world) lines.push('世界：' + world);
    if (people.length) lines.push('世界里的人：' + people.join('、'));
    lines.push('用户：' + user);
    const storyText = (story || []).map(line => (line.isUser ? '用户' : line.name) + '：' + trim(line.text, 160)).join('\n');
    if (storyText) lines.push('最近的剧情：\n' + storyText);
    return lines.join('\n');
}

function creatorNames(people, count) {
    if (people.length) return people;
    return ['某个网友', '路过的人', '同城的人'];
}

export const FEEDS = {
    tiktok: {
        name: '抖音',
        count: 6,
        system: ctx => [
            '你在为一个故事世界生成「抖音 / TikTok」的短视频信息流。',
            baseContext(ctx),
            '',
            '内容要像真人刷到的短视频：生活片段、手艺、街景、宠物、情绪、吐槽、深夜碎碎念。',
            '作者是这个世界里的人或普通网友，语气自然，不要广告腔，不要每条都提到用户。',
            '只输出 JSON：',
            '{"videos":[{"author":"作者","title":"一句话标题","desc":"视频里发生的事，一到两句","tags":["标签1","标签2"],"likes":1234,"comments":86,"shares":12,"music":"背景音乐名","mood":"warm|cold|night|neon|street"}]}',
        ].join('\n'),
        prompt: ({ count }) => '生成 ' + count + ' 条短视频，作者尽量不同，mood 在几种里变化。',
        parse: raw => {
            const json = extractJson(raw);
            const list = Array.isArray(json?.videos) ? json.videos : (Array.isArray(json) ? json : []);
            return list.slice(0, 8).map((item, index) => ({
                id: 'tt' + index,
                author: String(item.author || '某个网友').slice(0, 20),
                title: String(item.title || '').slice(0, 60),
                desc: String(item.desc || item.text || '').slice(0, 220),
                tags: (Array.isArray(item.tags) ? item.tags : []).slice(0, 4).map(t => String(t).slice(0, 12)),
                likes: Math.max(0, Math.round(Number(item.likes) || 0)),
                comments: Math.max(0, Math.round(Number(item.comments) || 0)),
                shares: Math.max(0, Math.round(Number(item.shares) || 0)),
                music: String(item.music || '原声').slice(0, 40),
                mood: ['warm', 'cold', 'night', 'neon', 'street'].includes(item.mood) ? item.mood : 'night',
            })).filter(item => item.desc || item.title);
        },
        fallback: ctx => {
            const names = creatorNames(ctx.people, 4);
            const world = ctx.world || '这座城市';
            return [
                { author: pick(names, 0), title: '下雪那天，街角的灯一直亮着', desc: '本来只是路过，站了很久。雪落在肩上也没觉得冷。', tags: ['城市夜景', '下雪了'], likes: 12800, comments: 342, shares: 88, music: '慢速的钢琴', mood: 'cold' },
                { author: pick(names, 1), title: '修一块表要三个小时', desc: '拆开、清洗、上油、装回去。急不来。', tags: ['手艺', '解压'], likes: 5200, comments: 129, shares: 21, music: '原声', mood: 'warm' },
                { author: pick(names, 2), title: '深夜便利店的东西最好吃', desc: '关东煮、热牛奶，还有窗外的雨。', tags: ['深夜食堂', '一个人'], likes: 8600, comments: 210, shares: 45, music: 'lo-fi', mood: 'night' },
                { author: '城市的陌生人', title: '你会不会也在地铁上假装看手机', desc: '其实只是在躲开别人的目光。', tags: ['共鸣', '通勤'], likes: 23000, comments: 1200, shares: 300, music: '环境音', mood: 'street' },
                { author: pick(names, 3), title: world + '的凌晨三点', desc: '只有路灯和便利店还醒着。', tags: ['凌晨', '城市'], likes: 4100, comments: 66, shares: 12, music: '夜风', mood: 'neon' },
            ];
        },
    },

    weibo: {
        name: '微博',
        count: 5,
        system: ctx => [
            '你在为一个故事世界生成「微博」的热搜和动态。',
            baseContext(ctx),
            '',
            '热搜要是这个世界里可能发生的事：天气、城市新闻、趣事、争议、温暖的小事。',
            '动态像真人发的微博：口语，可以带话题，可以有情绪。',
            '只输出 JSON：',
            '{"hot":[{"title":"热搜标题","heat":"123万","tag":"热|新|沸"}],"posts":[{"author":"作者","time":"3分钟前","text":"正文","topic":"#话题#","likes":123,"comments":45,"reposts":12}]}',
        ].join('\n'),
        prompt: ({ count }) => '生成 6 条热搜和 ' + count + ' 条动态。',
        parse: raw => {
            const json = extractJson(raw);
            const posts = Array.isArray(json?.posts) ? json.posts : [];
            const hot = Array.isArray(json?.hot) ? json.hot : [];
            return {
                hot: hot.slice(0, 8).map((item, index) => ({
                    id: 'h' + index,
                    title: String(item.title || '').slice(0, 60),
                    heat: String(item.heat || '').slice(0, 12),
                    tag: ['热', '新', '沸'].includes(item.tag) ? item.tag : '',
                })).filter(item => item.title),
                posts: posts.slice(0, 8).map((item, index) => ({
                    id: 'w' + index,
                    author: String(item.author || '网友').slice(0, 24),
                    time: String(item.time || '刚刚').slice(0, 16),
                    text: String(item.text || '').slice(0, 400),
                    topic: String(item.topic || '').slice(0, 40),
                    likes: Math.max(0, Math.round(Number(item.likes) || 0)),
                    comments: Math.max(0, Math.round(Number(item.comments) || 0)),
                    reposts: Math.max(0, Math.round(Number(item.reposts) || 0)),
                })).filter(item => item.text),
            };
        },
        fallback: ctx => {
            const names = creatorNames(ctx.people, 4);
            return {
                hot: [
                    { id: 'h1', title: '旧城今年第一场雪', heat: '128万', tag: '热' },
                    { id: 'h2', title: '修表铺门口的灯又亮了', heat: '76万', tag: '新' },
                    { id: 'h3', title: '深夜书店还开着吗', heat: '42万', tag: '' },
                    { id: 'h4', title: '便利店关东煮涨价', heat: '23万', tag: '' },
                ],
                posts: [
                    { id: 'w1', author: pick(names, 0), time: '12分钟前', text: '雪停了。门口那盏灯忘了关，就这样亮了一整夜。', topic: '#旧城的冬天#', likes: 3200, comments: 210, reposts: 88 },
                    { id: 'w2', author: pick(names, 1), time: '1小时前', text: '今天的客人站在诗集那排前哭了十分钟，我假装在整理书。', topic: '#书店日常#', likes: 1800, comments: 302, reposts: 45 },
                    { id: 'w3', author: '旧城气象', time: '今天 06:20', text: '今日小雪转阴，最低 7 度。路面湿滑，出门记得带伞。', topic: '#天气#', likes: 620, comments: 44, reposts: 120 },
                ],
            };
        },
    },

    xhs: {
        name: '小红书',
        count: 6,
        system: ctx => [
            '你在为一个故事世界生成「小红书」的图文笔记。',
            baseContext(ctx),
            '',
            '笔记像真人分享：探店、穿搭、房间、书、吃的、情绪。标题要短、有钩子，正文口吻自然。',
            '只输出 JSON：',
            '{"notes":[{"author":"作者","title":"标题","text":"正文","likes":1234,"collects":300,"mood":"warm|cold|night|neon|street"}]}',
        ].join('\n'),
        prompt: ({ count }) => '生成 ' + count + ' 篇笔记，作者尽量不同。',
        parse: raw => {
            const json = extractJson(raw);
            const list = Array.isArray(json?.notes) ? json.notes : [];
            return list.slice(0, 9).map((item, index) => ({
                id: 'x' + index,
                author: String(item.author || '某个网友').slice(0, 20),
                title: String(item.title || '').slice(0, 60),
                text: String(item.text || '').slice(0, 400),
                likes: Math.max(0, Math.round(Number(item.likes) || 0)),
                collects: Math.max(0, Math.round(Number(item.collects) || 0)),
                mood: ['warm', 'cold', 'night', 'neon', 'street'].includes(item.mood) ? item.mood : 'warm',
            })).filter(item => item.title || item.text);
        },
        fallback: ctx => {
            const names = creatorNames(ctx.people, 4);
            return [
                { id: 'x1', author: pick(names, 0), title: '在旧城住到第三年，才发现的四家小店', text: '修表铺其实也卖旧表带。书店二楼有一箱没拆封的诗集。还有一家只在深夜开的面馆。', likes: 4300, collects: 2100, mood: 'warm' },
                { id: 'x2', author: pick(names, 1), title: '下雪天最适合待着的房间', text: '一盏黄灯、一条毯子、一杯热牛奶。把窗帘拉开一点，雪就会落进眼睛里。', likes: 8900, collects: 5200, mood: 'cold' },
                { id: 'x3', author: '住在隔壁的人', title: '我的深夜书单｜适合睡不着的时候', text: '不要太厚，不要有太多情节。最好是那种读一页就能发呆很久的。', likes: 2300, collects: 1800, mood: 'night' },
                { id: 'x4', author: pick(names, 2), title: '今天的关东煮，萝卜要煮久一点', text: '便利店的阿姨认识我了，会给我多留一块萝卜。', likes: 1200, collects: 340, mood: 'street' },
            ];
        },
    },

    bili: {
        name: '哔哩哔哩',
        count: 6,
        system: ctx => [
            '你在为一个故事世界生成「哔哩哔哩」的推荐视频。',
            baseContext(ctx),
            '',
            '视频像 B 站首页：手工、探店、游戏、知识、音乐、日常、鬼畜。标题有网感，但不低俗。',
            '只输出 JSON：',
            '{"videos":[{"author":"UP主","title":"标题","tag":"分区","views":"12.3万","danmaku":"4200","duration":"12:34","mood":"warm|cold|night|neon|street"}]}',
        ].join('\n'),
        prompt: ({ count }) => '生成 ' + count + ' 个视频，分区和时长要多样。',
        parse: raw => {
            const json = extractJson(raw);
            const list = Array.isArray(json?.videos) ? json.videos : [];
            return list.slice(0, 9).map((item, index) => ({
                id: 'b' + index,
                author: String(item.author || 'UP主').slice(0, 24),
                title: String(item.title || '').slice(0, 80),
                tag: String(item.tag || '日常').slice(0, 12),
                views: String(item.views || '1万').slice(0, 12),
                danmaku: String(item.danmaku || '100').slice(0, 12),
                duration: String(item.duration || '03:00').slice(0, 10),
                mood: ['warm', 'cold', 'night', 'neon', 'street'].includes(item.mood) ? item.mood : 'night',
            })).filter(item => item.title);
        },
        fallback: ctx => {
            const names = creatorNames(ctx.people, 4);
            return [
                { id: 'b1', author: pick(names, 0), title: '【4K】旧城的雪，和一间开到凌晨的修表铺', tag: '生活', views: '32.1万', danmaku: '1.2万', duration: '18:42', mood: 'cold' },
                { id: 'b2', author: '手工阿木', title: '把一块停了二十年的表修好，是什么体验', tag: '手工', views: '12.8万', danmaku: '4300', duration: '24:10', mood: 'warm' },
                { id: 'b3', author: pick(names, 1), title: '深夜书店｜朗读会现场，有人读了一首很旧的诗', tag: '人文', views: '8.6万', danmaku: '2100', duration: '42:05', mood: 'night' },
                { id: 'b4', author: '干饭小分队', title: '旧城便利店关东煮横向测评，第一名有点意外', tag: '美食', views: '21.4万', danmaku: '5600', duration: '09:18', mood: 'street' },
                { id: 'b5', author: '夜行电台', title: '凌晨三点的城市声音｜环境音 2 小时', tag: '音乐', views: '5.2万', danmaku: '880', duration: '2:00:00', mood: 'neon' },
            ];
        },
    },
};

export function feedConfig(appId) {
    return FEEDS[appId] || null;
}
