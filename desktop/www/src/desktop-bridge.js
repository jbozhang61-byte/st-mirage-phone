/**
 * 独立桌面版联动：把酒馆桥接推来的状态写进当前上下文。
 * 浏览器里跑（酒馆扩展）时 window.mpDesktop 不存在，这个模块什么都不做。
 */
let started = false;

/** 把桥接状态应用到 ST context（stub 或酒馆都适用）。 */
export function applyBridgeState(state) {
  if (!state) return false;
  const c = globalThis.SillyTavern?.getContext?.();
  if (!c) return false;
  const character = state.character || {};
  if (character.name) {
    c.name2 = character.name;
    c.character = { ...(c.character || {}), name: character.name, description: character.description || '' };
  }
  if (Array.isArray(state.messages)) {
    c.chat = state.messages.map(msg => ({
      name: msg.name, is_user: !!msg.isUser, mes: msg.text, is_system: !!msg.hidden,
    }));
  }
  if (c.chatMetadata && state.phoneData) {
    c.chatMetadata['mirage_phone'] = state.phoneData;
  }
  globalThis.__mpBridgeState = state;
  globalThis.__mpBridgeAt = Date.now();
  try {
    globalThis.dispatchEvent(new CustomEvent('mp-bridge', { detail: state }));
  } catch { /* ignore */ }
  return true;
}

/** 启动监听：只在桌面壳里执行（preload 会注入 window.mpDesktop）。 */
export function initDesktopBridge() {
  if (started) return false;
  const api = globalThis.mpDesktop;
  if (!api?.onBridgeState) return false;
  started = true;
  api.onBridgeState(state => { applyBridgeState(state); });
  try { api.requestBridgeState?.(); } catch { /* ignore */ }
  return true;
}
