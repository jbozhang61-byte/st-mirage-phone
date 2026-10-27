/**
 * 预览入口：装上酒馆替身，灌入演示数据，再挂载手机。
 * 支持 ?app=chat&thread=t1&theme=light&accent=rose&closed=1
 */
import { installStub } from './stub.js';
import { seed } from './demo.js';

installStub();

const { initStore, getData, getSettings, saveNow } = await import('../src/store.js');
const { createPhone } = await import('../src/phone.js');
const { applyThemeVars } = await import('../src/theme.js');
const { ACCENTS } = await import('../src/state.js');

const query = new URLSearchParams(location.search);

function showError(message) {
    let box = document.getElementById('preview-error');
    if (!box) {
        box = document.createElement('div');
        box.id = 'preview-error';
        box.style.cssText = 'position:fixed;left:12px;top:12px;z-index:99999;max-width:52vw;background:#c62828;color:#fff;font:12px/1.5 monospace;padding:10px 14px;border-radius:10px;white-space:pre-wrap;box-shadow:0 10px 30px rgba(0,0,0,.4)';
        document.body.appendChild(box);
    }
    box.textContent += '[预览错误] ' + message + '\n';
    document.documentElement.dataset.previewError = '1';
}

window.addEventListener('error', event => showError(event.message));
window.addEventListener('unhandledrejection', event => showError(String(event.reason?.stack || event.reason?.message || event.reason)));

initStore();

const settings = getSettings();
settings.firstRun = false;
settings.autoOpen = false;
settings.theme = query.get('theme') || 'dark';
if (query.get('apps') === 'all') {
    settings.apps = ['plot', 'spark', 'maps', 'browser', 'x', 'instagram', 'reddit', 'zhihu', 'quora', 'youtube', 'discord', 'telegram', 'spotify', 'gmail', 'stocks', 'tiktok', 'weibo', 'xhs', 'bili', 'facebook', 'signal', 'tieba'];
}
if (query.get('folder') === '1') {
    settings.home = { order: ['folder:test'], folders: [{ id: 'test', name: '分组 1', apps: ['weather', 'settings'] }] };
}
if (query.get('accent') && ACCENTS[query.get('accent')]) settings.accent = query.get('accent');
if (query.get('wallpaper')) settings.wallpaper = query.get('wallpaper');
if (query.get('scale')) settings.scale = Number(query.get('scale')) || 1;
saveNow('settings');

if (query.get('demo') !== '0') seed(getData());
saveNow('data');

applyThemeVars(document.documentElement, settings);
document.documentElement.dataset.previewReady = '0';

const phone = createPhone();
phone.refresh();

const app = query.get('app') || 'home';
const thread = query.get('thread');
if (query.get('closed') === '1') {
    phone.close();
} else if (app !== 'home') {
    phone.open(app, thread ? { threadId: thread } : {});
} else {
    phone.open();
}

// 截图时不要停在动画第一帧
function finishAnimations() {
    try { document.getAnimations?.().forEach(animation => { try { animation.finish(); } catch { /* infinite */ } }); } catch { /* ignore */ }
}
setTimeout(finishAnimations, 260);
setInterval(finishAnimations, 350);

const scrollTop = Number(query.get('scroll') || 0);
if (scrollTop) {
    setTimeout(() => {
        const body = document.querySelector('.mp-body') || document.querySelector('.mp-conv__scroll');
        body?.scrollTo?.({ top: scrollTop });
    }, 700);
}

// 方便截图脚本等待
setTimeout(() => {
    document.documentElement.dataset.previewReady = '1';
}, 400);

globalThis.__phone = phone;

