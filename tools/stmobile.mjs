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
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' });
await send('Runtime.enable');
await send('Log.enable');
await send('Page.navigate', { url: URL_TO_OPEN });
await sleep(9000);

async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    return res.result?.value;
}

// 清掉测试期间可能写进去的手机设置，让默认值生效
try {
    await evaluate(`(() => { const c = window.SillyTavern?.getContext?.(); if (c?.extensionSettings) { delete c.extensionSettings.mirage_phone; c.saveSettingsDebounced?.(); } return true; })()`);
    await send('Page.reload');
    await sleep(10000);
} catch (error) {
    console.log('RESET FAILED ' + error.message);
}

const report = await evaluate(`(() => {
    const ctx = window.SillyTavern?.getContext?.();
    return {
        title: document.title,
        st: !!window.SillyTavern,
        chat: ctx?.chat?.length ?? null,
        char: ctx?.name2 ?? null,
        root: !!document.querySelector('.mp-root'),
        fab: !!document.querySelector('.mp-fab'),
        panel: !!document.querySelector('#mp_st_panel'),
        menu: !!document.querySelector('#mp_menu_item'),
        api: !!window.MiragePhone,
        settings: !!ctx?.extensionSettings?.mirage_phone,
        iframe: document.querySelectorAll('iframe').length,
    };
})()`);

console.log('REPORT ' + JSON.stringify(report));
const tiebaTest = await evaluate(`(async () => {
    window.MiragePhone?.openApp?.('tieba');
    await new Promise(r => setTimeout(r, 900));
    return {
        has: !!document.querySelector('.mp-tb'),
        posts: document.querySelectorAll('.mp-tb__post').length,
        error: document.getElementById('boot-error')?.textContent || '',
        app: document.querySelector('.mp-app')?.getAttribute('data-app') || ''
    };
})()
})()`);
console.log('TIEBA ' + JSON.stringify(tiebaTest));
const tiebaDetail = await evaluate(`(async () => {
    document.querySelector('.mp-tb__post')?.click();
    await new Promise(r => setTimeout(r, 1200));
    return {
        page: !!document.querySelector('.mp-soc-page'),
        title: document.querySelector('.mp-soc-page__title')?.textContent || '',
        comments: document.querySelectorAll('.mp-cm').length,
        text: (document.querySelector('.mp-soc-page__text')?.textContent || '').slice(0, 60),
        error: document.getElementById('boot-error')?.textContent || ''
    };
})()`);
console.log('TIEBADETAIL ' + JSON.stringify(tiebaDetail));
const proactiveTest = await evaluate(`(() => {
    const boxes = document.querySelectorAll('#mp_st_panel input[type="checkbox"]');
    const box = boxes[2];
    if (!box) return 'no-checkbox';
    const before = box.checked;
    const info = { disabled: box.disabled, type: box.type, pe: getComputedStyle(box).pointerEvents, disabledAttr: box.getAttribute('disabled'), outer: box.outerHTML.slice(0, 140) };
    box.click();
    const afterClick = box.checked;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    return { before, info, afterClick, afterDispatch: box.checked, setting: window.MiragePhone?.settings?.proactive?.enabled };
})()`);
console.log('PROACTIVE ' + JSON.stringify(proactiveTest));
console.log('ERRORS ' + errors.length);
for (const error of errors.slice(0, 12)) console.log('  ' + String(error).split('\n').slice(0, 3).join(' | ').slice(0, 400));
console.log('LOGTAIL');
for (const line of logs.slice(-14)) console.log('  ' + line.slice(0, 240));

