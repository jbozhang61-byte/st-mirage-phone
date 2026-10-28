/** 心：主要人物的关系、亲密偏好、穿着与边界。 */
import { h, icon, avatar, toast } from '../render.js';
import { getCast, getFeed, setFeed } from '../store.js';
import { generateText, importantStoryContext, currentCharacter, userName } from '../st.js';
import { extractJson } from '../prompts.js';

const STAGES = ['陌生', '认识', '互有好感', '暧昧', '恋人', '伴侣'];

function seedFor(person, index) {
    const text = [person.name, person.role, person.relation, person.desc, person.style].join('|');
    let hash = 0;
    for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const stage = STAGES[Math.min(STAGES.length - 1, 1 + (hash % 4))];
    const likes = ['拥抱', '接吻', '牵手', '靠肩', '摸头', '耳语'];
    const sensitive = ['耳后', '颈侧', '手腕', '腰侧', '后背', '膝盖'];
    return {
        name: person.name,
        stage,
        affection: 35 + (hash % 60),
        summary: person.desc || person.relation || '在这个世界和你认识的人。',
        likes: [likes[hash % likes.length], likes[(hash + 2) % likes.length]],
        sensitive: [sensitive[hash % sensitive.length], sensitive[(hash + 3) % sensitive.length]],
        outfit: ['旧夹克', '针织衫', '深色衬衫', '长外套'][hash % 4],
        style: ['干净、简单', '偏冷色', '舒服好动', '有点旧但合身'][(hash >> 2) % 4],
        boundaries: ['不喜欢被突然碰', '不喜欢当众亲密'],
    };
}

