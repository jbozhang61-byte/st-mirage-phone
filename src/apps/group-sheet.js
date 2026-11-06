/**
 * 通用"群设置"面板：群名 / 公告 / 成员增删。
 * 消息、Telegram、Signal、Discord 共用同一套。
 */
import { h, sheet, toast } from '../render.js';
import { getCast } from '../store.js';

export function groupSheet({ title = '群聊设置', name = '', notice = '', members = [], onSave } = {}) {
    let list = [...new Set((members || []).filter(Boolean))];
    const nameInput = h('input', { class: 'mp-input', type: 'text', value: name || '' });
    const noticeInput = h('textarea', { class: 'mp-input', rows: '2', placeholder: '群公告（可留空）' });
    noticeInput.value = notice || '';
    const memberList = h('div', { class: 'mp-group__members' });
    const picker = h('div', { class: 'mp-group__picker' });

    const redraw = () => {
        memberList.innerHTML = '';
        for (const member of list) {
            memberList.appendChild(h('div', { class: 'mp-group__member' },
                h('span', { class: 'mp-group__member-name', text: member }),
                list.length > 1 ? h('button', {
                    type: 'button', class: 'mp-group__kick', text: '移除',
                    onclick: () => {
                        list = list.filter(item => item !== member);
                        redraw();
                    },
                }) : null,
            ));
        }
        picker.innerHTML = '';
        const rest = getCast().map(person => person.name).filter(item => item && !list.includes(item));
        for (const member of rest.slice(0, 12)) {
            picker.appendChild(h('button', {
                type: 'button', class: 'mp-group__pick', text: '+ ' + member,
                onclick: () => {
                    list = [...list, member];
                    redraw();
                },
            }));
        }
        if (!rest.length) picker.appendChild(h('span', { class: 'mp-st-hint', text: '通讯录里的人都已在群里' }));
    };
    redraw();

    return sheet({
        title,
        content: h('div', { class: 'mp-field-list' },
            h('div', { class: 'mp-group__label', text: '群名' }), nameInput,
            h('div', { class: 'mp-group__label', text: '群公告' }), noticeInput,
            h('div', { class: 'mp-group__label', text: '成员（' + list.length + '）' }), memberList,
            h('div', { class: 'mp-group__label', text: '添加成员' }), picker,
        ),
        actions: h('button', {
            class: 'mp-btn primary small', type: 'button', text: '保存',
            onclick: () => {
                try {
                    onSave?.({
                        name: nameInput.value.trim(),
                        notice: noticeInput.value.trim(),
                        members: list.slice(),
                    });
                    toast('已保存');
                } catch (error) {
                    toast('保存失败', 2400);
                }
            },
        }),
    });
}
