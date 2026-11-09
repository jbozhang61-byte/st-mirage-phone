/**
 * 幻镜手机 · 酒馆桥接（第 3 步）
 * 把「当前角色卡 / 当前聊天 / 手机数据 / 最近消息」推给独立桌面版。
 * 桌面版开 ws://127.0.0.1:17650，这个插件作为客户端连上去。
 */
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
      console.info('[幻镜手机桥接] 已连上桌面版');
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
