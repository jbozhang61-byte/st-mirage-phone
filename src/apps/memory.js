/**
 * 记忆：把聊过的剧情收成长期记忆，注入正文时自动带上。
 */
import { h, icon, sheet, toast } from '../render.js';
import { getData, getSettings, saveNow, patchSettings } from '../store.js';
import { summarizeMemory } from '../ai.js';
import { memoryEntries, clearMemory, bestDepth, chatFloors, memoryCursor } from '../memory.js';

export function mountMemory(host, { nav }) {
  let busy = false;
  const el = h('div', { class: 'mp-mem' });
  const body = h('div', { class: 'mp-mem__body' });
  el.append(
    h('div', { class: 'mp-nav' },
      h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
      h('div', { class: 'mp-nav__title' }, '记忆', h('small', { text: 'MEMORY' })),
      h('div', { class: 'mp-nav__spacer' }),
    ),
    body,
  );
  host.appendChild(el);

  function render() {
    body.innerHTML = '';
    const floors = chatFloors();
    const hidden = floors.filter(item => item.hidden).length;
    const cursor = memoryCursor();
    const depth = bestDepth(Math.max(1, floors.length - cursor));
    const entries = memoryEntries();

    body.appendChild(h('div', { class: 'mp-mem__hero' },
      h('div', { class: 'mp-mem__count', text: String(entries.length) }),
      h('div', { class: 'mp-mem__hero-main' },
        h('div', { class: 'mp-mem__hero-title', text: '条长期记忆' }),
        h('div', { class: 'mp-mem__hero-sub', text: '共 ' + floors.length + ' 层 · 其中隐藏楼层 ' + hidden + ' 条也会读' })),
    ));

    body.appendChild(h('div', { class: 'mp-mem__actions' },
      h('button', {
        type: 'button', class: 'mp-btn primary small', text: busy ? '总结中…' : '总结接下来 ' + depth + ' 层',
        disabled: busy, onclick: () => run(depth),
      }),
      h('button', { type: 'button', class: 'mp-btn small', text: '总结全部未读', onclick: () => run(0) }),
    ));

    const entriesWrap = h('div', { class: 'mp-mem__list' });
    if (!entries.length) {
      entriesWrap.appendChild(h('div', { class: 'mp-st-hint', text: '还没有记忆。点上面按钮，会自动挑一段并总结；隐藏楼层也会算进去。' }));
    }
    for (const entry of entries) {
      entriesWrap.appendChild(h('div', { class: 'mp-mem__card' },
        h('div', { class: 'mp-mem__card-top' },
          h('span', { class: 'mp-mem__title', text: entry.title || '一段记忆' }),
          h('span', { class: 'mp-mem__range', text: '#' + entry.from + '–#' + entry.to + (entry.hidden ? ' · 含隐藏 ' + entry.hidden : '') })),
        h('div', { class: 'mp-mem__text', text: entry.text }),
        (entry.facts || []).length ? h('div', { class: 'mp-mem__facts' }, ...(entry.facts || []).map(fact => h('span', { class: 'mp-mem__fact', text: fact }))) : null,
      ));
    }
    body.appendChild(entriesWrap);

    body.appendChild(h('div', { class: 'mp-mem__foot' },
      h('button', { type: 'button', class: 'mp-btn ghost small', text: '清空记忆', onclick: () => {
        if (!globalThis.confirm?.('清空这个聊天的所有记忆？')) return;
        clearMemory();
        saveNow('data');
        toast('已清空');
        render();
      } }),
    ));
  }

  async function run(depth) {
    if (busy) return;
    busy = true;
    render();
    try {
      const entry = await summarizeMemory({ turns: depth });
      toast('记下了：' + (entry.title || '一段'), 2600);
    } catch (error) {
      toast(String(error?.message || '总结失败').slice(0, 40), 3200);
    } finally {
      busy = false;
      render();
    }
  }

  render();
  return { refresh: render };
}
