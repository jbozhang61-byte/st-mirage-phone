/**
 * 幻镜手机 · 独立桌面壳（第 2 步骨架）
 * 现在只做三件事：
 *   1. 起一个本地静态服务，把仓库里的手机 UI 跑起来（复用 preview 的 ST stub）
 *   2. 开一个无边框全屏窗口，关掉窗口 = 收进后台（不退出进程）
 *   3. 留出桥接入口（第 3 步接酒馆，见 bridge.js 注释）
 */
const { app, BrowserWindow, Menu, globalShortcut, shell, ipcMain } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
// 打包后自带 www；开发时直接用源码目录
const ROOT = fs.existsSync(path.join(__dirname, 'www')) ? path.join(__dirname, 'www') : REPO;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

let win = null;
let server = null;

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
        if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
        if (!fs.existsSync(filePath)) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } catch (error) {
        res.writeHead(500).end('error');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function createWindow() {
  if (!server) await startServer();
  const port = server.address().port;
  win = new BrowserWindow({
    width: 430,
    height: 920,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#0b0c10',
    autoHideMenuBar: true,
    title: '幻镜手机',
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') },
  });
  Menu.setApplicationMenu(null);
  await win.loadURL('http://127.0.0.1:' + port + '/preview/?theme=dark&apps=all');
  ipcMain.on('mp-bridge-request', () => {
    try {
      const { latestState } = require('./bridge.js');
      const state = latestState();
      if (state) win?.webContents.send('mp-bridge-state', state);
    } catch { /* ignore */ }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  // 关窗口 = 收进后台，不退出（对应"手机挂后台照常"）
  win.on('close', event => {
    if (!app.__quitting) { event.preventDefault(); win.hide(); }
  });
}

app.whenReady().then(async () => {
  // 第 3 步：本地桥接服务（酒馆插件连上来后手机进入联动模式）
  try {
    const { startBridge } = require('./bridge.js');
    const port = await startBridge(Number(process.env.MP_BRIDGE_PORT) || 17650);
    if (port) console.log('[幻镜手机] 桥接已启动 ws://127.0.0.1:' + port);
    else console.log('[幻镜手机] 桥接未启动（离线模式）');
  } catch (error) {
    console.warn('[幻镜手机] 桥接不可用，走离线模式', error);
  }
  await createWindow();
  // 全局快捷键唤出/收起
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (!win) return;
    if (win.isVisible()) win.hide(); else { win.show(); win.focus(); }
  });
  app.on('activate', () => { if (win) { win.show(); win.focus(); } });
});

app.on('before-quit', () => { app.__quitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); if (server) server.close(); });
app.on('window-all-closed', () => { /* 保持进程存活，手机在后台 */ });
