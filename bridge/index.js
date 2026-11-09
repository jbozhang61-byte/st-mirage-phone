/**
 * 骞婚暅鎵嬫満 路 閰掗妗ユ帴锛堢 3 姝ワ級
 * 浣滅敤锛氭妸銆屽綋鍓嶈鑹插崱 / 褰撳墠鑱婂ぉ / 鎵嬫満鏁版嵁 / 鏈€杩戞秷鎭€嶆帹缁欑嫭绔嬫闈㈢増銆? * 妗岄潰鐗堝紑 ws://127.0.0.1:17650锛岃繖涓彃浠朵綔涓哄鎴风杩炰笂鍘汇€? */
import { getContext } from '../../../extensions.js';
const MODULE = 'mirage_phone';
const PORT = 17650;
let socket = null;
let timer = 0;

function ctx() {
  try { return getContext?.() || null; } catch { return null; }
}

function snapshot() {
  const c = ctx();
  if (!c) return null;
  const character = c.character || { name: c.name2 || '' };
  const messages = (c.chat || []).slice(-30).map(msg => ({
    name: msg.name || '',
    isUser: !!msg.is_user,
    hidden: !!(msg.is_system || msg.is_hidden),
    text: String(msg.mes || '').slice(0, 400),
  }));
  return {
    type: 'state',
    at: Date.now(),
    character: { name: character.name || '', description: String(character.description || '').slice(0, 1200) },
    chatId: c.chatId || '',
    messages,
    phoneData: c.chatMetadata ? (c.chatMetadata[MODULE] || null) : null,
  };
}

function connect() {
  try {
    socket = new WebSocket('ws://127.0.0.1:' + PORT);
    socket.addEventListener('open', () => {
      console.info('[骞婚暅鎵嬫満妗ユ帴] 宸茶繛涓婃闈㈢増');
      push();
    });
    socket.addEventListener('close', () => {
      socket = null;
      setTimeout(connect, 4000);
    });
    socket.addEventListener('error', () => {});
  } catch {
    setTimeout(connect, 6000);
  }
}

function push() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const state = snapshot();
  if (!state) return;
  try { socket.send(JSON.stringify(state)); } catch { /* ignore */ }
}

function boot() {
  connect();
  clearInterval(timer);
  timer = setInterval(push, 1500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export { push };