// 打开手机并截图
try {
    const opened = await evaluate(`(() => {
        const fabs = [...document.querySelectorAll('.mp-fab')];
        const fab = fabs[fabs.length - 1];
        if (fab) { fab.click(); return 'clicked'; }
        return 'no-fab';
    })()`);
    console.log('OPEN ' + opened);
    await sleep(1200);
    const after = await evaluate(`(() => {
        const shell = document.querySelector('.mp-shell');
        const root = document.querySelector('.mp-root');
        const fab = [...document.querySelectorAll('.mp-fab')].at(-1);
        const screen = document.querySelector('.mp-screen');
        const box = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top), display: s.display, opacity: s.opacity, visibility: s.visibility };
        };
        return {
            shellClass: shell?.className,
            rootClass: root?.className,
            fabClass: fab?.className, fabBox: box(fab), fabZ: fab ? getComputedStyle(fab).zIndex : null,
            shellBox: box(shell),
            screenBox: box(screen),
            homeIcons: document.querySelectorAll('.mp-appicon').length,
            enabled: window.MiragePhone?.settings?.enabled,
            collapsed: window.MiragePhone?.settings?.collapsed,
            innerW: window.innerWidth,
            innerH: window.innerHeight,
            narrow: matchMedia('(max-width: 760px)').matches,
            scaleVar: shell ? getComputedStyle(shell).getPropertyValue('--mp-scale') : null,
            transform: shell ? getComputedStyle(shell).transform : null,
            settingScale: window.MiragePhone?.settings?.scale,
        };
    })()`);
    console.log('AFTER ' + JSON.stringify(after));
    await evaluate(`window.dispatchEvent(new Event('resize'))`);
    await sleep(600);
    const relayout = await evaluate(`(() => {
        const shell = document.querySelector('.mp-shell');
        const r = shell.getBoundingClientRect();
        return { scaleVar: getComputedStyle(shell).getPropertyValue('--mp-scale'), w: Math.round(r.width), top: Math.round(r.top), innerH: window.innerHeight };
    })()`);
    console.log('RELAYOUT ' + JSON.stringify(relayout));
    const env = await evaluate(`({
        isMobile: window.SillyTavern?.getContext?.()?.isMobile,
        ua: navigator.userAgent,
        coarse: matchMedia('(pointer: coarse)').matches,
        innerW: window.innerWidth,
        maxTouch: navigator.maxTouchPoints,
    })`);
    console.log('ENV ' + JSON.stringify(env));
    console.log('ERR-AFTER ' + errors.length);
    for (const error of errors.slice(0, 6)) console.log('  ! ' + String(error).split('\n')[0].slice(0, 300));
    const dbg = await evaluate(`(() => {
        const s = document.querySelector('.mp-shell');
        const cs = getComputedStyle(s);
        const rootEl = document.querySelector('.mp-root'); const rcs = getComputedStyle(rootEl); const root = rootEl.getBoundingClientRect();
        return { pos: cs.position, top: cs.top, bottom: cs.bottom, height: cs.height, transform: cs.transform, margin: cs.margin, rootTop: root.top, rootH: root.height, rootPos: rcs.position, rootInset: rcs.inset, rootDisplay: rcs.display, rootTransform: rcs.transform, rootContain: rcs.contain, rootWillChange: rcs.willChange, shellStyle: s.getAttribute('style'), atTop: (() => { const el = document.elementFromPoint(20, 20); return el ? (el.id + '|' + el.className + '|' + el.tagName) : null; })(), innerH: window.innerHeight, scrollY: window.scrollY };
    })()`);
    console.log('DBG ' + JSON.stringify(dbg));
    await evaluate(`window.MiragePhone?.openApp?.('chat')`);
    await sleep(900);
    const chatShot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve('shots/mobile-chat2.png'), Buffer.from(chatShot.data, 'base64'));
    const chatBox = await evaluate(`(() => { const s = document.querySelector('.mp-shell').getBoundingClientRect(); const a = document.querySelector('.mp-app')?.getBoundingClientRect(); return { shell: { left: Math.round(s.left), top: Math.round(s.top), w: Math.round(s.width), h: Math.round(s.height) }, app: a ? { left: Math.round(a.left), top: Math.round(a.top), w: Math.round(a.width), h: Math.round(a.height) } : null }; })()`);
    console.log('CHATBOX ' + JSON.stringify(chatBox));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(resolve(OUT, '..'), { recursive: true });
    writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
    console.log('SHOT ' + OUT);

    async function shotTo(name) {
        const data = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(resolve(name), Buffer.from(data.data, 'base64'));
        console.log('SHOT ' + name);
    }

    await evaluate(`document.querySelector('.mp-appicon[aria-label="通讯录"]')?.click()`);
    await sleep(900);
    const contacts = await evaluate(`(() => ({
        rows: document.querySelectorAll('.mp-contact').length,
        names: [...document.querySelectorAll('.mp-contact__name')].slice(0, 6).map(el => el.textContent),
        avatars: document.querySelectorAll('.mp-contact img').length,
        title: document.querySelector('.mp-nav__title')?.textContent,
    }))()`);
    console.log('CONTACTS ' + JSON.stringify(contacts));
    await shotTo('shots/st-contacts.png');

    const openedChat = await evaluate(`(() => {
        const row = document.querySelector('.mp-contact');
        if (!row) return 'none';
        row.click();
        return 'clicked';
    })()`);
    await sleep(900);
    const chatInfo = await evaluate(`(() => ({
        header: document.querySelector('.mp-conv__head .mp-nav__title')?.textContent,
        status: document.querySelector('.mp-conv__status')?.textContent,
        starter: !!document.querySelector('.mp-starter'),
        composer: !!document.querySelector('.mp-composer textarea'),
        genRaw: typeof window.SillyTavern?.getContext?.()?.generateRaw,
        hasExtPrompt: Object.keys(window.SillyTavern?.getContext?.()?.extensionPrompts || {}).filter(k => k.startsWith('mirage')),
    }))()`);
    console.log('CHAT ' + openedChat + ' ' + JSON.stringify(chatInfo));
    await shotTo('shots/st-chat.png');

    // 设置 App：切到深色，看看真实酒馆里的设置页
    await evaluate(`document.querySelector('.mp-nav__btn[aria-label="返回"]')?.click()`);
    await sleep(500);
    await evaluate(`document.querySelector('.mp-nav__btn[aria-label="主屏"]')?.click()`);
    await sleep(700);
    await evaluate(`document.querySelector('.mp-appicon[aria-label="设置"]')?.click()`);
    await sleep(800);
    const themeInfo = await evaluate(`(() => {
        const choices = [...document.querySelectorAll('.mp-choice')];
        const dark = choices.find(b => b.textContent === '深色');
        dark?.click();
        return { choices: choices.map(b => b.textContent), clicked: !!dark };
    })()`);
    console.log('THEME ' + JSON.stringify(themeInfo));
    await sleep(900);
    await shotTo('shots/st-settings.png');
    await evaluate(`document.querySelector('.mp-nav__btn[aria-label="返回"]')?.click()`);
    await sleep(900);
    await shotTo('shots/st-home-dark.png');

    // 不调用 API，直接往数据层塞对话，验证存储与注入
    const seeded = await evaluate(`(async () => {
        const base = '/scripts/extensions/third-party/st-mirage-phone/src/';
        const store = await import(base + 'store.js');
        const ai = await import(base + 'ai.js');
        store.initStore();
        const thread = store.ensureThread(['德华']);
        store.appendMessages(thread.id, [
            { from: 'them', sender: '德华', type: 'text', text: '在吗' },
            { from: 'me', type: 'text', text: '在，刚到家' },
        ]);
        const prompt = ai.refreshInjection();
        const c = window.SillyTavern.getContext();
        return {
            threads: store.getData().threads.length,
            msgs: store.getData().threads[0]?.msgs.length,
            injected: (c.extensionPrompts?.['mirage_phone_state']?.value || '').slice(0, 70),
            preview: (prompt || '').slice(0, 70),
        };
    })()`);
    console.log('SEED ' + JSON.stringify(seeded));
    await sleep(1800);
    await send('Page.reload');
    await sleep(10000);
    const persisted = await evaluate(`(async () => {
        const store = await import('/scripts/extensions/third-party/st-mirage-phone/src/store.js');
        store.initStore();
        const c = window.SillyTavern.getContext();
        return {
            threads: store.getData().threads.length,
            msgs: store.getData().threads[0]?.msgs.length,
            injected: (c.extensionPrompts?.['mirage_phone_state']?.value || '').slice(0, 70),
        };
    })()`);
    console.log('PERSIST ' + JSON.stringify(persisted));
    const mirageErrors = errors.filter(e => /mirage|Mirage/i.test(String(e)));
    console.log('MIRAGE-ERRORS ' + mirageErrors.length + ' ' + mirageErrors.slice(0, 3).join(' || ').slice(0, 400));
} catch (error) {
    console.log('SHOT FAILED ' + error.message);
}

ws.close();
child.kill();
console.log('DONE');
process.exit(0);