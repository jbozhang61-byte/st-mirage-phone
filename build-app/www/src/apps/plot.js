/**
 * 启程：剧情推进。
 * 选一个基调，摇一个能直接写下去的下一步。
 */
import { h, icon, sheet, toast } from '../render.js';
import { getData, saveNow } from '../store.js';
import { advancePlot } from '../ai.js';
import { TONES, toneOf, plotFallback } from '../plot.js';
import { currentCharacter, storyContext, setOneShot, sendAsUserAndGenerate, subscribe } from '../st.js';
import { uid } from '../state.js';

export function mountPlot(host, { nav }) {
    let tone = 'intense';
    let busy = false;
    let inputEl = null;
    let result = getData().plot?.history?.[0] || null;

    const el = h('div', { class: 'mp-plot' });
    const body = h('div', { class: 'mp-plot__body' });
    const head = h('div', { class: 'mp-plot__head' },
        h('div', { class: 'mp-plot__title', text: '启程' }),
        h('div', { class: 'mp-plot__sub', text: '不知道接下来怎么走的时候，摇一次。' }),
        h('button', { class: 'mp-plot__history', type: 'button', 'aria-label': '历史', onclick: () => openHistory() }, icon('clock')),
    );
    el.append(head, body);
    host.appendChild(el);

    function sendToStory(text, toneId) {
        const own = String(text || '').trim();
        if (!own) { toast('先写一句你想怎么推进'); return; }
        const t = toneOf(toneId || tone);
        setOneShot('【这一段的基调】' + t.name + '：' + t.hint + '\n按这个方向写，但不要改变酒馆原本的输出格式。');
        let off = null;
        try { off = subscribe('GENERATION_ENDED', () => { setOneShot(''); off?.(); }); } catch { /* ignore */ }
        nav.close?.();
        const ok = sendAsUserAndGenerate(own);
        toast(ok ? '已发进酒馆，正在生成…' : '没能发进酒馆，检查是否打开了聊天', 3200);
    }

    function render() {
        const data = getData();
        const keep = body.scrollTop;
        body.innerHTML = '';

        // 基调
        const grid = h('div', { class: 'mp-plot__tones' });
        for (const item of TONES) {
            grid.appendChild(h('button', {
                type: 'button',
                class: 'mp-plot__tone' + (tone === item.id ? ' on' : ''),
                style: { '--tone': item.color },
                onclick: () => { tone = item.id; render(); },
            },
                h('span', { class: 'mp-plot__tone-icon' }, icon(item.icon)),
                h('span', { class: 'mp-plot__tone-name', text: item.name }),
                h('span', { class: 'mp-plot__tone-desc', text: item.desc }),
            ));
        }
        body.appendChild(grid);

        // 摇
        body.appendChild(h('button', {
            class: 'mp-plot__draw', type: 'button', disabled: busy,
            onclick: () => draw(),
        }, icon(busy ? 'refresh' : 'dice'), h('span', { text: busy ? '正在摇…' : '摇一次' })));

        const input = h('textarea', {
            class: 'mp-input mp-plot__input', rows: '3',
            placeholder: '你自己想让剧情怎么走？写一句，发进酒馆让 AI 接着写。',
        });
        inputEl = input;
        body.appendChild(h('div', { class: 'mp-plot__sendbox' },
            input,
            h('div', { class: 'mp-plot__sendrow' },
                h('span', { class: 'mp-plot__sendhint', text: '会以你的身份发进酒馆，再由 AI 生成' }),
                h('button', {
                    type: 'button', class: 'mp-plot__send',
                    onclick: () => sendToStory(input.value, tone),
                }, icon('send'), '写进酒馆'),
            ),
        ));

        // 结果
        if (result) body.appendChild(resultCard(result));

        // 最近
        const history = data.plot?.history || [];
        if (history.length > 1) {
            body.appendChild(h('div', { class: 'mp-plot__section', text: '最近的推进' }));
            const list = h('div', { class: 'mp-plot__recent' });
            for (const item of history.slice(1, 6)) {
                const t = toneOf(item.tone);
                list.appendChild(h('button', {
                    type: 'button', class: 'mp-plot__recent-row',
                    onclick: () => { result = item; render(); body.scrollTo({ top: 0, behavior: 'smooth' }); },
                },
                    h('span', { class: 'mp-plot__dot', style: { background: t.color } }),
                    h('span', { class: 'mp-plot__recent-title', text: item.title || '一次推进' }),
                    h('span', { class: 'mp-plot__recent-time', text: timeAgo(item.ts) }),
                ));
            }
            body.appendChild(list);
        }
        body.scrollTop = keep;
    }

    function resultCard(item) {
        const t = toneOf(item.tone);
        const card = h('div', { class: 'mp-plot__result', style: { '--tone': t.color } },
            h('div', { class: 'mp-plot__result-top' },
                h('span', { class: 'mp-plot__pill', text: t.name }),
                item.twist ? h('span', { class: 'mp-plot__twist', text: '意外 · ' + item.twist }) : null,
            ),
            h('div', { class: 'mp-plot__result-title', text: item.title }),
            h('div', { class: 'mp-plot__scene', text: item.scene }),
            item.hook ? h('div', { class: 'mp-plot__hook', text: item.hook }) : null,
            item.options?.length ? h('div', { class: 'mp-plot__options' },
                item.options.map((option, index) => h('button', {
                    type: 'button', class: 'mp-plot__option',
                    onclick: () => {
                        if (inputEl) inputEl.value = option;
                        sendToStory(option, item.tone);
                    },
                }, h('span', { class: 'mp-plot__option-index', text: String(index + 1) }), h('span', { text: option }))),
            ) : null,
            h('div', { class: 'mp-plot__actions' },
                h('button', { type: 'button', class: 'mp-plot__act', onclick: () => bring(item) }, icon('send'), '带进正文'),
                h('button', { type: 'button', class: 'mp-plot__act', onclick: () => copy(item) }, icon('copy'), '复制'),
                h('button', { type: 'button', class: 'mp-plot__act', onclick: () => draw() }, icon('refresh'), '再摇'),
            ),
        );
        return card;
    }

    async function draw() {
        if (busy) return;
        busy = true;
        render();
        const story = storyContext(5, 200);
        const people = (getData().world?.cast || []).map(person => person.name);
        const world = currentCharacter()?.name || '';
        let item = null;
        try {
            item = await advancePlot(tone);
        } catch (error) {
            item = plotFallback({ tone, world, people, story });
            toast('这次没连上模型，先用一个本地版本', 3000);
        }
        item.id = uid();
        item.ts = Date.now();
        const data = getData();
        data.plot = data.plot || { history: [] };
        data.plot.history = [item, ...(data.plot.history || [])].slice(0, 20);
        saveNow('data');
        result = item;
        busy = false;
        render();
        body.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function textOf(item) {
        return [
            '【下一步可以这样写】',
            item.title,
            item.scene,
            item.hook,
            item.options?.length ? '可以选：' + item.options.join(' / ') : '',
        ].filter(Boolean).join('\n');
    }

    function bring(item) {
        setOneShot(textOf(item));
        toast('已放进下一次正文的提示里');
    }

    function bringOption(item, option) {
        setOneShot(textOf(item) + '\n【用户选择了】' + option);
        toast('已选这一条，带进正文');
    }

    async function copy(item) {
        try {
            await navigator.clipboard.writeText(textOf(item));
            toast('已复制');
        } catch {
            toast('复制失败');
        }
    }

    function openHistory() {
        const history = getData().plot?.history || [];
        const content = h('div', { class: 'mp-plot__history-list' });
        if (!history.length) content.appendChild(h('div', { class: 'mp-st-hint', text: '还没有摇过。' }));
        for (const item of history) {
            const t = toneOf(item.tone);
            content.appendChild(h('button', {
                type: 'button', class: 'mp-plot__history-row',
                onclick: () => { s.close(); result = item; render(); },
            },
                h('span', { class: 'mp-plot__dot', style: { background: t.color } }),
                h('span', { text: item.title || '一次推进' }),
                h('span', { class: 'mp-plot__recent-time', text: timeAgo(item.ts) }),
            ));
        }
        const s = sheet({ title: '摇过的推进', content });
    }

    function timeAgo(ts) {
        const diff = Date.now() - ts;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
        return Math.floor(diff / 86400000) + ' 天前';
    }

    render();
    return { refresh: render };
}