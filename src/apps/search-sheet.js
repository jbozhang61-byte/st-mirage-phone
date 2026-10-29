/** 各内容 App 共用的搜索弹层。 */
import { h, sheet } from '../render.js';

export function openSearchSheet({ title = '搜索', placeholder = '输入关键词', items = [], textOf = () => '', onPick, initial = '' }) {
    const input = h('input', { class: 'mp-input', type: 'text', value: initial, placeholder });
    const list = h('div', { class: 'mp-search-list' });
    const empty = h('div', { class: 'mp-st-hint', text: '' });
    const paint = () => {
        const key = input.value.trim().toLowerCase();
        list.innerHTML = '';
        const matched = key ? items.filter(item => textOf(item).toLowerCase().includes(key)) : items;
        for (const item of matched.slice(0, 40)) {
            const row = h('button', { type: 'button', class: 'mp-search-row', onclick: () => { s.close(); onPick?.(item); } },
                h('b', { text: String(textOf(item)).slice(0, 60) }),
            );
            list.appendChild(row);
        }
        empty.textContent = matched.length ? '' : '没有找到相关内容';
    };
    const s = sheet({
        title,
        content: h('div', { class: 'mp-field-list' }, input, list, empty),
    });
    input.addEventListener('input', paint);
    paint();
    setTimeout(() => input.focus?.(), 120);
    return s;
}
