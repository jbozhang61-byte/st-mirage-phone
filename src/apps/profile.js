/** 各社交 App 的个人主页：同一个入口，不同的主页结构。 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { getData, getCast } from '../store.js';
import { userName, personaAvatarUrl, currentCharacter } from '../st.js';
import { artFor } from '../art.js';
import { moodOf } from './feed-common.js';

const APP = {
    x: { name: 'X', handle: 'x', color: '#536471' },
    instagram: { name: 'Instagram', handle: 'ins', color: '#c13584' },
    reddit: { name: 'Reddit', handle: 'r', color: '#ff4500' },
    zhihu: { name: '知乎', handle: 'zhihu', color: '#0066ff' },
    quora: { name: 'Quora', handle: 'quora', color: '#b92b27' },
    youtube: { name: 'YouTube', handle: 'yt', color: '#ff0000' },
};

export function openProfile(appId, items = []) {
    const app = APP[appId] || { name: 'App', handle: 'app', color: '#555' };
    const name = userName() || '我';
    const world = currentCharacter()?.name || getData().meta?.city || '旧城';
    const cast = getCast();
    const seed = name.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const posts = (items || []).slice(0, 6);

    const stats = {
        x: [['关注', 30 + seed % 80], ['关注者', 120 + seed % 900]],
        instagram: [['帖子', 12 + seed % 40], ['关注者', 240 + seed % 800], ['关注', 80 + seed % 120]],
        reddit: [['karma', 300 + seed % 4000], ['板块', 4 + seed % 12]],
        zhihu: [['回答', 8 + seed % 30], ['赞同', 200 + seed % 1500], ['关注者', 90 + seed % 400]],
        quora: [['Answers', 6 + seed % 24], ['Upvotes', 120 + seed % 900]],
        youtube: [['订阅者', 500 + seed % 4000], ['视频', 10 + seed % 30]],
    }[appId] || [['帖子', 12], ['关注者', 120]];

    const statEl = h('div', { class: 'mp-pf__stats' }, stats.map(([label, value]) => h('div', { class: 'mp-pf__stat' }, h('b', { text: String(value) }), h('span', { text: label }))));

    const content = h('div', { class: 'mp-pf mp-pf--' + appId },
        h('div', { class: 'mp-pf__cover', style: { background: 'linear-gradient(135deg, ' + app.color + '66, rgba(255,255,255,.06))' } }),
        h('div', { class: 'mp-pf__head' },
            avatar({ name, size: 66, src: personaAvatarUrl(), cls: 'mp-pf__avatar' }),
            h('div', { class: 'mp-pf__id' },
                h('div', { class: 'mp-pf__name', text: name }),
                h('div', { class: 'mp-pf__handle', text: '@' + name.toLowerCase().replace(/\s+/g, '') + '_' + app.handle }),
            ),
        ),
        h('div', { class: 'mp-pf__bio', text: '住在' + world + '。' + (cast.length ? '认识 ' + cast.length + ' 个人。' : '') + '在' + app.name + '上随便看看。' }),
        statEl,
    );

    if (appId === 'instagram') {
        content.appendChild(h('div', { class: 'mp-pf__tabs' }, h('span', { class: 'on', text: '帖子' }), h('span', { text: 'Reels' }), h('span', { text: '标记' })));
        const grid = h('div', { class: 'mp-pf__grid' });
        for (const item of posts) {
            grid.appendChild(h('div', { class: 'mp-pf__gridcell', style: { backgroundImage: artFor(item.id + item.author + item.text, moodOf(item)) } }));
        }
        content.appendChild(grid);
    } else if (appId === 'youtube') {
        const grid = h('div', { class: 'mp-pf__videos' });
        for (const item of posts) {
            grid.appendChild(h('div', { class: 'mp-pf__video' },
                h('div', { class: 'mp-pf__vcover', style: { backgroundImage: artFor(item.id + item.title, moodOf(item)) } }, h('span', { class: 'mp-pf__vplay' }, icon('play', '', 16))),
                h('div', { class: 'mp-pf__vtitle', text: item.title || item.text }),
            ));
        }
        content.appendChild(grid);
    } else if (appId === 'reddit') {
        content.appendChild(h('div', { class: 'mp-pf__subs' }, h('span', { text: 'r/旧城' }), h('span', { text: 'r/夜班' }), h('span', { text: 'r/提问' })));
        for (const item of posts) {
            content.appendChild(h('div', { class: 'mp-pf__item' },
                h('span', { class: 'mp-pf__votes', text: '▲ ' + (item.votes || 0) }),
                h('div', {}, h('div', { class: 'mp-pf__post-title', text: item.title || item.text }), h('div', { class: 'mp-pf__post-meta', text: item.sub || 'r/all' })),
            ));
        }
    } else if (appId === 'zhihu' || appId === 'quora') {
        for (const item of posts) {
            content.appendChild(h('div', { class: 'mp-pf__item' },
                h('div', {},
                    h('div', { class: 'mp-pf__post-title', text: item.title || item.text }),
                    h('div', { class: 'mp-pf__post-meta', text: (item.answers || 0) + ' 回答 · ' + (item.votes || 0) + ' 赞同' }),
                ),
            ));
        }
    } else {
        content.appendChild(h('div', { class: 'mp-pf__tabs' }, h('span', { class: 'on', text: '帖子' }), h('span', { text: '回复' }), h('span', { text: '喜欢' })));
        for (const item of posts) {
            content.appendChild(h('div', { class: 'mp-pf__post' },
                h('div', { class: 'mp-pf__post-text', text: item.text || item.title || '' }),
                h('div', { class: 'mp-pf__post-meta', text: app.name + ' · ' + (item.time || '最近') }),
            ));
        }
    }

    content.appendChild(h('button', { type: 'button', class: 'mp-pf__edit', onclick: () => toast('去「设置」里改名字和头像') }, icon('settings'), '编辑资料'));
    sheet({ title: app.name + ' · 个人主页', content });
}
