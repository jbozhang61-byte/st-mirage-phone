/** Discord / Telegram / Spotify / Gmail：内容配方与兜底。 */
const base = ({ world, people, user, story }) => {
    const lines = [
        world ? '世界：' + world : '',
        people.length ? '人物：' + people.join('、') : '',
        '用户：' + user,
    ].filter(Boolean);
    const text = (story || []).map(line => (line.isUser ? '用户' : line.name) + '：' + String(line.text || '').slice(0, 200)).join('\n');
    if (text) lines.push('最近的剧情：\n' + text);
    return lines.join('\n');
};

export const EXTRA = {
    discord: {
        name: 'Discord',
        system: ctx => ['你在生成一个故事世界里的 Discord：服务器、频道、群组和消息。', base(ctx), '只输出 JSON：{"servers":[{"name":"服务器名","channels":[{"name":"频道","messages":[{"author":"名字","text":"消息","time":"21:02"}]}]}]}'].join('\n'),
        prompt: () => '生成 2 个服务器，每个 2 个频道，每个频道 3 条消息，像真人在深夜聊天。',
        parse: raw => {
            const json = raw || {};
            return { servers: (Array.isArray(json.servers) ? json.servers : []).slice(0, 3).map(server => ({
                name: String(server?.name || '服务器').slice(0, 24),
                channels: (Array.isArray(server?.channels) ? server.channels : []).slice(0, 4).map(channel => ({
                    name: String(channel?.name || '频道').slice(0, 24),
                    messages: (Array.isArray(channel?.messages) ? channel.messages : []).slice(0, 8).map(message => ({
                        author: String(message?.author || '网友').slice(0, 24),
                        text: String(message?.text || '').slice(0, 240),
                        time: String(message?.time || '').slice(0, 10),
                    })),
                })),
            })).filter(server => server.channels.length) };
        },
        fallback: ctx => ({
            servers: [
                { name: '旧城', channels: [{ name: '日常', messages: ctx.people.slice(0, 3).map((name, i) => ({ author: name, text: ['门口灯还亮着。', '在路上了，十分钟。', '今天有人来过吗？'][i], time: ['21:02', '21:14', '21:20'][i] })) }] },
                { name: '巡宁所', channels: [{ name: '值班', messages: ctx.people.slice(0, 2).map((name, i) => ({ author: name, text: ['档案室的门没关。', '我去看看。'][i], time: ['20:40', '20:46'][i] })) }] },
            ],
        }),
    },
    telegram: {
        name: 'Telegram',
        system: ctx => ['你在生成 Telegram 的会话列表，包括私聊和群组。', base(ctx), '只输出 JSON：{"chats":[{"name":"名字","preview":"最后一条消息","time":"21:20","unread":2,"group":true,"members":12}]}'].join('\n'),
        prompt: () => '生成 6 个会话，预览要像真的在聊什么。',
        parse: raw => ({ chats: (Array.isArray(raw?.chats) ? raw.chats : []).slice(0, 10).map(chat => ({ name: String(chat?.name || '对话').slice(0, 24), preview: String(chat?.preview || '').slice(0, 120), time: String(chat?.time || '').slice(0, 10), unread: Math.max(0, Number(chat?.unread) || 0), group: !!chat?.group, members: Math.max(0, Number(chat?.members) || 0) })) }),
        fallback: ctx => ({ chats: [
                { name: '旧城夜谈', preview: '今晚还开吗？', time: '21:40', unread: 6, group: true, members: 12 },
                { name: '巡宁所值班室', preview: '档案室的门没关。', time: '21:22', unread: 0, group: true, members: 5 },
                ...ctx.people.map((name, i) => ({ name, preview: ['在吗？', '门口的灯给你留着。', '今天还来吗', '刚到家。'][i % 4], time: '21:2' + (i % 9), unread: i === 0 ? 2 : 0 })),
            ] }),
    },
    spotify: {
        name: 'Spotify',
        system: ctx => ['你在生成一个歌单。', base(ctx), '只输出 JSON：{"now":{"title":"歌名","artist":"歌手"},"tracks":[{"title":"歌名","artist":"歌手","time":"3:42"}]}'].join('\n'),
        prompt: () => '生成 12 首歌，歌名和歌手要像这个世界的，风格尽量不同。',
        parse: raw => ({
            now: raw?.now?.title ? { title: String(raw.now.title).slice(0, 60), artist: String(raw.now.artist || '').slice(0, 40) } : null,
            tracks: (Array.isArray(raw?.tracks) ? raw.tracks : []).slice(0, 14).map(track => ({ title: String(track?.title || '').slice(0, 60), artist: String(track?.artist || '').slice(0, 40), time: String(track?.time || '').slice(0, 8) })),
        }),
        fallback: ctx => ({ now: { title: '雪停之后', artist: '旧城电台' }, tracks: ['雪停之后', '门口那盏灯', '凌晨两点的便利店', '旧城', '回程', '末班车', '屋檐下的雨', '旧唱片', '北街的风', '你说晚安之后', '天台上的星星', '慢慢走'].map((title, i) => ({ title, artist: ['旧城电台', ctx.people[0] || '夏之', '夜班合唱团', '无名人', ctx.people[1] || '沈知微', '旧城电台', '阿澈', '顾寒', '夜班合唱团', '夏之', '无名人', '旧城电台'][i], time: ['3:42', '4:05', '3:18', '5:12', '2:56', '3:31', '4:22', '3:07', '4:48', '3:55', '2:41', '4:12'][i] })) }),
    },
    gmail: {
        name: 'Gmail',
        system: ctx => ['你在生成收件箱。', base(ctx), '只输出 JSON：{"emails":[{"from":"发件人","subject":"主题","preview":"预览","time":"21:10"}]}'].join('\n'),
        prompt: () => '生成 6 封邮件，主题和预览要像真的。',
        parse: raw => ({ emails: (Array.isArray(raw?.emails) ? raw.emails : []).slice(0, 10).map(mail => ({ from: String(mail?.from || '').slice(0, 30), subject: String(mail?.subject || '').slice(0, 80), preview: String(mail?.preview || '').slice(0, 160), time: String(mail?.time || '').slice(0, 10) })) }),
        fallback: ctx => ({ emails: [
            { from: '旧城书店', subject: '你订的那本书到了', preview: '放在柜台下面，晚上来拿。', time: '21:10' },
            { from: ctx.people[0] || '夏之', subject: '今晚有空吗', preview: '门口那家还开着，我等你到十点。', time: '20:42' },
            { from: '巡宁所', subject: '关于昨天的登记', preview: '麻烦你补充一下同行人的信息。', time: '18:05' },
        ] }),
    },
};