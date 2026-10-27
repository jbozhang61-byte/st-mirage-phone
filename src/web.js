/** 浏览器：这个世界的网页。 */
export function webSystemPrompt({ world, people, user }) {
    return [
        '你在生成一个故事世界里的网页内容。',
        '世界：' + (world || '一个普通的城市'),
        people.length ? '相关的人：' + people.join('、') : '',
        '用户：' + user,
        '网页要像真的：有标题、有正文、有一点广告或无关信息，但不要低俗。',
        '只输出 JSON：',
        '{"title":"网页标题","summary":"一句话摘要","sections":[{"h":"小标题","p":"一段正文"}],"links":[{"title":"相关链接","url":"example.com/xxx"}]}',
    ].filter(Boolean).join('\n');
}

export function webUserPrompt(query) {
    return '用户打开了浏览器，搜索/访问：' + query + '\n生成这个页面的内容。';
}

export function webFallback({ query, world, people }) {
    const who = people[0] || '有人';
    const place = world || '这座城市';
    return {
        title: query + ' — ' + place + '小站',
        summary: '一个不太正式的地方网站，内容由本地人维护。',
        sections: [
            { h: '最近', p: place + '这几天一直在下雪。街角的店开得比平时晚，' + who + '说路上不好走，让大家别急着出门。' },
            { h: '关于' + query, p: '关于「' + query + '」的说法有很多版本。比较可信的一个是：它原本只是一个小地方，后来被越来越多人知道，就成了现在这样。' },
            { h: '留言', p: '“有人知道具体位置吗？” “去了两次都没开门。” “别在下雪天去。”' },
        ],
        links: [
            { title: '返回首页', url: 'home' },
            { title: place + '天气', url: 'weather' },
            { title: '本地论坛', url: 'forum' },
        ],
    };
}
