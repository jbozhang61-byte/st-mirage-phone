/**
 * 用 Chrome DevTools Protocol 打开真实酒馆，收集控制台/异常，
 * 检查扩展是否挂载，并截图。仅用于本地调试。
 *
 * 用法：node tools/stcheck.mjs [url] [outPng]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const URL_TO_OPEN = process.argv[2] || 'http://127.0.0.1:8000/';
const OUT = resolve(process.argv[3] || 'shots/st-phone.png');
const PORT = 9333;

const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const chrome = candidates.find(p => existsSync(p));
if (!chrome) { console.error('no chrome'); process.exit(1); }

const profile = resolve('.chrome-cdp-' + Date.now());
const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    '--window-size=1440,900',
    'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function listTargets() {
    for (let i = 0; i < 60; i++) {
        try {
            const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
            const list = await res.json();
            const page = list.find(t => t.type === 'page');
            if (page?.webSocketDebuggerUrl) return page;
        } catch { /* not up yet */ }
        await sleep(250);
    }
    throw new Error('CDP 没起来');
}

const target = await listTargets();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
const logs = [];
const errors = [];

ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
        const { resolve: done, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else done(msg.result);
        return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map(arg => arg.value ?? arg.description ?? arg.type).join(' ');
        logs.push('[' + msg.params.type + '] ' + text);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
        const details = msg.params.exceptionDetails;
        errors.push(details.exception?.description || details.text || 'unknown exception');
    }
    if (msg.method === 'Log.entryAdded') {
        const entry = msg.params.entry;
        if (entry.level === 'error') errors.push('[log] ' + entry.text + ' ' + (entry.url || ''));
        else logs.push('[log:' + entry.level + '] ' + entry.text);
    }
});

function send(method, params = {}) {
    return new Promise((resolveFn, rejectFn) => {
        const id = ++nextId;
        pending.set(id, { resolve: resolveFn, reject: rejectFn });
        ws.send(JSON.stringify({ id, method, params }));
    });
}

await new Promise((resolveFn, rejectFn) => {
    ws.addEventListener('open', resolveFn, { once: true });
    ws.addEventListener('error', rejectFn, { once: true });
});

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Page.navigate', { url: URL_TO_OPEN });
await sleep(9000);

async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    return res.result?.value;
}


await evaluate("window.MiragePhone?.open?.()");
await sleep(700);
const before = await evaluate("({ cls: document.documentElement.className, api: typeof window.MiragePhone?.toggleFloat, w: document.querySelector('.mp-shell')?.getBoundingClientRect().width })");
console.log('BEFORE ' + JSON.stringify(before));
const r = await evaluate("(() => { try { window.MiragePhone.toggleFloat(); return 'ok'; } catch (e) { return 'ERR ' + e.message; } })()");
console.log('CALL ' + JSON.stringify(r));
await sleep(500);
const after = await evaluate("({ cls: document.documentElement.className, w: document.querySelector('.mp-shell')?.getBoundingClientRect().width, h: document.querySelector('.mp-shell')?.getBoundingClientRect().height, store: localStorage.getItem('mirage_mobile_float') })");
console.log('AFTER ' + JSON.stringify(after));
ws.close();
child.kill();
process.exit(0);
