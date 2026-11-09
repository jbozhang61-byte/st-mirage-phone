/** 社交 App 的内容配方：六个共用一套引擎。 */
import { extractJson, trim } from './prompts.js';

const ctxText = ({ world, people, user, story }) => [
    world ? '世界：' + world : '',
    people.length ? '人物：' + people.join('、') : '',
    '用户：' + user,
    (story || []).length ? '最近剧情：\n' + story.map(l => (l.isUser ? '用户' : l.name) + '：' + trim(l.text, 120)).join('\n') : '',
].filter(Boolean).join('\n');

const schema = {
    x: '{"posts":[{"author":"名字","handle":"@id","time":"3分钟前","text":"正文","likes":12,"reposts":3,"replies":2}]}',
    instagram: '{"posts":[{"author":"名字","caption":"配文","likes":123,"comments":8,"mood":"warm|cold|night|neon|street"}]}',
    reddit: '{"threads":[{"author":"u/name","sub":"r/板块","title":"标题","text":"正文","votes":123,"comments":45}]}',
    zhihu: '{"questions":[{"title":"问题","author":"提问者","answers":12,"excerpt":"一句回答摘要","votes":340}]}',
    quora: '{"questions":[{"title":"Question","author":"提问者","answers":8,"excerpt":"Answer excerpt","votes":120}]}',
    youtube: '{"videos":[{"author":"频道","title":"标题","views":"12万","duration":"12:30","mood":"warm|cold|night|neon|street"}]}',
};

const prompt = {
    x: '生成 6 条 X / Twitter 动态，像真人在发：短、有情绪、偶尔带话题。',
    instagram: '生成 8 条 Instagram 帖子，配文短，像照片日记。',
    reddit: '生成 6 个 Reddit 帖子，标题像真的，板块名合理。',
    zhihu: '生成 6 个知乎问题和一句回答摘要。',
    quora: '生成 6 个 Quora 问题和一句回答摘要。',
    youtube: '生成 6 个 YouTube 视频，标题有点击欲但不标题党。',
};

const title = { x: 'X', instagram: 'Instagram', reddit: 'Reddit', zhihu: '知乎', quora: 'Quora', youtube: 'YouTube' };

export const SOCIAL = Object.fromEntries(Object.keys(schema).map(id => [id, {
    id,
    name: title[id],
    count: 6,
    system: ctx => ['你在为一个故事世界生成「' + title[id] + '」的内容。', ctxText(ctx), '只输出 JSON：' + schema[id]].join('\n'),
    prompt: () => prompt[id],
    parse: raw => {
        const json = extractJson(raw) || {};
        const list = json.posts || json.threads || json.questions || json.videos || [];
        return list.slice(0, 10).map((item, index) => ({
            id: id + index,
            author: String(item.author || '网友').slice(0, 30),
            handle: String(item.handle || '').slice(0, 24),
            time: String(item.time || '刚刚').slice(0, 16),
            text: String(item.text || item.caption || item.excerpt || item.title || '').slice(0, 500),
            title: String(item.title || item.caption || '').slice(0, 100),
            sub: String(item.sub || '').slice(0, 30),
            answers: Math.max(0, Number(item.answers) || 0),
            votes: Math.max(0, Number(item.votes) || 0),
            likes: Math.max(0, Number(item.likes) || 0),
            comments: Math.max(0, Number(item.comments) || 0),
            reposts: Math.max(0, Number(item.reposts) || 0),
            views: String(item.views || '').slice(0, 12),
            duration: String(item.duration || '').slice(0, 10),
            mood: ['warm', 'cold', 'night', 'neon', 'street'].includes(item.mood) ? item.mood : 'night',
        })).filter(item => item.text || item.title);
    },
    fallback: ctx => {
        const who = ctx.people[0] || '某个网友';
        const base = [
            { author: who, handle: '@' + (ctx.people[0] || 'someone').slice(0, 8), text: '雪停了。门口的灯忘了关，亮了一整夜。', likes: 320, reposts: 12, replies: 8, title: '昨晚的灯', sub: 'r/城市', answers: 3, votes: 45, comments: 6, views: '12万', duration: '03:20', mood: 'cold' },
            { author: '路过的人', handle: '@passerby', text: '今天在旧城走了很久，没有目的地。', likes: 120, reposts: 3, replies: 2, title: '关于旧城的一点事', sub: 'r/提问', answers: 12, votes: 120, comments: 18, views: '3.2万', duration: '08:10', mood: 'street' },
            { author: ctx.people[1] || '另一个网友', handle: '@night', text: '凌晨两点的便利店，关东煮还是热的。', likes: 640, reposts: 22, replies: 14, title: '深夜便利店测评', sub: 'r/美食', answers: 5, votes: 300, comments: 40, views: '21万', duration: '12:30', mood: 'night' },
        ];
        return id === 'instagram' ? base.map(item => ({ ...item, caption: item.text })) : base;
    },
}]));