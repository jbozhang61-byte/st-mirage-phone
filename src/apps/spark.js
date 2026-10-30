/**
 * 相遇：写一个你想要的人，见几个候选人，然后开始约会。
 */
import { h, icon, avatar, sheet, confirmSheet, toast } from '../render.js';
import { getData, saveNow, upsertPerson, ensureThread, findPerson, appendMessages } from '../store.js';
import { findMatches } from '../ai.js';
import { MAX_DATES, STAGES, VIBES } from '../spark.js';
import { setOneShot, sendAsUserAndGenerate, subscribe } from '../st.js';
import { difficultyOf, sortByDifficulty } from '../difficulty.js';

const TONE_STYLE = {
    warm: 'linear-gradient(150deg, #f6b38a, #b5654f)',
    danger: 'linear-gradient(150deg, #6f5bd8, #2a1d4d)',
    young: 'linear-gradient(150deg, #8fd6c4, #3f8f86)',
    mature: 'linear-gradient(150deg, #9fb0c9, #3f4a5f)',
    mystery: 'linear-gradient(150deg, #7c6a9e, #241f36)',
};

export function mountSpark(host, { nav }) {
    let tab = 'discover';
    let busy = false;
    let index = 0;
    let vibes = [];

    const el = h('div', { class: 'mp-sp' });
    const body = h('div', { class: 'mp-sp__body' });
    const head = h('div', { class: 'mp-sp__head' },
        h('div', { class: 'mp-sp__brand' },
            h('div', { class: 'mp-sp__title', text: '相遇' }),
            h('div', { class: 'mp-sp__sub', text: '写一个你想遇见的人' }),
        ),
        h('div', { class: 'mp-sp__tabs' },
            tabButton('discover', '发现'), tabButton('dates', '约会'),
        ),
    );
    el.append(head, body);
    host.appendChild(el);

    function tabButton(id, label) {
        return h('button', { type: 'button', class: 'mp-sp__tab' + (tab === id ? ' on' : ''), text: label, onclick: () => { tab = id; render(); } });
    }

    function render() {
        [...head.querySelectorAll('.mp-sp__tab')].forEach(button => {
            button.classList.toggle('on', button.textContent === (tab === 'discover' ? '发现' : '约会'));
        });
        const keep = body.scrollTop;
        body.innerHTML = '';
        if (tab === 'discover') renderDiscover();
        else renderDates();
        body.scrollTop = keep;
    }

    /* ------------------------------ 发现 ------------------------------ */

    function renderDiscover() {
        const data = getData();
        // 攻略难度从高到低排
        const candidates = sortByDifficulty(data.spark?.candidates || []);

        // 偏好
        body.appendChild(h('div', { class: 'mp-sp__prompt-card' },
            h('div', { class: 'mp-sp__prompt-label', text: '你想遇见什么样的人？' }),
            h('textarea', {
                class: 'mp-sp__input', rows: '3', id: 'mp_sp_desc',
                placeholder: '例如：住在这座城市里，话不多，但会在下雨天给你送伞的人',
                text: data.spark?.description || '',
            }),
            h('div', { class: 'mp-sp__vibes' }, VIBES.map(vibe => h('button', {
                type: 'button',
                class: 'mp-sp__vibe' + (vibes.includes(vibe.id) ? ' on' : ''),
                text: vibe.label,
                onclick: () => {
                    vibes = vibes.includes(vibe.id) ? vibes.filter(id => id !== vibe.id) : [...vibes, vibe.id];
                    render();
                },
            }))),
            h('button', {
                class: 'mp-sp__go', type: 'button', disabled: busy,
                onclick: () => { if (!busy) search(); },
            }, icon(busy ? 'refresh' : 'sparkle'), h('span', { text: busy ? '正在找…' : '开始匹配' })),
        ));

        if (!candidates.length) {
            body.appendChild(h('div', { class: 'mp-sp__empty' },
                h('div', { class: 'mp-sp__empty-icon' }, icon('heart')),
                h('div', { class: 'mp-sp__empty-title', text: '还没有候选人' }),
                h('div', { class: 'mp-sp__empty-text', text: '写一句你想要的人，或者直接点「开始匹配」。' }),
            ));
            return;
        }

        if (index >= candidates.length) index = 0;
        const person = candidates[index];
        body.appendChild(candidateCard(person, candidates.length));

        body.appendChild(h('div', { class: 'mp-sp__hint', text: '同时最多和 ' + MAX_DATES + ' 个人约会。心动之后，TA 会出现在「消息」里。' }));
    }

    function candidateCard(person, total) {
        return h('div', { class: 'mp-sp__card' },
            h('div', { class: 'mp-sp__portrait', style: { background: TONE_STYLE[person.tone] || TONE_STYLE.warm } },
                h('span', { class: 'mp-sp__blob a' }),
                h('span', { class: 'mp-sp__blob b' }),
                h('span', { class: 'mp-sp__initial', text: (person.name || '?').slice(0, 1) }),
                h('div', { class: 'mp-sp__namebar' },
                    h('div', { class: 'mp-sp__name' }, person.name, person.age ? h('span', { class: 'mp-sp__age', text: person.age + ' 岁' }) : null),
                    h('div', { class: 'mp-sp__job', text: person.job || '' }),
                ),
                h('span', { class: 'mp-sp__count', text: (index + 1) + ' / ' + total }),
            ),
            h('div', { class: 'mp-sp__info' },
                (() => {
                    const diff = difficultyOf(person);
                    return h('div', { class: 'mp-sp__diffrow' },
                        h('span', { class: 'mp-sp__diff is-' + diff.key, text: '攻略难度 · ' + diff.label }),
                        h('div', { class: 'mp-sp__diffbar' }, h('i', { style: { width: diff.score + '%' } })),
                        h('span', { class: 'mp-sp__diffnum', text: diff.score }),
                    );
                })(),
                h('div', { class: 'mp-sp__tags' }, (person.tags || []).map(tag => h('span', { class: 'mp-sp__tag', text: tag }))),
                h('div', { class: 'mp-sp__bio', text: person.bio }),
                person.opening ? h('div', { class: 'mp-sp__opening' },
                    h('span', { class: 'mp-sp__opening-label', text: 'TA 可能会先说' }),
                    h('span', { text: '「' + person.opening + '」' }),
                ) : null,
                h('div', { class: 'mp-sp__actions' },
                    h('button', { type: 'button', class: 'mp-sp__skip', onclick: () => { index += 1; render(); } }, icon('close'), '跳过'),
                    h('button', { type: 'button', class: 'mp-sp__like', onclick: () => like(person) }, icon('heart'), '心动'),
                ),
            ),
        );
    }

    async function search() {
        busy = true;
        const description = document.querySelector('#mp_sp_desc')?.value?.trim() || '';
        const data = getData();
        data.spark = data.spark || { candidates: [], matches: [] };
        data.spark.description = description;
        saveNow('data');
        render();
        try {
            const candidates = await findMatches({ description, vibes });
            data.spark.candidates = candidates;
            index = 0;
            saveNow('data');
            toast('找到了 ' + candidates.length + ' 个人');
        } catch (error) {
            toast('没匹配上，再试一次', 3000);
        } finally {
            busy = false;
            render();
        }
    }

    function like(person) {
        const data = getData();
        const matches = data.spark?.matches || [];
        if (matches.some(match => match.name === person.name)) {
            toast('你们已经匹配过了');
            return;
        }
        if (matches.length >= MAX_DATES) {
            toast('同时最多和 ' + MAX_DATES + ' 个人约会，先去结束一个', 3200);
            return;
        }
        upsertPerson({
            name: person.name,
            role: person.job || '',
            relation: '在「相遇」认识',
            desc: person.bio || '',
            style: '说话方式：' + (person.tags || []).join('、'),
        });
        const thread = ensureThread([person.name], { note: '在「相遇」认识。' + (person.tags || []).join('、') });
        if (thread && person.opening) {
            appendMessages(thread.id, [{ from: 'them', sender: person.name, type: 'text', text: person.opening }], { unread: true });
        }
        data.spark.matches = [...matches, {
            id: 'm' + Date.now().toString(36),
            name: person.name,
            stage: STAGES[0],
            difficulty: difficultyOf(person).score,
            dates: [],
            ts: Date.now(),
        }];
        saveNow('data');
        toast('匹配成功，去「消息」里聊聊吧');
        tab = 'dates';
        render();
    }

    /* ------------------------------ 约会 ------------------------------ */

    function renderDates() {
        const matches = getData().spark?.matches || [];
        if (!matches.length) {
            body.appendChild(h('div', { class: 'mp-sp__empty' },
                h('div', { class: 'mp-sp__empty-icon' }, icon('heart')),
                h('div', { class: 'mp-sp__empty-title', text: '还没有在约会的人' }),
                h('div', { class: 'mp-sp__empty-text', text: '去「发现」里找一个想见的人。' }),
                h('button', { class: 'mp-btn primary', type: 'button', text: '去发现', onclick: () => { tab = 'discover'; render(); } }),
            ));
            return;
        }

        body.appendChild(h('div', { class: 'mp-sp__limit', text: '进行中 ' + matches.length + ' / ' + MAX_DATES + '（同时最多 ' + MAX_DATES + ' 个）' }));
        for (const match of matches) {
            const last = match.dates?.[match.dates.length - 1];
            body.appendChild(h('div', { class: 'mp-sp__match' },
                avatar({ name: match.name, size: 46, cls: 'mp-sp__match-avatar' }),
                h('div', { class: 'mp-sp__match-main' },
                    h('div', { class: 'mp-sp__match-top' },
                        h('span', { class: 'mp-sp__match-name', text: match.name }),
                        h('span', { class: 'mp-sp__stage', text: match.stage }),
                        Number.isFinite(Number(match.difficulty))
                            ? h('span', { class: 'mp-sp__matchdiff is-' + difficultyOf(match).key, text: difficultyOf(match).label })
                            : null,
                    ),
                    h('div', { class: 'mp-sp__match-sub', text: last ? '上次：' + last.title : '还没见过面' }),
                ),
                h('div', { class: 'mp-sp__match-actions' },
                    h('button', { type: 'button', class: 'mp-sp__mini', onclick: () => openChat(match) }, icon('message'), '聊天'),
                    h('button', { type: 'button', class: 'mp-sp__mini accent', onclick: () => date(match) }, icon('sparkle'), '约会'),
                    h('button', { type: 'button', class: 'mp-sp__mini ghost', onclick: () => endMatch(match) }, icon('close')),
                ),
            ));
        }
    }

    function openChat(match) {
        const thread = findThreadByMember(match.name);
        if (thread) nav.go('chat', { threadId: thread.id });
        else {
            const created = ensureThread([match.name], { note: '在「相遇」认识' });
            if (created) nav.go('chat', { threadId: created.id });
        }
    }

    function findThreadByMember(name) {
        return getData().threads.find(thread => thread.members.includes(name)) || null;
    }

    async function date(match) {
        const data = getData();
        const place = data.meta?.city || '旧城';
        const person = findPerson(match.name) || {};
        const input = h('textarea', {
            class: 'mp-input', rows: '4',
            placeholder: '你这次想对' + match.name + '说什么、做什么？',
            text: '我约了' + match.name + '，今天在' + place + '见面。',
        });
        const s = sheet({
            title: '和' + match.name + '的约会',
            content: h('div', { class: 'mp-field-list' },
                h('div', { class: 'mp-sp__hint', text: '这句话会以你的身份发进酒馆聊天，然后由 AI 接着写。' }),
                input,
            ),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '发出去，开始约会',
                onclick: () => {
                    const own = input.value.trim();
                    if (!own) { toast('先写一句你自己的话'); return; }
                    const target = (data.spark.matches || []).find(item => item.id === match.id);
                    if (target) {
                        target.dates = [...(target.dates || []), { id: 'd' + Date.now().toString(36), title: '和' + match.name + '的一次约会', text: own, ts: Date.now() }];
                        const step = Math.min(STAGES.length - 1, Math.floor(target.dates.length / 2) + (target.dates.length >= 1 ? 1 : 0));
                        target.stage = STAGES[Math.min(step, STAGES.length - 1)];
                        saveNow('data');
                    }
                    const profile = [
                        '【这次约会的对象】',
                        match.name + (person.role ? '，' + person.role : '') + '。',
                        person.desc || '',
                        person.relation ? '和我的关系：' + person.relation + '。' : '',
                        person.style ? '说话方式：' + person.style + '。' : '',
                        '写这次约会时，请让这个人的性格、身份和说话方式体现出来，不要只出现一个名字。',
                    ].filter(Boolean).join('\n');
                    setOneShot(profile);
                    let off = null;
                    try {
                        off = subscribe('GENERATION_ENDED', () => { setOneShot(''); off?.(); });
                    } catch { /* ignore */ }
                    s.close();
                    nav.close?.();
                    const ok = sendAsUserAndGenerate(own);
                    toast(ok ? '已发出你的话，正在生成…' : '没能发到酒馆聊天，检查是否打开了聊天', 3200);
                },
            }),
        });
    }

    async function endMatch(match) {
        if (!(await confirmSheet('结束和「' + match.name + '」的约会？聊天记录会留着。', { ok: '结束', danger: true }))) return;
        const data = getData();
        data.spark.matches = (data.spark.matches || []).filter(item => item.id !== match.id);
        saveNow('data');
        render();
    }

    render();
    return { refresh: render };
}