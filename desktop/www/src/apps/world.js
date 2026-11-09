/** 世界：这个世界的样子、大小、规则、势力与地点，可自己改。 */
import { h, icon, sheet, toast } from '../render.js';
import { getData, saveNow } from '../store.js';
import { currentCharacter, worldBookEntries, generateText } from '../st.js';
import { extractJson } from '../prompts.js';
import { friendlyError } from '../ai.js';

const EMPTY = {
    name: '', type: '', scale: '', era: '', rules: '', factions: [], places: [], notes: '',
};

export function mountWorld(host, { nav }) {
    const body = h('div', { class: 'mp-worldapp__body' });
    const el = h('div', { class: 'mp-worldapp' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '世界', h('small', { text: 'WORLD' })),
            h('button', { class: 'mp-nav__btn accent', type: 'button', 'aria-label': '编辑世界', onclick: () => edit() }, icon('edit')),
        ),
        body,
    );
    host.appendChild(el);

    function info() {
        const data = getData();
        if (!data.worldInfo || typeof data.worldInfo !== 'object') {
            data.worldInfo = { ...EMPTY, name: data.meta?.city || '', type: '', scale: '', era: '', rules: '', factions: [], places: [], notes: '' };
        }
        return data.worldInfo;
    }

    function render() {
        const world = info();
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'mp-worldapp__hero' },
            h('span', { class: 'mp-worldapp__globe' }, icon('globe')),
            h('div', { class: 'mp-worldapp__id' },
                h('div', { class: 'mp-worldapp__name', text: world.name || '还没有名字' }),
                h('div', { class: 'mp-worldapp__sub', text: [world.type, world.scale, world.era].filter(Boolean).join(' · ') || '点右上角写下这个世界的样子' }),
            ),
        ));
        const rows = [
            ['类型', world.type],
            ['范围', world.scale],
            ['时代', world.era],
            ['规则', world.rules],
            ['补充', world.notes],
        ].filter(([, value]) => value);
        for (const [label, value] of rows) {
            body.appendChild(h('div', { class: 'mp-worldapp__row' }, h('span', { text: label }), h('div', { text: value })));
        }
        if (world.factions?.length) body.appendChild(section('主要势力', world.factions));
        if (world.places?.length) body.appendChild(section('主要地点', world.places));
        if (!rows.length && !world.factions?.length && !world.places?.length) {
            body.appendChild(h('div', { class: 'mp-st-hint', text: '写清楚世界有多大、是什么时代、有什么规则，酒馆生成时会参考。' }));
        }
        body.appendChild(h('div', { class: 'mp-heart__note', text: '只用于酒馆生成时参考，不会写进正文。' }));
    }

    function section(title, list) {
        return h('div', { class: 'mp-worldapp__section' },
            h('div', { class: 'mp-heart__label', text: title }),
            h('div', { class: 'mp-heart__chips' }, ...list.map(item => h('span', { class: 'mp-worldapp__chip', text: item }))),
        );
    }

    function edit() {
        const world = info();
        const name = h('input', { class: 'mp-input', type: 'text', value: world.name || '', placeholder: '世界的名字' });
        const type = h('input', { class: 'mp-input', type: 'text', value: world.type || '', placeholder: '现代都市 / 奇幻 / 末日 / 校园…' });
        const scale = h('input', { class: 'mp-input', type: 'text', value: world.scale || '', placeholder: '一座城 / 一个国家 / 一整块大陆 / 多个世界' });
        const era = h('input', { class: 'mp-input', type: 'text', value: world.era || '', placeholder: '时代与科技水平' });
        const rules = h('textarea', { class: 'mp-input', rows: '3', placeholder: '这个世界有什么规则、超自然现象、不能做的事' });
        rules.value = world.rules || '';
        const factions = h('input', { class: 'mp-input', type: 'text', value: (world.factions || []).join('、'), placeholder: '用顿号或逗号分隔' });
        const places = h('input', { class: 'mp-input', type: 'text', value: (world.places || []).join('、'), placeholder: '用顿号或逗号分隔' });
        const notes = h('textarea', { class: 'mp-input', rows: '3', placeholder: '其他想补充的世界设定' });
        notes.value = world.notes || '';
        const split = value => String(value || '').split(/[、,，\s]+/).map(item => item.trim()).filter(Boolean).slice(0, 20);
        const readBtn = h('button', { type: 'button', class: 'mp-btn ghost small', text: 'AI 读取世界书' });
        readBtn.addEventListener('click', () => aiFill({ name, type, scale, era, rules, factions, places, notes }, readBtn));
        const dialog = sheet({
            title: '编辑世界',
            content: h('div', { class: 'mp-field-list' },
                h('div', { class: 'mp-worldapp__aifill' },
                    readBtn,
                    h('span', { class: 'mp-st-hint', text: '读角色卡绑定的世界书和内嵌条目，只填资料里写过的，不编造。' })),
                h('div', {}, h('label', { text: '名字' }), name),
                h('div', {}, h('label', { text: '类型' }), type),
                h('div', {}, h('label', { text: '范围 / 大小' }), scale),
                h('div', {}, h('label', { text: '时代' }), era),
                h('div', {}, h('label', { text: '规则' }), rules),
                h('div', {}, h('label', { text: '势力' }), factions),
                h('div', {}, h('label', { text: '地点' }), places),
                h('div', {}, h('label', { text: '补充' }), notes),
            ),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '保存',
                onclick: () => {
                    const data = getData();
                    data.worldInfo = {
                        name: name.value.trim().slice(0, 40),
                        type: type.value.trim().slice(0, 60),
                        scale: scale.value.trim().slice(0, 60),
                        era: era.value.trim().slice(0, 60),
                        rules: rules.value.trim().slice(0, 400),
                        factions: split(factions.value),
                        places: split(places.value),
                        notes: notes.value.trim().slice(0, 400),
                    };
                    saveNow('data');
                    if (data.worldInfo.name) data.meta.city = data.meta.city || data.worldInfo.name;
                    dialog.close();
                    render();
                    toast('世界已更新');
                },
            }),
        });
    }

    /** 让模型读世界书，把空着的字段自动填上（只填资料里有的）。 */
    async function aiFill(fields, button) {
        if (button.dataset.busy === '1') return;
        button.dataset.busy = '1';
        const label = button.textContent;
        button.textContent = '读取中…';
        try {
            const book = await worldBookEntries(50);
            const card = currentCharacter();
            const parts = [];
            if (card) {
                parts.push('角色卡《' + card.name + '》\n' + String(card.description || '').slice(0, 1500)
                    + (card.scenario ? '\n场景：' + String(card.scenario).slice(0, 600) : ''));
            }
            if (book.length) parts.push('世界书条目：\n' + book.map(entry => '【' + entry.title + '】' + entry.content).join('\n'));
            if (!parts.length) { toast('没读到世界书，也没读到角色卡设定'); return; }
            const raw = await generateText({
                system: '你在整理一段故事世界的设定。只抽取资料里已经写明的内容，不要编造；没有的字段给空字符串或空数组。用中文。只输出 JSON。',
                prompt: [
                    parts.join('\n\n'),
                    '整理成这个 JSON：',
                    '{"name":"世界名字","type":"类型，例如 现代都市/奇幻/末日/校园","scale":"范围","era":"时代与科技水平","rules":"资料里明确写过的规则，两三句","factions":["势力"],"places":["地点"],"notes":"补充"}',
                ].join('\n'),
                length: 800,
                json: true,
            });
            const json = extractJson(raw) || {};
            const setValue = (input, value) => {
                const text = Array.isArray(value) ? value.join('、') : String(value || '');
                if (text.trim()) input.value = text.slice(0, 400);
            };
            setValue(fields.name, json.name);
            setValue(fields.type, json.type);
            setValue(fields.scale, json.scale);
            setValue(fields.era, json.era);
            setValue(fields.rules, json.rules);
            setValue(fields.factions, json.factions);
            setValue(fields.places, json.places);
            setValue(fields.notes, json.notes);
            toast('读到 ' + book.length + ' 条世界书，检查一下再保存');
        } catch (error) {
            toast(friendlyError(error), 3200);
        } finally {
            button.dataset.busy = '';
            button.textContent = label;
        }
    }

    if (!currentCharacter()) toast('先打开一张角色卡，世界才有默认名字');
    render();
    return { refresh: render };
}
