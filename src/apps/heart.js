/** 心：主要人物的关系、亲密偏好、穿着与边界。 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { getCast, getFeed, setFeed } from '../store.js';
import { generateText, importantStoryContext, currentCharacter, personaDescription, userName } from '../st.js';
import { extractJson } from '../prompts.js';

const STAGES = ['陌生', '认识', '互有好感', '暧昧', '恋人', '伴侣'];

function seedFor(person, index) {
    const text = [person.name, person.role, person.relation, person.desc, person.style].join('|');
    let hash = 0;
    for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const stage = STAGES[Math.min(STAGES.length - 1, 1 + (hash % 4))];
    const likes = ['拥抱', '接吻', '深吻', '牵手', '靠肩', '摸头', '耳语', '轻咬', '抚摸', '贴着睡'];
    const sensitive = ['耳后', '颈侧', '锁骨', '胸口', '腰侧', '小腹', '大腿内侧', '私处', '后背', '膝盖'];
    return {
        name: person.name,
        stage,
        affection: 35 + (hash % 60),
        summary: person.desc || person.relation || '在这个世界和你认识的人。',
        likes: ['互有好感', '暧昧', '恋人', '伴侣'].includes(stage)
            ? ['深吻', '抚摸', likes[hash % likes.length], likes[(hash + 2) % likes.length]]
            : [likes[hash % likes.length], likes[(hash + 2) % likes.length], likes[(hash + 4) % likes.length]],
        sensitive: ['互有好感', '暧昧', '恋人', '伴侣'].includes(stage)
            ? ['私处', '大腿内侧', sensitive[hash % sensitive.length], sensitive[(hash + 3) % sensitive.length]]
            : [sensitive[hash % sensitive.length], sensitive[(hash + 3) % sensitive.length], sensitive[(hash + 6) % sensitive.length]],
        outfit: {
            top: ['旧夹克', '针织衫', '深色衬衫', '长外套'][hash % 4],
            bottom: ['深色长裤', '半身裙', '牛仔裤', '工装裤'][(hash >> 1) % 4],
            underwearTop: ['白色棉质内衣', '黑色无痕内衣', '浅灰运动内衣'][(hash >> 2) % 3],
            underwearBottom: ['白色棉质内裤', '黑色无痕内裤', '浅灰平角内裤'][(hash >> 3) % 3],
            stockings: ['没有穿', '黑色连裤袜', '深灰短袜', '白色中筒袜'][(hash >> 4) % 4],
            shoes: ['旧皮靴', '白色运动鞋', '黑色乐福鞋', '帆布鞋'][(hash >> 5) % 4],
            accessories: ['没有特别的', '一条细链', '旧手表', '耳钉'][(hash >> 6) % 4],
        },
        style: ['干净、简单', '偏冷色', '舒服好动', '有点旧但合身'][(hash >> 2) % 4],
        custom: [],
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
    let selfMode = false;

    const OUTFIT_FIELDS = [
        ['top', '上衣'], ['bottom', '下装'], ['underwearTop', '内衣'],
        ['underwearBottom', '内裤'], ['stockings', '丝袜'], ['shoes', '鞋子'], ['accessories', '配饰'],
    ];

    function normalizeOutfit(outfit, fallback) {
        if (outfit && typeof outfit === 'object') {
            const merged = {};
            for (const [key] of OUTFIT_FIELDS) merged[key] = String(outfit[key] || fallback.outfit[key] || '').slice(0, 40);
            return merged;
        }
        if (typeof outfit === 'string' && outfit.trim()) {
            return { ...fallback.outfit, top: outfit.trim().slice(0, 40) };
        }
        return { ...fallback.outfit };
    }

    function load() {
        const cached = getFeed('heart')?.items;
        const cast = getCast();
        return cast.map((person, i) => {
            const seed = seedFor(person, i);
            const item = cached?.find(entry => entry.name === person.name);
            if (!item) return seed;
            return { ...seed, ...item, outfit: normalizeOutfit(item.outfit, seed), custom: Array.isArray(item.custom) ? item.custom : [] };
        });
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
        picker.appendChild(h('button', {
            type: 'button', class: 'mp-heart__pick' + (selfMode ? ' on' : ''),
            onclick: () => { selfMode = true; render(); },
        }, avatar({ name: userName() || '我', size: 42 }), h('span', { text: '我' })));
        people.forEach((person, index) => {
            picker.appendChild(h('button', {
                type: 'button', class: 'mp-heart__pick' + (!selfMode && index === selected ? ' on' : ''),
                onclick: () => { selected = index; selfMode = false; render(); },
            }, avatar({ name: person.name, size: 42 }), h('span', { text: person.name })));
        });
        body.appendChild(picker);

        if (selfMode) {
            renderSelf();
            return;
        }

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
        const wearRows = OUTFIT_FIELDS
            .filter(([key]) => person.outfit?.[key])
            .map(([key, label]) => h('div', { class: 'mp-heart__wear' },
                h('span', { class: 'mp-heart__wearlabel', text: label }),
                h('b', { text: person.outfit[key] }),
            ));
        wearRows.push(h('div', { class: 'mp-heart__wear is-style' }, icon('star'), h('div', {}, h('b', { text: person.style || '还没有记' }), h('span', { text: '喜欢的风格' }))));
        body.appendChild(section('今天穿着', wearRows, true));
        const custom = Array.isArray(person.custom) ? person.custom : [];
        const customChips = custom.map(tag => h('span', { class: 'mp-heart__chip is-custom' },
            tag,
            h('button', { type: 'button', class: 'mp-heart__chipdel', 'aria-label': '删除', onclick: event => { event.stopPropagation(); removeCustom(people, person, tag); } }, '×'),
        ));
        customChips.push(h('button', { type: 'button', class: 'mp-heart__chip is-add', onclick: () => addCustom(people, person) }, '+ 自定义'));
        body.appendChild(section('自定义标签', customChips));
        if (person.boundaries?.length) body.appendChild(section('边界', person.boundaries.map(item => chip(item, 'lock'))));
        body.appendChild(h('div', { class: 'mp-heart__note', text: '角色均为成年人；这里只记录双方自愿的部分，不舒服就直接说。' }));
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

    function selfProfile() {
        const data = getData();
        if (!data.heartSelf || typeof data.heartSelf !== 'object') {
            data.heartSelf = {
                appearance: '', personality: personaDescription().trim().slice(0, 300),
                body: '', family: '', likes: [], dislikes: [], custom: [],
            };
        }
        return data.heartSelf;
    }

    function renderSelf() {
        const me = selfProfile();
        const edit = h('button', { type: 'button', class: 'mp-heart__edit', onclick: () => editSelf() }, icon('edit'), '编辑');
        body.appendChild(h('div', { class: 'mp-heart__card' },
            h('div', { class: 'mp-heart__top' },
                avatar({ name: userName() || '我', size: 56 }),
                h('div', { class: 'mp-heart__id' },
                    h('div', { class: 'mp-heart__name' }, userName() || '我', h('span', { class: 'mp-heart__stage', text: '我自己' })),
                    h('div', { class: 'mp-heart__summary', text: me.personality || '在酒馆人设里写下你自己。' }),
                ),
            ),
            h('div', { class: 'mp-heart__selfedit' }, edit),
        ));
        const lines = [
            ['颜值', me.appearance],
            ['性格', me.personality],
            ['身体', me.body],
            ['家世', me.family],
        ].filter(([, value]) => value);
        for (const [label, value] of lines) {
            body.appendChild(h('div', { class: 'mp-heart__selfrow' }, h('span', { text: label }), h('div', { text: value })));
        }
        for (const [label, list] of [['喜爱', me.likes], ['厌恶', me.dislikes], ['自定义', me.custom]]) {
            if (!Array.isArray(list) || !list.length) continue;
            body.appendChild(section(label, list.map(item => chip(item, label === '厌恶' ? 'lock' : 'heart'))));
        }
        if (!lines.length && !me.likes?.length) {
            body.appendChild(h('div', { class: 'mp-st-hint', text: '点「编辑」写下你的样子、性格、身体、家世和喜恶。' }));
        }
        body.appendChild(h('div', { class: 'mp-heart__note', text: '这部分只用于酒馆生成时参考，不会写进正文。' }));
    }

    function editSelf() {
        const me = selfProfile();
        const appearance = h('input', { class: 'mp-input', type: 'text', value: me.appearance || '', placeholder: '例如：清秀、偏冷、笑起来很软' });
        const personality = h('textarea', { class: 'mp-input', rows: '3', placeholder: '性格、说话方式' });
        personality.value = me.personality || '';
        const bodyText = h('textarea', { class: 'mp-input', rows: '2', placeholder: '身高、体型、身上的特征' });
        bodyText.value = me.body || '';
        const family = h('input', { class: 'mp-input', type: 'text', value: me.family || '', placeholder: '家世、住在哪里、做什么' });
        const likes = h('input', { class: 'mp-input', type: 'text', value: (me.likes || []).join('、'), placeholder: '用顿号或逗号分隔' });
        const dislikes = h('input', { class: 'mp-input', type: 'text', value: (me.dislikes || []).join('、'), placeholder: '用顿号或逗号分隔' });
        const custom = h('input', { class: 'mp-input', type: 'text', value: (me.custom || []).join('、'), placeholder: '自定义标签' });
        const split = value => String(value || '').split(/[、,，\s]+/).map(item => item.trim()).filter(Boolean).slice(0, 12);
        const dialog = sheet({
            title: '编辑我自己',
            content: h('div', { class: 'mp-field-list' },
                h('div', {}, h('label', { text: '颜值' }), appearance),
                h('div', {}, h('label', { text: '性格' }), personality),
                h('div', {}, h('label', { text: '身体' }), bodyText),
                h('div', {}, h('label', { text: '家世' }), family),
                h('div', {}, h('label', { text: '喜爱' }), likes),
                h('div', {}, h('label', { text: '厌恶' }), dislikes),
                h('div', {}, h('label', { text: '自定义' }), custom),
            ),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '保存',
                onclick: () => {
                    const data = getData();
                    data.heartSelf = {
                        appearance: appearance.value.trim().slice(0, 80),
                        personality: personality.value.trim().slice(0, 300),
                        body: bodyText.value.trim().slice(0, 200),
                        family: family.value.trim().slice(0, 120),
                        likes: split(likes.value), dislikes: split(dislikes.value), custom: split(custom.value),
                    };
                    saveNow('data');
                    dialog.close();
                    render();
                },
            }),
        });
    }

    function persistProfiles(people) {
        setFeed('heart', people.map(person => ({ ...person })));
    }

    function addCustom(people, person) {
        const input = h('input', { class: 'mp-input', type: 'text', placeholder: '例如：怕痒 / 喜欢被夸 / 锁骨' });
        const dialog = sheet({
            title: '添加自定义标签',
            content: h('div', { class: 'mp-field-list' }, input),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '添加',
                onclick: () => {
                    const value = input.value.trim();
                    if (!value) return;
                    person.custom = [...new Set([...(person.custom || []), value.slice(0, 20)])];
                    persistProfiles(people);
                    dialog.close();
                    render();
                },
            }),
        });
    }

    function removeCustom(people, person, tag) {
        person.custom = (person.custom || []).filter(item => item !== tag);
        persistProfiles(people);
        render();
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
            const previous = getFeed('heart')?.items || [];
            setFeed('heart', people.map(item => ({
                name: String(item.name || '').slice(0, 30),
                stage: String(item.stage || '认识').slice(0, 12),
                affection: Math.max(0, Math.min(100, Number(item.affection) || 50)),
                summary: String(item.summary || '').slice(0, 120),
                likes: (Array.isArray(item.likes) ? item.likes : []).slice(0, 8).map(x => String(x).slice(0, 12)),
                sensitive: (Array.isArray(item.sensitive) ? item.sensitive : []).slice(0, 8).map(x => String(x).slice(0, 12)),
                outfit: (item.outfit && typeof item.outfit === 'object') ? {
                    top: String(item.outfit.top || '').slice(0, 40),
                    bottom: String(item.outfit.bottom || '').slice(0, 40),
                    underwearTop: String(item.outfit.underwearTop || '').slice(0, 40),
                    underwearBottom: String(item.outfit.underwearBottom || '').slice(0, 40),
                    stockings: String(item.outfit.stockings || '').slice(0, 40),
                    shoes: String(item.outfit.shoes || '').slice(0, 40),
                    accessories: String(item.outfit.accessories || '').slice(0, 40),
                } : { top: String(item.outfit || '').slice(0, 40) },
                style: String(item.style || '').slice(0, 40),
                boundaries: (Array.isArray(item.boundaries) ? item.boundaries : []).slice(0, 4).map(x => String(x).slice(0, 30)),
                custom: previous.find(old => old.name === item.name)?.custom || [],
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