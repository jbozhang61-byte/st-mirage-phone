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
    {
        id: 'shura', name: '修罗场', color: '#ff4d8d', icon: 'heart',
        desc: '多角关系撞在一起，谁都不肯退',
        hint: '把几个对主角有意思的人放进同一个场合，让气氛失控一点：表面客气、暗地交锋、互相试探。',
    },
    {
        id: 'yuri', name: '百合', color: '#ff8fc7', icon: 'sparkle',
        desc: '女生之间的靠近、试探与心动',
        hint: '把重心放在女生之间的关系上：眼神、靠近、指尖的犹豫，写细腻但不越界。',
    },
    {
        id: 'mystery', name: '悬疑', color: '#7c8cff', icon: 'search',
        desc: '一件说不清的事：线索、错位、隐瞒',
        hint: '抛出一个不对劲的细节或前后矛盾的一句话，让读者想跟着查下去。',
    },
    {
        id: 'scheme', name: '权谋', color: '#4fbf9f', icon: 'users',
        desc: '台面下的交易：试探、交换、站队',
        hint: '把局面变成利益交换：有人提条件、有人试探底线，话说一半留一半。',
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
        shura: {
            title: '她们在同一个房间里',
            scene: place + '的客厅。' + who + '和' + other + '都在，一个在削水果，一个在翻书。你进门时两个人同时抬头，然后又同时把视线移开。空气里全是没说出口的话。',
            hook: '现在，你必须选一个位置坐下。',
            options: ['坐到' + who + '旁边，装作没事', '坐到中间，谁也不偏', '谁都不坐，先开口把话挑明'],
        },
        yuri: {
            title: '她替你整理领口',
            scene: '散场以后走廊里只剩你和她。' + who + '伸手替你把歪掉的领口理好，指尖停了一秒才收回去，然后假装在看你身后的海报。',
            hook: '这一秒里，要不要说点什么？',
            options: ['伸手把她的手按回去，说谢谢', '装作没察觉，把话题岔开', '直接问她刚才在想什么'],
        },
        mystery: {
            title: '多出来的一把伞',
            scene: '门口放着一把不属于任何人的伞，伞柄上有一道旧划痕。' + who + '说自己今天没带伞出门，但鞋边是湿的。',
            hook: '这件事，你要不要现在就问？',
            options: ['盯着那把伞，直接问她', '什么都不说，把伞收起来', '先出门，回头再查'],
        },
        scheme: {
            title: '一份不该你看到的名单',
            scene: '桌上摊着一张手写的名单，最后一行被笔尖反复划过。' + other + '推过来一杯酒，说这只是先给你看看，"后面还有得谈"。',
            hook: '你要接这张名单，还是先问代价？',
            options: ['先把名单看完', '问清楚要付出什么', '把名单推回去，说自己再想想'],
        },
    };

    return { ...packs[t.id] || packs.normal, tone: t.id, twist };
}
