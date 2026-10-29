/**
 * 应用的元数据：主屏图标、应用商店条目。
 * 具体的界面在 apps/ 里，phone.js 负责注册。
 */
export const CORE_APPS = [
    { id: 'me', name: '我', label: '我', icon: 'user', cls: 'g-me', order: 0 },
    { id: 'float', name: '悬浮窗', label: '悬浮窗', icon: 'maximize', cls: 'g-float', order: 1 },
    { id: 'chat', label: '消息', icon: 'message', cls: 'g-message' },
    { id: 'moments', label: '朋友圈', icon: 'moments', cls: 'g-moments' },
    { id: 'contacts', label: '通讯录', icon: 'contacts', cls: 'g-contacts' },
    { id: 'photos', label: '相册', icon: 'photos', cls: 'g-photos' },
    { id: 'notes', label: '备忘录', icon: 'notes', cls: 'g-notes' },
    { id: 'wallet', label: '钱包', icon: 'wallet', cls: 'g-wallet' },
    { id: 'weather', label: '天气', icon: 'weather', cls: 'g-weather' },
    { id: 'settings', label: '设置', icon: 'settings', cls: 'g-settings' },
    { id: 'store', label: '应用商店', icon: 'bag', cls: 'g-store' },
];

export const STORE_APPS = [
    {
        id: 'plot', name: '启程', sub: 'Plot', label: '启程', icon: 'compass', cls: 'g-plot',
        category: '创作', size: '28 MB', rating: '5.0', color: '#4b3f8f', accent: '#8a7cf0',
        desc: '不知道剧情怎么往下走？摇一次',
    },
    {
        id: 'spark', name: '相遇', sub: 'Spark', label: '相遇', icon: 'heart', cls: 'g-spark',
        category: '社交', size: '46 MB', rating: '4.9', color: '#7a1f45', accent: '#ff5a8a',
        desc: '写一个你想遇见的人，然后认识 TA',
    },
    {
        id: 'maps', name: '地图', sub: 'Atlas', label: '地图', icon: 'map', cls: 'g-maps',
        category: '工具', size: '64 MB', rating: '4.7', color: '#123140', accent: '#4fb79c',
        desc: '地球、平面地图、选交通工具出门',
    },
    {
        id: 'browser', name: '浏览器', sub: 'Browser', label: '浏览器', icon: 'globe', cls: 'g-browser',
        category: '工具', size: '52 MB', rating: '4.6', color: '#2a4b8f', accent: '#5aa7f5',
        desc: '这个世界的网页，搜什么都有',
    },

    { id: 'x', name: 'X', sub: 'Twitter', label: 'X', icon: 'xlogo', cls: 'g-x', category: '社交', size: '88 MB', rating: '4.4', color: '#0f1419', accent: '#536471', desc: '这个世界正在发生什么' },
    { id: 'instagram', name: 'Instagram', sub: 'Ins', label: 'Ins', icon: 'instagram', cls: 'g-ins', category: '社交', size: '132 MB', rating: '4.6', color: '#8134af', accent: '#dd2a7b', desc: '用照片记下今天' },
    { id: 'reddit', name: 'Reddit', sub: 'r/', label: 'Reddit', icon: 'reddit', cls: 'g-reddit', category: '社区', size: '76 MB', rating: '4.3', color: '#ff4500', accent: '#ff8717', desc: '每个话题都有一个板块' },
    { id: 'zhihu', name: '知乎', sub: 'Zhihu', label: '知乎', icon: 'zhihu', cls: 'g-zhihu', category: '社区', size: '94 MB', rating: '4.5', color: '#0066ff', accent: '#4d94ff', desc: '有问题，就会有答案' },
    { id: 'quora', name: 'Quora', sub: 'Q&A', label: 'Quora', icon: 'quora', cls: 'g-quora', category: '社区', size: '82 MB', rating: '4.2', color: '#b92b27', accent: '#d9584f', desc: 'A place to share knowledge' },
    { id: 'youtube', name: 'YouTube', sub: 'YT', label: 'YouTube', icon: 'youtube', cls: 'g-yt', category: '视频', size: '210 MB', rating: '4.7', color: '#ff0000', accent: '#ff4d4d', desc: '你感兴趣的视频都在这里' },
    { id: 'discord', name: 'Discord', sub: 'Discord', label: 'Discord', icon: 'discord', cls: 'g-dc', category: '社交', size: '96 MB', rating: '4.4', color: '#5865f2', accent: '#7983f5', desc: '服务器、频道和深夜消息' },
    { id: 'telegram', name: 'Telegram', sub: 'TG', label: 'Telegram', icon: 'telegram', cls: 'g-tg', category: '社交', size: '78 MB', rating: '4.6', color: '#229ed9', accent: '#54b9e8', desc: '轻、快、能装下所有对话' },
    { id: 'spotify', name: 'Spotify', sub: 'Spotify', label: 'Spotify', icon: 'music', cls: 'g-sp', category: '音乐', size: '124 MB', rating: '4.7', color: '#1db954', accent: '#1ed760', desc: '这个世界的歌单' },
    { id: 'gmail', name: 'Gmail', sub: 'Mail', label: 'Gmail', icon: 'mail', cls: 'g-gm', category: '工具', size: '88 MB', rating: '4.5', color: '#ea4335', accent: '#fbbc04', desc: '收件箱里总有一封在等你' },
    { id: 'stocks', name: '股市', sub: 'Stocks', label: '股市', icon: 'chart', cls: 'g-stk', category: '工具', size: '48 MB', rating: '4.6', color: '#0e3b2e', accent: '#4fc3a1', desc: '旧城交易所，模拟盘' },
    {
        id: 'tiktok', name: '抖音', sub: 'TikTok', label: '抖音', icon: 'play', cls: 'g-tiktok',
        category: '娱乐', size: '128 MB', rating: '4.8', color: '#161823', accent: '#fe2c55',
        desc: '短视频社区，刷完这一条就睡',
    },
    {
        id: 'weibo', name: '微博', sub: 'Weibo', label: '微博', icon: 'hash', cls: 'g-weibo',
        category: '资讯', size: '96 MB', rating: '4.5', color: '#ff8200', accent: '#ff8200',
        desc: '热搜、动态和这个世界的热闹',
    },
    {
        id: 'xhs', name: '小红书', sub: 'RED', label: '小红书', icon: 'book', cls: 'g-xhs',
        category: '生活', size: '112 MB', rating: '4.7', color: '#ff2442', accent: '#ff2442',
        desc: '标记我的生活，也看别人的',
    },
    {
        id: 'bili', name: '哔哩哔哩', sub: 'Bilibili', label: 'B站', icon: 'tv', cls: 'g-bili',
        category: '视频', size: '156 MB', rating: '4.9', color: '#fb7299', accent: '#fb7299',
        desc: '你感兴趣的视频都在这里',
    },
    { id: 'tieba', name: '百度贴吧', sub: 'Tieba', label: '贴吧', icon: 'tieba', cls: 'g-tieba', category: '社区', size: '86 MB', rating: '4.4', color: '#3385ff', accent: '#5aa0ff', desc: '旧城的人都在这里发帖' },
    { id: 'calendar', name: '日历', sub: 'Calendar', label: '日历', icon: 'calendar', cls: 'g-calendar', category: '工具', size: '42 MB', rating: '4.6', color: '#8f2f2f', accent: '#ff8a7a', desc: '从正文里提取日程和约会' },
    { id: 'live', name: '直播', sub: 'Live', label: '直播', icon: 'live', cls: 'g-live', category: '视频', size: '168 MB', rating: '4.5', color: '#5a1f5f', accent: '#ff5ca8', desc: '角色开播，弹幕和正文连着' },
    { id: 'douban', name: '豆瓣', sub: 'Douban', label: '豆瓣', icon: 'douban', cls: 'g-douban', category: '阅读', size: '76 MB', rating: '4.7', color: '#1f4a2e', accent: '#6fcf8a', desc: '角色给书影音打分写短评' },
    { id: 'xianyu', name: '闲鱼', sub: 'Second Hand', label: '闲鱼', icon: 'xianyu', cls: 'g-xianyu', category: '购物', size: '96 MB', rating: '4.5', color: '#8a6a10', accent: '#ffd65c', desc: '角色卖旧物，能顺着找上门' },
    { id: 'travel', name: '出行', sub: 'Travel', label: '出行', icon: 'train', cls: 'g-travel', category: '工具', size: '88 MB', rating: '4.5', color: '#1c4a6b', accent: '#6fd0ff', desc: '打车、火车和这座城市的路线' },
    { id: 'google', name: 'Google', sub: 'Search', label: 'Google', icon: 'search', cls: 'g-google', category: '工具', size: '74 MB', rating: '4.8', color: '#1a3f8f', accent: '#6b9cff', desc: '搜索这个世界里发生的事' },
    { id: 'yandex', name: 'Yandex', sub: 'Поиск', label: 'Yandex', icon: 'search', cls: 'g-yandex', category: '工具', size: '92 MB', rating: '4.5', color: '#8f1c1c', accent: '#ff5d5d', desc: '另一个搜索入口' },
    { id: 'wiki', name: 'Wikipedia', sub: '百科', label: 'Wikipedia', icon: 'book', cls: 'g-wiki', category: '工具', size: '46 MB', rating: '4.9', color: '#3a3a3a', accent: '#d9d9d9', desc: '按正文生成的世界百科' },
    { id: 'zlib', name: 'Z-Library', sub: 'Books', label: 'Z-Library', icon: 'book', cls: 'g-zlib', category: '工具', size: '118 MB', rating: '4.6', color: '#2c2c2c', accent: '#c46a4a', desc: '按正文生成电子书库' },
    { id: 'pdd', name: '拼多多', sub: 'PDD', label: '拼多多', icon: 'pdd', cls: 'g-pdd', category: '购物', size: '156 MB', rating: '4.6', color: '#b3271e', accent: '#ff5a4e', desc: '百亿补贴、拼单和九块九' },
    { id: 'taobao', name: '淘宝', sub: 'Taobao', label: '淘宝', icon: 'taobao', cls: 'g-taobao', category: '购物', size: '202 MB', rating: '4.7', color: '#b34a15', accent: '#ff8a3d', desc: '万能的淘宝，什么都买得到' },
    { id: 'jd', name: '京东', sub: 'JD', label: '京东', icon: 'jd', cls: 'g-jd', category: '购物', size: '188 MB', rating: '4.7', color: '#9e1f2b', accent: '#ff5c6a', desc: '自营、次日达和数码家电' },
    { id: 'amazon', name: 'Amazon', sub: 'Amazon', label: 'Amazon', icon: 'amazon', cls: 'g-amazon', category: '购物', size: '214 MB', rating: '4.6', color: '#16324f', accent: '#ffb04d', desc: '全球购、图书和 Prime 两日达' },
    { id: 'deepseek', name: 'DeepSeek', sub: 'DeepSeek', label: 'DeepSeek', icon: 'deepseek', cls: 'g-deepseek', category: '工具', size: '110 MB', rating: '4.8', color: '#1b3b6f', accent: '#5b9dff', desc: '用 DeepSeek 回答手机和正文里的问题' },
    { id: 'chatgpt', name: 'ChatGPT', sub: 'OpenAI', label: 'ChatGPT', icon: 'chatgpt', cls: 'g-chatgpt', category: '工具', size: '128 MB', rating: '4.8', color: '#1f4a3d', accent: '#5fd6a8', desc: '用 OpenAI 回答手机和正文里的问题' },
    { id: 'claude', name: 'Claude', sub: 'Anthropic', label: 'Claude', icon: 'claude', cls: 'g-claude', category: '工具', size: '96 MB', rating: '4.7', color: '#5a3320', accent: '#e8a06b', desc: '用 Claude 回答手机和正文里的问题' },
    { id: 'gemini', name: 'Gemini', sub: 'Google', label: 'Gemini', icon: 'gemini', cls: 'g-gemini', category: '工具', size: '104 MB', rating: '4.6', color: '#2d2a6b', accent: '#a99bff', desc: '用 Gemini 回答手机和正文里的问题' },
    { id: 'ai', name: 'AI', sub: 'Assistant', label: 'AI', icon: 'sparkle', cls: 'g-ai', category: '工具', size: '120 MB', rating: '4.9', color: '#2b2f6b', accent: '#8f9bff', desc: '按正文和手机里的消息回答问题' },
    { id: 'world', name: '世界', sub: 'World', label: '世界', icon: 'globe', cls: 'g-world', category: '工具', size: '36 MB', rating: '4.9', color: '#1d4a5c', accent: '#5fd0c0', desc: '这个世界是什么样子、有多大' },
    { id: 'heart', name: '心', sub: 'Heart', label: '心', icon: 'heart', cls: 'g-heart', category: '社交', size: '42 MB', rating: '4.8', color: '#8f1f45', accent: '#ff6b9a', desc: '关系、偏好和今天穿什么' },
    { id: 'facebook', name: 'Facebook', sub: 'FB', label: 'Facebook', icon: 'facebook', cls: 'g-fb', category: '社交', size: '120 MB', rating: '4.3', color: '#1877f2', accent: '#4a9bff', desc: '和朋友、和这个世界保持联系' },
    { id: 'signal', name: 'Signal', sub: 'Signal', label: 'Signal', icon: 'signal', cls: 'g-signal', category: '社交', size: '62 MB', rating: '4.8', color: '#3a76f0', accent: '#6a9bff', desc: '端到端加密的私人对话' },
];

export const APP_META = Object.fromEntries([...CORE_APPS, ...STORE_APPS].map(app => [app.id, app]));

export function appMeta(id) {
    return APP_META[id] || null;
}

export function installedAppMeta(ids = []) {
    return ids.map(id => STORE_APPS.find(app => app.id === id)).filter(Boolean);
}