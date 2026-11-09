/**
 * 手机自己的长期记忆：把聊天分段总结成条目，注入正文时按重要性挑选。
 * 灵感来自 ST-Persistent-Memory（现场快照 / 事实分级）和 fish-memory（动态世界书），
 * 但这里只管"手机这一侧"要记住什么。
 */
import { getData, getSettings } from './store.js';

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

/** 粗估 token：中文约 1.4 字/token，英文约 4 字符/token。 */
function estimateTokens(text) {
  const value = String(text || '');
  const cjk = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  const rest = Math.max(0, value.length - cjk);
  return Math.ceil(cjk / 1.4 + rest / 4) + 4;
}

/**
 * 自动读取"隐藏助手 / 上下文窗口"实际能看到多少层：
 * 从最后一条往前数，直到吃掉上下文预算的 35%（剩下的留给设定、注入和回复）。
 * 酒馆没暴露 token 数时按 4096 估算。
 */
export function autoWindow() {
  try {
    const c = globalThis.SillyTavern?.getContext?.();
    const budget = Number(
      c?.maxContextTokens
      || c?.power_user?.openai_max_context
      || c?.power_user?.context?.max_context
      || c?.chat_completion_settings?.openai_max_context
      || 4096,
    ) || 4096;
    const floors = chatFloors();
    if (!floors.length) return 0;
    const limit = Math.max(256, budget * 0.35);
    let used = 0;
    let count = 0;
    for (let i = floors.length - 1; i >= 0 && count < 200; i -= 1) {
      const cost = estimateTokens(floors[i].text);
      if (used + cost > limit) break;
      used += cost;
      count += 1;
    }
    // 至少 4 层，最多 120 层
    return Math.max(4, Math.min(120, count || 4));
  } catch {
    return 0;
  }
}

/**
 * 实际用多少层：
 *  - 设置里写了固定值（比如 7）就用它
 *  - 写 0 = 自动：按上下文窗口能装下的层数来（读不到就退回 bestDepth）
 */
export function plannedDepth(available = 0) {
  const settings = getSettings();
  const window = Number(settings.memory?.window) || 0;
  const total = Math.max(0, Number(available) || 0);
  if (window > 0) return Math.min(window, Math.max(1, total));
  const auto = autoWindow();
  const base = auto > 0 ? auto : bestDepth(Math.max(1, total));
  return Math.min(base, Math.max(1, total));
}

/** 还差几层才该自动总结；返回 0 表示现在就该跑。 */
export function summarizeDue() {
  const settings = getSettings();
  if (!settings.memory?.auto) return false;
  const every = Math.max(2, Number(settings.memory?.every) || 20);
  const floors = chatFloors();
  const pending = floors.length - memoryCursor();
  return pending >= every;
}

/** 按人 / 关键词检索记忆。 */
export function searchMemory(query = '') {
  const text = String(query || '').trim().toLowerCase();
  const entries = memoryEntries();
  if (!text) return entries;
  return entries.filter(entry => {
    const hay = [entry.title, entry.text, ...(entry.facts || []), ...(entry.people || [])].join(' ').toLowerCase();
    return hay.includes(text);
  });
}

export function updateMemoryEntry(id, patch = {}) {
  const data = getData();
  if (!Array.isArray(data.memory?.entries)) return [];
  data.memory.entries = data.memory.entries.map(entry => entry.id === id
    ? {
        ...entry,
        title: String(patch.title ?? entry.title).slice(0, 24),
        text: String(patch.text ?? entry.text).slice(0, 600),
        facts: Array.isArray(patch.facts) ? patch.facts.map(item => String(item).slice(0, 60)).slice(0, 6) : entry.facts,
        people: Array.isArray(patch.people) ? patch.people.map(item => String(item).slice(0, 20)).slice(0, 8) : entry.people,
      }
    : entry);
  return data.memory.entries;
}

export function removeMemoryEntry(id) {
  const data = getData();
  if (!Array.isArray(data.memory?.entries)) return [];
  data.memory.entries = data.memory.entries.filter(entry => entry.id !== id);
  return data.memory.entries;
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
