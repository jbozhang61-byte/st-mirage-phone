/**
 * 备忘录：手写便签，也可以让 AI 把最近的剧情记成一篇日记。
 */
import { h, icon, relativeText, sheet, confirmSheet, toast } from '../render.js';
import { getData, addNote, removeNote, saveNow } from '../store.js';
import { writeDiary, friendlyError } from '../ai.js';

export function mountNotes(host, { nav }) {
    const body = h('div', { class: 'mp-body' });
    const el = h('div', { class: 'mp-conv' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '备忘录', h('small', { text: 'NOTES' })),
            h('div', { class: 'mp-nav__spacer' }),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '记下今天', onclick: () => diary() }, icon('sparkle')),
            h('button', { class: 'mp-nav__btn accent', type: 'button', 'aria-label': '新建', onclick: () => edit(null) }, icon('plus')),
        ),
        body,
    );
    host.appendChild(el);
    let busy = false;
    let keyword = '';

    function render() {
        const data = getData();
        const keep = body.scrollTop;
        body.innerHTML = '';
        if (!data.notes.length) {
            body.appendChild(h('div', { class: 'mp-empty' },
                h('div', { class: 'mp-empty__icon' }, icon('notes')),
                h('div', { class: 'mp-empty__title', text: '还没有留下什么' }),
                h('div', { class: 'mp-empty__text', text: '写一句话，或者让 TA 把今天的事记成日记。' }),
                h('button', { class: 'mp-btn primary', type: 'button', text: busy ? '写着…' : '让 TA 写今天的日记', onclick: () => diary() }),
            ));
            return;
        }
        const search = h('div', { class: 'mp-note-search' }, icon('search'),
            h('input', {
                type: 'text', placeholder: '搜索便签，回车确认', value: keyword,
                onkeydown: event => {
                    if (event.key !== 'Enter') return;
                    keyword = event.target.value.trim();
                    render();
                },
            }),
            keyword ? h('button', { type: 'button', class: 'mp-note-search__clear', text: '清空', onclick: () => { keyword = ''; render(); } }) : null,
        );
        body.appendChild(search);

        const notes = [...data.notes]
            .filter(note => !keyword || note.text.includes(keyword))
            .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.ts - a.ts));
        if (!notes.length && keyword) {
            body.appendChild(h('div', { class: 'mp-empty', style: { paddingTop: '20px' } },
                h('div', { class: 'mp-empty__text', text: '没有找到包含「' + keyword + '」的便签。' })));
            return;
        }
        const grid = h('div', { class: 'mp-notes' });
        for (const note of notes) grid.appendChild(noteCard(note));
        body.appendChild(grid);
        body.scrollTop = keep;
    }

    function noteCard(note) {
        return h('div', { class: 'mp-note' + (note.pinned ? ' is-pinned' : ''), onclick: () => edit(note) },
            h('div', { class: 'mp-note__text', text: note.text }),
            h('div', { class: 'mp-note__time' },
                h('span', { text: relativeText(note.ts) }),
                h('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
                    note.pinned ? h('span', { class: 'mp-note__pin' }, icon('pin')) : null,
                    h('span', {
                        class: 'mp-note__del',
                        onclick: async event => {
                            event.stopPropagation();
                            if (await confirmSheet('删掉这条备忘？', { ok: '删除', danger: true })) { removeNote(note.id); render(); }
                        },
                    }, icon('trash')),
                ),
            ),
        );
    }

    function edit(note) {
        const area = h('textarea', { class: 'mp-input', rows: '6', placeholder: '写点什么…', text: note?.text || '' });
        const pin = h('button', {
            class: 'mp-chip', type: 'button',
            onclick: () => { const on = pin.classList.toggle('on'); pin.dataset.on = on ? '1' : ''; },
        }, icon('pin'), '置顶');
        if (note?.pinned) { pin.classList.add('on'); pin.dataset.on = '1'; }
        const s = sheet({
            title: note ? '编辑备忘' : '新建备忘',
            content: h('div', { class: 'mp-field-list' }, area, h('div', { class: 'mp-chips' }, pin)),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '保存',
                onclick: () => {
                    const text = area.value.trim();
                    if (!text) { s.close(); return; }
                    if (note) { note.text = text; note.pinned = pin.dataset.on === '1'; note.ts = Date.now(); saveNow('data'); }
                    else addNote(text, { pinned: pin.dataset.on === '1' });
                    s.close();
                    render();
                },
            }),
        });
        setTimeout(() => area.focus(), 200);
    }

    async function diary() {
        if (busy) return;
        busy = true;
        toast('正在写今天的日记…');
        try {
            const note = await writeDiary();
            if (note) toast('写好了，在备忘录里');
            render();
        } catch (error) {
            toast(friendlyError(error), 3400);
        } finally {
            busy = false;
        }
    }

    render();
    return { refresh: render };
}