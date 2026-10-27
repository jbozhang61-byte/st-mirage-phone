/**
 * 启程：给不知道剧情怎么往下走的人，摇一个可以立刻写下去的推进。
 */
export const TONES = [
    {
        id: 'intense', name: '激进', color: '#ff5a5f', icon: 'flame',
        desc: '把矛盾摊开：逼问、冲突、危险、表白',
        hint: '让某个人不得不现在做决定。可以有冲突、有逼迫感，但不要无脑撕破脸。',
    },
    {
        id: 'dream', name: '梦幻', color: '#a98bf0', icon: 'sparkle',
        desc: '超现实的一幕：梦、错觉、雨里的灯',
        hint: '让场景带上一点不真实：时间错位、梦境、重复出现的意象、说不清的东西。',
    },
    {
        id: 'plain', name: '平凡', color: '#e8a33c', icon: 'notes',
        desc: '日常小事：一顿饭、一段路、一句话',
        hint: '把注意力放到很小的日常细节上：食物、天气、手上的动作、没说出口的话。',
    },
    {
        id: 'normal', name: '一般', color: '#5aa7f5', icon: 'compass',
        desc: '平稳推进：一个新消息、一个新去处',
        hint: '用一件不大不小的事把剧情往前推一步：新的邀约、新的线索、一个需要回应的请求。',
    },
];

export function toneOf(id) {
    return TONES.find(tone => tone.id === id) || TONES[3];
}

const TWISTS = ['一个误会的电话', '突然的天气变化', '一个不认识的人', '一件旧物', '一句说漏嘴的话', '停电', '迟到的约定', '一封没寄出的信'];

export function plotSystemPrompt({ world, people, user }) {
    return [
        '你在帮一个互动故事的作者想「下一步可以怎么写」。',
        '世界：' + (world || '一个普通的城市'),
        people.length ? '可能在场的人：' + people.join('、') : '',
        '用户扮演：' + user,
        '你只给一个可以马上用的推进，不要写完整小说，不要替用户做决定。',
        '输出 JSON：',
        '{"title":"一句话标题","scene":"两三句的场景，写清楚在哪、发生了什么","hook":"留给用户的一个钩子或问题","twist":"一个意外元素","options":["用户可以直接选的做法 1","做法 2","做法 3"]}',
    ].filter(Boolean).join('\n');
}

export function plotUserPrompt({ tone, story, recent }) {
    const t = toneOf(tone);
    const lines = [];
    const storyText = (story || []).map(line => (line.isUser ? '用户' : line.name) + '：' + line.text).join('\n');
    if (storyText) lines.push('最近的剧情：\n' + storyText);
    if (recent?.title) lines.push('上一次摇到的推进是「' + recent.title + '」，这次换一个方向。');
    lines.push('想要的推进类型：' + t.name + '。' + t.hint);
    lines.push('写得具体一点，能直接放进正文。');
    return lines.join('\n');
}

export function plotFallback({ tone, world, people, story }) {
    const t = toneOf(tone);
    const who = people[0] || '那个人';
    const other = people[1] || who;
    const place = world || '这座城市';
    const last = (story || [])[story.length - 1];
    const lastText = last ? (last.isUser ? '你' : last.name) + '刚才说：「' + String(last.text).slice(0, 40) + '」' : '';
    const twist = TWISTS[Math.floor(Math.random() * TWISTS.length)];

    const packs = {
        intense: {
            title: who + '把话挑明了',
            scene: place + '的门口。' + who + '没有像平常那样回避，而是站在你面前，问了一句你没法糊弄过去的话。' + (lastText ? '刚才那句「' + lastText.slice(0, 30) + '」还悬在两个人之间。' : ''),
            hook: '你可以说实话，也可以选择现在转身。',
            options: ['把实话说完，哪怕会伤到对方', '先反问一句，把决定推回去', '什么都不说，拉着他离开这里'],
        },
        dream: {
            title: '同一个夜晚又发生了一次',
            scene: '你走进' + place + '，发现刚才的场景原样重演：同样的灯、同样的雪、同样的人。只有' + who + '看了你一眼，像是知道这是第几次。',
            hook: '这一次，你打算做点不一样的事吗？',
            options: ['顺着重演走，看看会停在哪', '拉住' + who + '，问他记不记得上一次', '转身出门，去' + other + '那里'],
        },
        plain: {
            title: '一顿没吃完的饭',
            scene: '桌上还剩半碗汤，' + who + '低头把最后一点热气吹散，说了一件很小的事：今天路口的树被修了枝。' + (lastText ? lastText.slice(0, 24) + '，好像也可以在这里放一放。' : ''),
            hook: '一句很普通的话，也许就是今天最该接住的东西。',
            options: ['顺着这件小事聊下去', '问他为什么突然说这个', '起身去结账，把这句话留在桌上'],
        },
        normal: {
            title: '一条新消息',
            scene: '手机亮了一下。' + other + '发来一段很短的文字，说有个地方想带你去，今晚。' + who + '在旁边看见了屏幕，没说话。',
            hook: '你要答应谁？',
            options: ['回' + other + '，今晚见', '把手机扣在桌上，先看' + who + '的反应', '问清楚是什么地方再做决定'],
        },
    };

    return { ...packs[t.id] || packs.normal, tone: t.id, twist };
}
