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