export function mountHeart(host, { nav }) {
    const body = h('div', { class: 'mp-heart__body' });
    const el = h('div', { class: 'mp-heart' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '心', h('small', { text: 'HEART' })),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '重新感受', onclick: () => refresh() }, icon('refresh')),
        ),
        body,
    );
    host.appendChild(el);
    let selected = 0;
    let busy = false;

    function load() {
        const cached = getFeed('heart')?.items;
        const cast = getCast();
        if (cached?.length) {
            return cast.map((person, i) => cached.find(item => item.name === person.name) || seedFor(person, i));
        }
        return cast.map(seedFor);
    }

    function render() {
        const people = load();
        body.innerHTML = '';
        if (!people.length) {
            body.appendChild(h('div', { class: 'mp-empty' },
                h('div', { class: 'mp-empty__icon' }, icon('heart')),
                h('div', { class: 'mp-empty__title', text: '还没有可以放进心里的人' }),
                h('div', { class: 'mp-empty__text', text: '先去通讯录「找人物」，再回来。' }),
                h('button', { class: 'mp-btn primary', type: 'button', text: '去通讯录', onclick: () => nav.go('contacts') }),
            ));
            return;
        }
        if (selected >= people.length) selected = 0;
        const picker = h('div', { class: 'mp-heart__picker' });
        people.forEach((person, index) => {
            picker.appendChild(h('button', {
                type: 'button', class: 'mp-heart__pick' + (index === selected ? ' on' : ''),
                onclick: () => { selected = index; render(); },
            }, avatar({ name: person.name, size: 42 }), h('span', { text: person.name })));
        });
        body.appendChild(picker);

        const person = people[selected];
        const pct = Math.max(0, Math.min(100, Number(person.affection) || 0));
        body.appendChild(h('div', { class: 'mp-heart__card' },
            h('div', { class: 'mp-heart__top' },
                avatar({ name: person.name, size: 56 }),
                h('div', { class: 'mp-heart__id' },
                    h('div', { class: 'mp-heart__name' }, person.name, h('span', { class: 'mp-heart__stage', text: person.stage || '认识' })),
                    h('div', { class: 'mp-heart__summary', text: person.summary || '' }),
                ),
            ),
            h('div', { class: 'mp-heart__meter' },
                h('div', { class: 'mp-heart__meterhead' }, h('span', { text: '好感' }), h('b', { text: pct + '%' })),
                h('div', { class: 'mp-heart__bar' }, h('i', { style: { width: pct + '%' } })),
            ),
        ));

        body.appendChild(section('喜欢怎样靠近', (person.likes || []).map(item => chip(item, 'heart'))));
        body.appendChild(section('敏感的地方', (person.sensitive || []).map(item => chip(item, 'sparkle'))));
        body.appendChild(section('今天穿着', [
            h('div', { class: 'mp-heart__wear' }, icon('user'), h('div', {}, h('b', { text: person.outfit || '还没有记' }), h('span', { text: '现在身上' }))),
            h('div', { class: 'mp-heart__wear' }, icon('star'), h('div', {}, h('b', { text: person.style || '还没有记' }), h('span', { text: '喜欢的风格' }))),
        ], true));
        if (person.boundaries?.length) body.appendChild(section('边界', person.boundaries.map(item => chip(item, 'lock'))));
        body.appendChild(h('div', { class: 'mp-heart__note', text: '这里只记录双方都愿意的部分；不舒服就直接说。' }));
    }

    function section(title, children, plain = false) {
        return h('div', { class: 'mp-heart__section' },
            h('div', { class: 'mp-heart__label', text: title }),
            h('div', { class: plain ? 'mp-heart__list' : 'mp-heart__chips' }, ...children),
        );
    }

    function chip(text, iconName) {
        return h('span', { class: 'mp-heart__chip' + (iconName === 'lock' ? ' is-boundary' : '') }, icon(iconName), text);
    }

    async function refresh() {
        if (busy) return;
        const cast = getCast();
        if (!cast.length) { toast('通讯录里还没有人'); return; }
        busy = true;
        toast('正在重新感受…');
        try {
            const story = importantStoryContext(24, 420).map(line => (line.isUser ? userName() : line.name) + '：' + line.text).join('\n');
            const list = cast.map(person => '- ' + person.name + '：' + [person.role, person.relation, person.desc].filter(Boolean).join(' / ')).join('\n');
            const raw = await generateText({
                system: '你在整理一段故事里主要人物和用户的关系与亲密偏好。只输出 JSON，克制、不写露骨内容。',
                prompt: '当前聊天：\n' + story + '\n\n人物：\n' + list +
                    '\n\n只输出：{"people":[{"name":"名字","stage":"陌生/认识/互有好感/暧昧/恋人/伴侣","affection":0-100,"summary":"一句关系说明","likes":["拥抱","接吻","牵手"],"sensitive":["耳后","颈侧"],"outfit":"当前穿着","style":"喜欢的穿着风格","boundaries":["不喜欢的事"]}]}',
                length: 1800,
                json: true,
            });
            const json = extractJson(raw);
            const people = Array.isArray(json?.people) ? json.people : [];
            if (!people.length) throw new Error('这次没有读出来');
            setFeed('heart', people.map(item => ({
                name: String(item.name || '').slice(0, 30),
                stage: String(item.stage || '认识').slice(0, 12),
                affection: Math.max(0, Math.min(100, Number(item.affection) || 50)),
                summary: String(item.summary || '').slice(0, 120),
                likes: (Array.isArray(item.likes) ? item.likes : []).slice(0, 6).map(x => String(x).slice(0, 12)),
                sensitive: (Array.isArray(item.sensitive) ? item.sensitive : []).slice(0, 6).map(x => String(x).slice(0, 12)),
                outfit: String(item.outfit || '').slice(0, 40),
                style: String(item.style || '').slice(0, 40),
                boundaries: (Array.isArray(item.boundaries) ? item.boundaries : []).slice(0, 4).map(x => String(x).slice(0, 30)),
            })).filter(item => item.name));
            render();
            toast('更新好了');
        } catch (error) {
            toast(error?.message || '这次没感受到', 3000);
        } finally {
            busy = false;
        }
    }

    render();
    return { refresh: render };
}
