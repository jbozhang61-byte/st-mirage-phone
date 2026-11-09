/**
 * 幻镜手机 · 本机中转（情况 A：酒馆跑在手机上，Termux 里）
 *
 * 用法（Termux）：
 *   node relay.js            # 监听 127.0.0.1:17650
 *
 * 谁连上来：
 *   - 酒馆页面里的「幻镜手机 · 桥接」插件（推角色卡 / 聊天 / 手机数据，收手机发来的消息）
 *   - 幻镜手机 App（收状态，发消息）
 * 两个都连到同一个 ws://127.0.0.1:17650，互相转发，不需要电脑。
 */
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.MP_RELAY_PORT) || 17650;
const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });

function send(socket, payload) {
  try { socket.send(JSON.stringify(payload)); } catch { /* ignore */ }
}

wss.on('connection', socket => {
  socket.role = 'unknown';
  socket.on('message', raw => {
    let data = null;
    try { data = JSON.parse(String(raw)); } catch { return; }
    if (!data || !data.type) return;

    if (data.type === 'hello') {
      socket.role = data.role === 'app' ? 'app' : 'tavern';
      console.log('[relay] ' + socket.role + ' 已连接');
      return;
    }

    // 手机 -> 酒馆：让酒馆把这句话发进当前聊天
    if (data.type === 'command' && data.action === 'send') {
      console.log('[relay] 收到手机消息：' + String(data.text || '').slice(0, 40));
    }

    // 其余消息按"广播给另一个角色"处理
    for (const client of wss.clients) {
      if (client === socket || client.readyState !== 1) continue;
      send(client, data);
    }
  });

  socket.on('close', () => console.log('[relay] ' + socket.role + ' 断开'));
  socket.on('error', () => {});
});

console.log('[幻镜手机] 本机中转已启动 ws://127.0.0.1:' + PORT);
console.log('[幻镜手机] 酒馆桥接插件和手机 App 都连这个地址');
