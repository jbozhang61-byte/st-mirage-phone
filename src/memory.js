/**
 * 手机自己的长期记忆：把聊天分段总结成条目，注入正文时按重要性挑选。
 * 灵感来自 ST-Persistent-Memory（现场快照 / 事实分级）和 fish-memory（动态世界书），
 * 但这里只管"手机这一侧"要记住什么。
 */
import { getData } from './store.js';

/** 当前聊天的全部楼层（包括隐藏楼层，隐藏的也算剧情）。 */
export function chatFloors() {
  try {
    const c = globalThis.SillyTavern?.getContext?.();
    const list = Array.isArray(c?.chat) ? c.chat : [];
    return list.map((msg, index) => ({
      index,
      hidden: !!(msg?.is_system || msg?.is_hidden || msg?.hidden),
      name: String(msg?.name || ''),
      text: String(msg?.mes || msg?.text || '').trim(),
      isUser: !!msg?.is_user,
    })).filter(item => item.text);
  } catch {
    return [];
  }
}

export function memoryEntries() {
  const data = getData();
  if (!Array.isArray(data.memory?.entries)) data.memory = { entries: [], cursor: 0 };
  return data.memory.entries;
}

export function memoryCursor() {
  const data = getData();
  return Number(data.memory?.cursor) || 0;
}

export function saveMemoryEntry(entry) {
  const data = getData();
  if (!Array.isArray(data.memory?.entries)) data.memory = { entries: [], cursor: 0 };
  data.memory.entries = [entry, ...data.memory.entries.filter(item => item.id !== entry.id)].slice(0, 60);
  data.memory.cursor = Math.max(Number(data.memory.cursor) || 0, Number(entry.to) || 0);
  return data.memory.entries;
}

export function clearMemory() {
  const data = getData();
  data.memory = { entries: [], cursor: 0 };
  return data.memory;
}

/** 建议一次总结多少层：楼层越多，单段越长，但别一口气吞掉整本。 */
export function bestDepth(total) {
  if (total <= 30) return Math.max(8, total);
  if (total <= 120) return 40;
  if (total <= 400) return 60;
  return 80;
}

/** 注入用的记忆块：新的、带人物词的优先。 */
export function memoryBlock({ limit = 4, people = [] } = {}) {
  const entries = memoryEntries();
  if (!entries.length) return '';
  const scored = entries.map(entry => {
    let score = Number(entry.ts) / 1e12;
    const title = String(entry.title || '') + ' ' + String(entry.text || '') + ' ' + (entry.facts || []).join(' ');
    for (const name of people) {
      if (name && title.includes(name)) score += 0.5;
    }
    return { entry, score };
  }).sort((a, b) => b.score - a.score);
  const chosen = scored.slice(0, limit).map(item => item.entry);
  const lines = chosen.map(entry => {
    const facts = (entry.facts || []).slice(0, 3).join('；');
    return '· ' + (entry.title || '一段往事') + '：' + String(entry.text || '').slice(0, 220) + (facts ? '（' + facts + '）' : '');
  });
  return '【长期记忆】\n' + lines.join('\n');
}
