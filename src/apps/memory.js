/**
 * 记忆：把聊过的剧情收成长期记忆，注入正文时自动带上。
 * 支持：自动总结、按人检索、单条编辑 / 删除。
 */
import { h, icon, sheet, toast } from '../render.js';
import { getData, saveNow } from '../store.js';
import { summarizeMemory } from '../ai.js';
import {
  memoryEntries, clearMemory, plannedDepth, chatFloors, memoryCursor,
  searchMemory, updateMemoryEntry, removeMemoryEntry,
} from '../memory.js';

export function mountMemory(host, { nav }) {
  let busy = false;
  let query = '';
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
    const depth = plannedDepth(Math.max(1, floors.length - cursor));
    const entries = memoryEntries();
    const list = query ? searchMemory(query) : entries;

    body.appendChild(h('div', { class: 'mp-mem__hero' },
      h('div', { class: 'mp-mem__count', text: String(entries.length) }),
      h('div', {},
        h('div', { class: 'mp-mem__hero-title', text: '条长期记忆' }),
        h('div', { class: 'mp-mem__hero-sub', text: '共 ' + floors.length + ' 层 · 隐藏楼层 ' + hidden + ' 条也会读' })),
    ));

    const search = h('input', {
      class: 'mp-input', type: 'text', placeholder: '按人名 / 关键词找记忆',
      value: query,
      oninput: event => {
        query = event.target.value.trim();
        renderList();
      },
    });
    body.appendChild(h('div', { class: 'mp-mem__search' }, icon('search'), search));

    body.appendChild(h('div', { class: 'mp-mem__actions' },
      h('button', {
        type: 'button', class: 'mp-btn primary small', text: busy ? '总结中…' : '总结 ' + depth + ' 层',
        disabled: busy, onclick: () => run(depth),
      }),
      h('button', { type: 'button', class: 'mp-btn small', text: '全部未读', onclick: () => run(0) }),
    ));

    const wrap = h('div', { class: 'mp-mem__list' });
    body.appendChild(wrap);

    function renderList() {
      wrap.innerHTML = '';
      const shown = query ? searchMemory(query) : memoryEntries();
      if (!shown.length) {
        wrap.appendChild(h('div', { class: 'mp-st-hint', text: query ? '没有找到相关的记忆' : '还没有记忆。点上面按钮开始总结。' }));
        return;
      }
      for (const entry of shown) {
        wrap.appendChild(h('div', {
          class: 'mp-mem__card',
          onclick: () => openEntry(entry),
        },
          h('div', { class: 'mp-mem__card-top' },
            h('span', { class: 'mp-mem__title', text: entry.title || '一段记忆' }),
            h('span', { class: 'mp-mem__range', text: '#' + entry.from + '–#' + entry.to })),
          h('div', { class: 'mp-mem__text', text: entry.text }),
          (entry.facts || []).length ? h('div', { class: 'mp-mem__facts' },
            ...(entry.facts || []).slice(0, 3).map(fact => h('span', { class: 'mp-mem__fact', text: fact }))) : null,
        ));
      }
    }
    renderList();

    body.appendChild(h('div', { class: 'mp-mem__foot' },
      h('button', {
        type: 'button', class: 'mp-btn ghost small', text: '清空记忆',
        onclick: () => {
          if (!globalThis.confirm?.('清空这个聊天的所有记忆？')) return;
          clearMemory();
          saveNow('data');
          toast('已清空');
          render();
        },
      }),
    ));
  }

  /** 点一条：看全文，能改能删。 */
  function openEntry(entry) {
    const title = h('input', { class: 'mp-input', type: 'text', value: entry.title || '' });
    const text = h('textarea', { class: 'mp-input', rows: '6' });
    text.value = entry.text || '';
    const facts = h('input', { class: 'mp-input', type: 'text', value: (entry.facts || []).join('；') });
    const dialog = sheet({
      title: '编辑记忆',
      content: h('div', { class: 'mp-field-list' },
        h('div', { class: 'mp-st-hint', text: '楼层 #' + entry.from + '–#' + entry.to + (entry.hidden ? ' · 含隐藏 ' + entry.hidden + ' 条' : '') }),
        title, text, facts,
        h('div', { class: 'mp-st-hint', text: '事实用中文分号「；」隔开' }),
      ),
      actions: h('div', { style: { display: 'flex', gap: '8px' } },
        h('button', {
          class: 'mp-btn ghost small', type: 'button', text: '删除',
          onclick: () => {
            removeMemoryEntry(entry.id);
            saveNow('data');
            dialog.close();
            toast('已删除');
            render();
          },
        }),
        h('button', {
          class: 'mp-btn primary small', type: 'button', text: '保存',
          onclick: () => {
            updateMemoryEntry(entry.id, {
              title: title.value.trim(),
              text: text.value.trim(),
              facts: facts.value.split(/[；;]/).map(part => part.trim()).filter(Boolean),
            });
            saveNow('data');
            dialog.close();
            toast('已保存');
            render();
          },
        }),
      ),
    });
    return dialog;
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