const auto = query.get('auto');
if (auto === 'send') {
    setTimeout(() => {
        const area = document.querySelector('.mp-composer textarea');
        if (!area) return showError('找不到输入框');
        area.value = '我到了，门口那盏灯真好看';
        area.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => document.querySelector('.mp-composer__send')?.click(), 150);
    }, 900);
}
if (auto === 'moments') {
    setTimeout(() => {
        const buttons = [...document.querySelectorAll('.mp-nav__btn')];
        buttons.find(button => button.getAttribute('aria-label') === '换一批')?.click();
    }, 900);
}
if (auto === 'diary') {
    setTimeout(() => {
        const buttons = [...document.querySelectorAll('.mp-nav__btn')];
        buttons.find(button => button.getAttribute('aria-label') === '记下今天')?.click();
    }, 900);
}
if (auto === 'theme-light') {
    setTimeout(() => {
        const choice = [...document.querySelectorAll('.mp-choice')].find(button => button.textContent === '浅色');
        choice?.click();
    }, 900);
}
if (auto === 'sticker') {
    setTimeout(() => {
        const chip = [...document.querySelectorAll('.mp-quick button')].find(button => button.textContent.includes('表情'));
        chip?.click();
        setTimeout(() => document.querySelector('.mp-emoji')?.click(), 420);
    }, 900);
}
if (auto === 'back') {
    setTimeout(() => {
        document.querySelector('.mp-nav__btn[aria-label="返回"]')?.click();
    }, 900);
}
if (auto === 'group') {
    setTimeout(() => {
        document.querySelector('.mp-nav__btn[aria-label="新建群聊"]')?.click();
        setTimeout(() => {
            const rows = [...document.querySelectorAll('.mp-pick-row')].slice(0, 3);
            rows.forEach(row => row.click());
            setTimeout(() => {
                const buttons = [...document.querySelectorAll('.mp-sheet .mp-btn.primary')];
                buttons[buttons.length - 1]?.click();
            }, 350);
        }, 450);
    }, 900);
}
if (auto === 'install') {
    setTimeout(() => {
        document.querySelector('.mp-as__get')?.click();
        setTimeout(() => document.querySelector('.mp-as__back')?.click(), 700);
    }, 900);
}
if (auto === 'notify') {
    setTimeout(() => {
        phone.notify({ title: '夏之', text: '灯给你留着。', avatarSrc: '', threadId: 't1' });
    }, 700);
}

if (query.get('debug') === '1') {
    setTimeout(() => {
        const shell = document.querySelector('.mp-shell');
        const device = document.querySelector('.mp-device');
        const box = document.getElementById('boot-error');
        const rect = shell?.getBoundingClientRect();
        if (box) box.textContent = 'DEBUG ' + JSON.stringify({
            innerHeight: window.innerHeight,
            innerWidth: window.innerWidth,
            scaleVar: getComputedStyle(shell).getPropertyValue('--mp-scale').trim(),
            rect: rect ? { w: Math.round(rect.width), h: Math.round(rect.height), left: Math.round(rect.left), top: Math.round(rect.top) } : null,
            device: device ? Math.round(device.getBoundingClientRect().width) : null,
        });
    }, 500);
}
if (query.get('panel') === '1') setTimeout(() => document.querySelector('.mp-composer__plus')?.click(), 900);
if (query.get('money') === '1') setTimeout(() => { const b = [...document.querySelectorAll('.mp-quick button')].find(x => x.textContent.includes('红包')); b?.click(); }, 900);
if (query.get('float') === '1') setTimeout(() => window.MiragePhone?.toggleFloat?.(), 700);
if (query.get('detail') === '1') setTimeout(() => document.querySelector('.mp-soc__qa, .mp-soc__thread, .mp-soc__post')?.click(), 1100);
if (query.get('dragtest') === '1') setTimeout(async () => {
    const icons = [...document.querySelectorAll('.mp-appicon')].filter(el => el.dataset.appid && !el.dataset.appid.startsWith('folder:'));
    if (icons.length < 2) return;
    const a = icons[0], b = icons[1];
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const fire = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true }));
    fire(a, 'pointerdown', ra.left + 30, ra.top + 30);
    fire(a, 'pointermove', ra.left + 40, ra.top + 40);
    fire(a, 'pointermove', rb.left + 30, rb.top + 30);
    await new Promise(resolve => setTimeout(resolve, 900));
    fire(a, 'pointerup', rb.left + 30, rb.top + 30);
    await new Promise(resolve => setTimeout(resolve, 600));
    const err = document.querySelector('#mp-boot-error')?.textContent || '';
    document.body.dataset.dragtest = err || 'done';
}, 1200);