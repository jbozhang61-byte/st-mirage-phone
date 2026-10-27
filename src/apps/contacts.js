/**
 * 通讯录：这个世界里的人。
 * 手机聊天的对象是角色卡里的人，不是角色卡本身。
 */
import { h, icon, avatar, sheet, confirmSheet, toast } from '../render.js';
import { getData, getCast, upsertPerson, removePerson, ensureThread } from '../store.js';
import { characterAvatar, userName, personaDescription, currentCharacter } from '../st.js';
import { extractCast } from '../ai.js';

export function mountContacts(host, { nav }) {
    const body = h('div', { class: 'mp-body' });
    const el = h('div', { class: 'mp-conv' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '通讯录', h('small', { text: 'CONTACTS' })),
            h('div', { class: 'mp-nav__spacer' }),
            h('button', { class: 'mp-nav__btn accent', type: 'button', 'aria-label': '添加人物', onclick: () => editPerson(null) }, icon('plus')),
        ),
        body,
    );
    host.appendChild(el);

    let keyword = '';
    let busy = false;

    function render() {
        const data = getData();
        const cast = getCast();
        const card = currentCharacter();
        body.innerHTML = '';

        // 当前世界
        body.appendChild(worldCard(card, cast.length));

        body.appendChild(h('div', { class: 'mp-search' }, icon('search'),
            h('input', {
                type: 'text', placeholder: '搜索名字', value: keyword,
                oninput: event => { keyword = event.target.value.trim(); render(); },
            }),
        ));

        if (!cast.length && !keyword) {
            body.appendChild(h('div', { class: 'mp-cast-empty' },
                h('div', { class: 'mp-empty__icon' }, icon('contacts')),
                h('div', { class: 'mp-empty__title', text: card ? '先从这张卡里找人' : '还没有打开角色卡' }),
                h('div', { class: 'mp-empty__text', text: card
                    ? '手机会从《' + card.name + '》里找出你认识的人，然后再和「人」聊天，不是和角色卡聊天。'
                    : '先在酒馆里选一张角色卡，手机会跟着换一个世界。' }),
                card ? h('button', {
                    class: 'mp-btn primary', type: 'button', text: busy ? '正在找…' : '从这张卡里找出人物',
                    onclick: () => extract(card),
                }) : null,
                h('button', { class: 'mp-btn ghost small', type: 'button', text: '自己添加一个人', onclick: () => editPerson(null) }),
            ));
        }

        const shown = cast.filter(person => !keyword
            || person.name.includes(keyword)
            || person.role.includes(keyword)
            || person.relation.includes(keyword));

        if (shown.length) {
            body.appendChild(h('div', { class: 'mp-letter', text: '这个世界里的人 · ' + cast.length }));
            const list = h('div', { class: 'mp-contacts' });
            for (const person of shown) list.appendChild(personRow(person, nav, render));
            body.appendChild(list);
        } else if (cast.length && keyword) {
            body.appendChild(h('div', { class: 'mp-empty', style: { padding: '24px 10px', minHeight: '120px' } },
                h('div', { class: 'mp-empty__text', text: '没有找到这个名字' })));
        }

        const recent = data.threads
            .filter(thread => thread.msgs.length)
            .sort((a, b) => (b.updated || 0) - (a.updated || 0))
            .slice(0, 4);
        if (recent.length && !keyword) {
            body.appendChild(h('div', { class: 'mp-letter', text: '最近联系' }));
            const wrap = h('div', { class: 'mp-contacts' });
            for (const thread of recent) {
                wrap.appendChild(h('div', {
                    class: 'mp-contact',
                    onclick: () => nav.go('chat', { threadId: thread.id }),
                },
                    thread.kind === 'group'
                        ? h('span', { class: 'mp-avatar mp-group-avatar' }, icon('group'))
                        : avatar({ name: thread.members[0], src: '', size: 40 }),
                    h('div', { style: { flex: '1 1 auto', minWidth: '0' } },
                        h('div', { class: 'mp-contact__name', text: thread.name || thread.members.join('、') }),
                        h('div', { class: 'mp-contact__sub', text: thread.kind === 'group' ? thread.members.length + ' 人群聊' : '刚刚聊过' }),
                    ),
                    h('span', { class: 'mp-contact__go' }, icon('chevron')),
                ));
            }
            body.appendChild(wrap);
        }

        // 我的名片
        body.appendChild(h('div', { class: 'mp-me-card' },
            avatar({ name: userName(), src: '', size: 44 }),
            h('div', { class: 'mp-me-card__body' },
                h('div', { class: 'mp-me-card__name', text: userName() }),
                h('div', { class: 'mp-me-card__sig', text: personaDescription().trim().slice(0, 46) || '酒馆里的你' }),
            ),
        ));
        if (!cast.length && keyword) body.appendChild(h('div', { class: 'mp-st-hint', text: '没有这个人。' }));
    }

    function worldCard(card, castCount) {
        const wrap = h('div', { class: 'mp-world' });
        if (!card) {
            wrap.appendChild(h('div', { class: 'mp-world__name', text: '还没有打开角色卡' }));
            wrap.appendChild(h('div', { class: 'mp-world__sub', text: '在酒馆里选一张卡，这里会跟着换世界' }));
            return wrap;
        }
        wrap.append(
            avatar({ name: card.group ? card.name : (card.name || ''), src: card.group ? '' : characterAvatar(card.name), size: 44 }),
            h('div', { class: 'mp-world__body' },
                h('div', { class: 'mp-world__kicker', text: '当前世界' }),
                h('div', { class: 'mp-world__name', text: card.group ? '群聊 · ' + card.name : card.name }),
                h('div', { class: 'mp-world__sub', text: castCount ? castCount + ' 个人在通讯录里' : '还没有人物' }),
            ),
            h('button', {
                class: 'mp-world__action', type: 'button',
                text: busy ? '找人中…' : (castCount ? '重新找人' : '找人物'),
                disabled: busy,
                onclick: () => extract(card),
            }),
        );
        return wrap;
    }

    function personRow(person, navApi, refresh) {
        const row = h('div', {
            class: 'mp-contact',
            onclick: () => {
                const thread = ensureThread([person.name], { note: person.relation || '' });
                if (thread) navApi.go('chat', { threadId: thread.id });
            },
        },
            avatar({ name: person.name, src: '', size: 40 }),
            h('div', { style: { flex: '1 1 auto', minWidth: '0' } },
                h('div', { class: 'mp-contact__name' }, person.name,
                    person.role ? h('span', { class: 'mp-contact__role', text: person.role }) : null),
                h('div', { class: 'mp-contact__sub', text: person.relation || person.desc || '这个世界里的人' }),
            ),
            h('span', { class: 'mp-contact__go' }, icon('chevron')),
        );
        let pressTimer = 0;
        row.addEventListener('contextmenu', event => { event.preventDefault(); personMenu(person, refresh); });
        row.addEventListener('pointerdown', () => { pressTimer = setTimeout(() => personMenu(person, refresh), 600); });
        row.addEventListener('pointerup', () => clearTimeout(pressTimer));
        row.addEventListener('pointerleave', () => clearTimeout(pressTimer));
        return row;
    }

    function personMenu(person, refresh) {
        const s = sheet({ title: person.name, content: h('div', { class: 'mp-field-list' },
            h('div', { class: 'mp-chips' },
                h('button', { class: 'mp-chip', type: 'button', onclick: () => { s.close(); editPerson(person); } }, icon('edit'), '编辑'),
                h('button', {
                    class: 'mp-chip', type: 'button',
                    onclick: async () => {
                        s.close();
                        if (await confirmSheet('从通讯录移除「' + person.name + '」？聊天记录会留着。', { ok: '移除', danger: true })) {
                            removePerson(person.name);
                            refresh();
                        }
                    },
                }, icon('trash'), '移除'),
            ),
        ) });
    }

    async function extract(card) {
        if (busy) return;
        busy = true;
        render();
        try {
            const cast = await extractCast();
            toast('从《' + (card?.name || '角色卡') + '》里找到 ' + cast.length + ' 个人');
            nav.refreshAll?.();
        } catch (error) {
            toast(error?.message || '没找出人来', 3200);
        } finally {
            busy = false;
            render();
        }
    }

    function editPerson(person) {
        const name = h('input', { class: 'mp-input', type: 'text', value: person?.name || '', placeholder: '名字' });
        const role = h('input', { class: 'mp-input', type: 'text', value: person?.role || '', placeholder: '身份，例如：修表匠' });
        const relation = h('input', { class: 'mp-input', type: 'text', value: person?.relation || '', placeholder: '和你的关系' });
        const desc = h('textarea', { class: 'mp-input', rows: '3', placeholder: '一两句人设' });
        desc.value = person?.desc || '';
        const style = h('input', { class: 'mp-input', type: 'text', value: person?.style || '', placeholder: '说话方式' });
        const s = sheet({
            title: person ? '编辑人物' : '添加人物',
            content: h('div', { class: 'mp-field-list' },
                h('div', {}, h('label', { text: '名字' }), name),
                h('div', {}, h('label', { text: '身份' }), role),
                h('div', {}, h('label', { text: '关系' }), relation),
                h('div', {}, h('label', { text: '人设' }), desc),
                h('div', {}, h('label', { text: '说话方式' }), style),
            ),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '保存',
                onclick: () => {
                    const value = name.value.trim();
                    if (!value) { toast('先给 TA 起个名字'); return; }
                    upsertPerson({
                        name: value,
                        role: role.value.trim(),
                        relation: relation.value.trim(),
                        desc: desc.value.trim(),
                        style: style.value.trim(),
                    });
                    s.close();
                    render();
                },
            }),
        });
        setTimeout(() => name.focus(), 200);
    }

    render();
    return { refresh: render };
}
