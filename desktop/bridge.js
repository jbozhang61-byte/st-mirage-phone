/**
 * 桥接服务：桌面端开一个本地 WebSocket，等酒馆里的桥接插件连上来。
 * 插件每秒推一次状态（角色卡 / chatId / 手机数据 / 最近消息），桌面端转给界面。
 */
let wss = null;
let latest = null;

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/** 启动 WebSocket 服务，返回端口。 */
function startBridge(port = 17650) {
  return new Promise((resolve) => {
    try {
      const { WebSocketServer } = require('ws');
      wss = new WebSocketServer({ port, host: '127.0.0.1' });
      wss.on('connection', socket => {
        socket.send(JSON.stringify({ type: 'hello', name: 'mirage-phone-desktop' }));
        socket.on('message', raw => {
          const data = safeJson(String(raw));
          if (!data || data.type !== 'state') return;
          latest = { ...data, at: Date.now() };
          wss.clients.forEach(client => {
            try { client.send(JSON.stringify({ type: 'state', state: latest })); } catch { /* ignore */ }
          });
        });
      });
      wss.on('error', () => resolve(0));
      resolve(port);
    } catch {
      resolve(0);   // 没装 ws 或者端口被占：桌面端自动退回离线模式
    }
  });
}

function latestState() { return latest; }

module.exports = { startBridge, latestState };
