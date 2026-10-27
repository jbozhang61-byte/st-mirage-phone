/**
 * 手机外壳：窗口、状态栏、灵动岛、主屏、路由、通知。
 * 应用模块只负责画自己的页面，拿到的 nav 提供跳转与提示。
 */
import { h, icon, avatar, clockText, toast as rawToast, sheet, confirmSheet, setLayer, haptic, ensureSprite } from './render.js';
import {
    getSettings, getData, onChange, markRead, findThread, saveNow,
} from './store.js';
import { totalUnread } from './state.js';
import { isNarrow, loadPersonaAvatar } from './st.js';
import { applyThemeVars, isLite } from './theme.js';
import { mountHome } from './apps/home.js';
import { mountChat } from './apps/chat.js';
import { mountMoments } from './apps/moments.js';
import { mountContacts } from './apps/contacts.js';
import { mountPhotos } from './apps/photos.js';
import { mountNotes } from './apps/notes.js';
import { mountWeather } from './apps/weather.js';
import { mountSettings } from './apps/settings.js';
import { mountMe } from './apps/me.js';
import { mountWallet } from './apps/wallet.js';
import { mountStore } from './apps/store.js';
import { mountTikTok } from './apps/tiktok.js';
import { mountWeibo } from './apps/weibo.js';
import { mountXhs } from './apps/xhs.js';
import { mountBili } from './apps/bili.js';
import { mountPlot } from './apps/plot.js';
import { mountSpark } from './apps/spark.js';
import { mountMaps } from './apps/maps.js';
import { mountBrowser } from './apps/browser.js';
import { mountSocial } from './apps/social.js';
import { mountDiscord, mountTelegram, mountSpotify, mountGmail } from './apps/extra.js';
import { mountStocks } from './apps/stocks.js';
import { mountFacebook } from './apps/facebook.js';
import { mountSignal } from './apps/signal.js';
import { mountTieba } from './apps/tieba.js';

const APPS = {
    chat: { mount: mountChat },
    moments: { mount: mountMoments },
    contacts: { mount: mountContacts },
    photos: { mount: mountPhotos },
    notes: { mount: mountNotes },
    weather: { mount: mountWeather },
    settings: { mount: mountSettings },
    me: { mount: mountMe },
    wallet: { mount: mountWallet },
    store: { mount: mountStore },
    tiktok: { mount: mountTikTok },
    weibo: { mount: mountWeibo },
    xhs: { mount: mountXhs },
    bili: { mount: mountBili },
    plot: { mount: mountPlot },
    spark: { mount: mountSpark },
    maps: { mount: mountMaps },
    browser: { mount: mountBrowser },
    x: { mount: mountSocial('x') },
    instagram: { mount: mountSocial('instagram') },
    reddit: { mount: mountSocial('reddit') },
    zhihu: { mount: mountSocial('zhihu') },
    quora: { mount: mountSocial('quora') },
    youtube: { mount: mountSocial('youtube') },
    discord: { mount: mountDiscord },
    telegram: { mount: mountTelegram },
    spotify: { mount: mountSpotify },
    gmail: { mount: mountGmail },
    stocks: { mount: mountStocks },
    facebook: { mount: mountFacebook },
    signal: { mount: mountSignal },
    tieba: { mount: mountTieba },
};

let rootEl = null;
let shellEl = null;
let screenEl = null;
let viewEl = null;
let homeHost = null;
let homeView = null;
let bannerEl = null;
let fabEl = null;
let islandEl = null;

let current = null;
let open = false;
let typingThreads = new Set();
let clockTimer = 0;
let resizeTimer = 0;
let bannerTimer = 0;
let themeMedia = null;
let openListener = null;

const refs = {};

export function isPhoneOpen() {
    return open;
}

export function currentThreadId() {
    return current?.id === 'chat' ? current.params?.threadId || null : null;
}

/* --------------------------------- 构建 --------------------------------- */

export function createPhone(onOpenChange) {
    if (rootEl) return api;
    openListener = typeof onOpenChange === 'function' ? onOpenChange : null;

    ensureSprite();
    rootEl = h('div', { class: 'mp-root', 'data-theme': 'dark' });
    shellEl = h('div', { class: 'mp-shell is-closed' });
    screenEl = h('div', { class: 'mp-screen' });

    islandEl = h('div', { class: 'mp-island' }, h('div', { class: 'mp-island__inner' }));
    refs.islandInner = islandEl.firstChild;

    const timeEl = h('span', { class: 'mp-status__time', text: clockText() });
    const signal = h('span', { class: 'mp-signal' }, h('i'), h('i'), h('i'), h('i'));
    const batt = icon('battery', 'batt');
    refs.statusTime = timeEl;
    refs.battery = batt;

    const floatBtn = h('button', {
        type: 'button', class: 'mp-status__float', 'aria-label': '切换悬浮窗',
        onclick: event => { event.stopPropagation(); toggleFloatMode(); },
    }, icon('maximize'));
    const collapseBtn = h('button', {
        type: 'button', class: 'mp-status__collapse', 'aria-label': '收起小手机', title: '收起小手机',
        onclick: event => { event.stopPropagation(); closePhone(); },
    }, icon('down'));
    const statusEl = h('div', { class: 'mp-status' }, timeEl,
        h('div', { class: 'mp-status__right' }, collapseBtn, floatBtn, signal, icon('wifi'), batt));

    const wallEl = h('div', { class: 'mp-wallpaper', 'data-wall': 'aurora' });
    refs.wall = wallEl;

    viewEl = h('div', { class: 'mp-view' });
    homeHost = h('div', { class: 'mp-home' });

    bannerEl = h('div', { class: 'mp-banner' });
    const toastLayer = h('div', { class: 'mp-toast-layer' });

    globalThis.addEventListener('mp-island-toast', event => {
        if (!open) return;
        islandShow({ text: event.detail?.text || '通知' });
    });
    const homebar = h('button', {
        class: 'mp-homebar',
        type: 'button',
        'aria-label': '回到主屏',
        onclick: () => goHome(),
    });

    screenEl.classList.add('is-home');
    const portalLayer = h('div', { class: 'mp-portal' });
    screenEl.append(wallEl, islandEl, statusEl, viewEl, portalLayer, toastLayer, bannerEl, homebar);
    const device = h('div', { class: 'mp-device' }, screenEl);
    shellEl.appendChild(device);
    rootEl.appendChild(shellEl);

    fabEl = h('button', {
        class: 'mp-fab',
        type: 'button',
        'aria-label': '打开小手机',
        onclick: () => toggle(),
    }, icon('phone'), h('span', { class: 'mp-fab__badge is-hide' }));
    refs.fabBadge = fabEl.lastChild;
    document.body.appendChild(rootEl);
    const fabHost = document.documentElement;
    fabHost.appendChild(fabEl);
    setTimeout(syncFabPosition, 0);
    try {
        if (isNarrow()) {
            globalThis.localStorage?.setItem('mirage_mobile_float', '1');
            document.documentElement.classList.add('mp-mobile-float');
            const settings = getSettings();
            if (!settings.scale || settings.scale > 0.9) {
                settings.scale = 0.82;
                saveNow('settings');
            }
        } else if (globalThis.localStorage?.getItem('mirage_mobile_float') === '1') {
            document.documentElement.classList.add('mp-mobile-float');
        }
    } catch { /* ignore */ }
    setLayer(portalLayer);
    applyThemeVars(rootEl, getSettings());

    homeView = mountHome(homeHost, { nav: makeNav() });
    viewEl.appendChild(homeHost);

    clockTimer = setInterval(tick, 15000);
    setTimeout(applyLayout, 700);
    setTimeout(applyLayout, 1800);
    window.addEventListener('resize', onResize, { passive: true });
    globalThis.visualViewport?.addEventListener('resize', onResize, { passive: true });
    globalThis.visualViewport?.addEventListener('scroll', onResize, { passive: true });
    document.addEventListener('focusin', event => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !screenEl?.contains(target)) return;
        setTimeout(() => {
            applyLayout();
            target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        }, 160);
    }, true);
    document.addEventListener('focusout', () => setTimeout(applyLayout, 120), true);
    document.addEventListener('visibilitychange', onVisibility);
    themeMedia = window.matchMedia?.('(prefers-color-scheme: light)');
    themeMedia?.addEventListener?.('change', applyThemeVars.bind(null, rootEl, getSettings()));

    bindDrag(device);


    // 手机端：从左边缘往右滑 = 返回
    let edgeStart = null;
    screenEl.addEventListener('pointerdown', event => {
        if (!current) return;
        const rect = screenEl.getBoundingClientRect();
        if (event.clientX - rect.left > 26) return;
        edgeStart = { x: event.clientX, y: event.clientY };
    }, { passive: true });
    window.addEventListener('pointermove', event => {
        if (!edgeStart) return;
        const dx = event.clientX - edgeStart.x;
        const dy = Math.abs(event.clientY - edgeStart.y);
        if (dx > 64 && dy < 60) {
            edgeStart = null;
            goBack();
        }
    }, { passive: true });
    window.addEventListener('pointerup', () => { edgeStart = null; }, { passive: true });

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (shellEl?.classList.contains('is-full')) { toggleFull(); return; }
        if (current) goHome();
    });
    applyLayout();
    applyWallpaper();
    refreshBadges();
    tick();
    loadPersonaAvatar().then(() => homeView?.refresh?.());

    initBattery();
    const bootSettings = getSettings();
    if (bootSettings.firstRun && bootSettings.enabled !== false) {
        // 第一次装好时提示一下入口，但不要直接把手机铺满屏幕
        bootSettings.firstRun = false;
        saveNow('settings');
    }
    return api;
}

/* --------------------------------- 主题/布局 --------------------------------- */

export function refreshTheme() {
    if (!rootEl) return;
    applyThemeVars(rootEl, getSettings());
    applyLayout();
    applyWallpaper();
}

function applyWallpaper() {
    const settings = getSettings();
    const wall = refs.wall;
    if (!wall) return;
    wall.setAttribute('data-wall', settings.wallpaper || 'aurora');
    let custom = '';
    try { custom = localStorage.getItem('mirage_phone_wall') || ''; } catch { /* ignore */ }
    if (settings.wallpaper === 'custom' && custom) {
        wall.style.backgroundImage = 'url("' + custom + '")';
    } else {
        wall.style.backgroundImage = '';
    }
}

let layoutRaf = 0;
function scheduleLayout() {
    if (layoutRaf) return;
    layoutRaf = requestAnimationFrame(() => {
        layoutRaf = 0;
        applyLayout();
    });
}

function syncFabPosition() {
    if (!fabEl) return;
    const vv = window.visualViewport;
    const viewport = (vv?.offsetTop || 0) + (vv?.height || window.innerHeight);
    const narrow = isNarrow();
    const gap = narrow ? 96 : 22;
    const size = narrow ? 56 : 58;
    fabEl.style.setProperty('top', Math.round(viewport - gap - size) + 'px', 'important');
    fabEl.style.setProperty('bottom', 'auto', 'important');
}

function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { applyLayout(); syncFabPosition(); }, 40);
}

function viewportMetrics() {
    const vv = globalThis.visualViewport;
    return {
        width: vv?.width || window.innerWidth,
        height: vv?.height || window.innerHeight,
        left: vv?.offsetLeft || 0,
        top: vv?.offsetTop || 0,
    };
}

function paintFloat(scale, pos) {
    if (!shellEl) return;
    const w = 384 * scale;
    const h = 812 * scale;
    const vp = viewportMetrics();
    const left = Math.round(vp.left + (vp.width - w) / 2 + (pos?.x || 0));
    const top = Math.round(vp.top + (vp.height - h) / 2 + (pos?.y || 0));
    shellEl.style.setProperty('left', '0px', 'important');
    shellEl.style.setProperty('top', '0px', 'important');
    shellEl.style.setProperty('right', 'auto', 'important');
    shellEl.style.setProperty('bottom', 'auto', 'important');
    shellEl.style.setProperty('transform-origin', 'top left', 'important');
    shellEl.style.setProperty('transform', 'translate3d(' + left + 'px, ' + top + 'px, 0) scale(' + scale + ')', 'important');
}

function applyLayout() {
    if (!shellEl) return;
    setFab(open);
    const settings = getSettings();
    const narrow = isNarrow();
    if (narrow) {
        document.documentElement.classList.add('mp-mobile-float');
        if (!settings.mobileScaleInit) {
            settings.mobileScaleInit = true;
            settings.scale = Math.min(Number(settings.scale) || 0.82, 0.82);
            saveNow('settings');
        }
    }
    const floating = document.documentElement.classList.contains('mp-mobile-float');
    if (narrow) {
        const vp = viewportMetrics();
        const keyboardOpen = vp.height < window.innerHeight - 120;
        if (floating && keyboardOpen) {
            // 键盘弹出：保持宽度可读，把手机底部贴到键盘上边缘
            const widthFit = (vp.width - 16) / 384;
            const scale = Math.max(0.58, Math.min(1.12, widthFit, Number(settings.scale) || 0.82));
            shellEl.style.setProperty('--mp-scale', String(scale));
            const h = 812 * scale;
            paintFloat(scale, { x: 0, y: (vp.top + vp.height - h - 8) - (vp.top + (vp.height - h) / 2) });
            return;
        }
        const fit = Math.min((vp.width - 16) / 384, (vp.height - 16) / 812);
        const scale = floating ? Math.max(0.5, Math.min(1.12, fit, Number(settings.scale) || 0.86)) : 1;
        shellEl.style.setProperty('--mp-scale', String(scale));
        if (floating) {
            const w = 384 * scale;
            const h = 812 * scale;
            const maxX = Math.max(0, (vp.width - w) / 2);
            const maxY = Math.max(0, (vp.height - h) / 2);
            const rawX = Number(settings.pos?.x) || 0;
            const rawY = Number(settings.pos?.y) || 0;
            const pos = { x: Math.abs(rawX) > maxX ? 0 : rawX, y: Math.abs(rawY) > maxY ? 0 : rawY };
            settings.pos = pos;
            shellEl.style.setProperty('--mp-x', pos.x + 'px');
            shellEl.style.setProperty('--mp-y', pos.y + 'px');
            paintFloat(scale, pos);
        } else {
            shellEl.style.setProperty('--mp-x', '0px');
            shellEl.style.setProperty('--mp-y', '0px');
            for (const prop of ['left', 'top', 'right', 'bottom', 'transform', 'transform-origin']) {
                shellEl.style.removeProperty(prop);
            }
        }
        return;
    }
    for (const prop of ['left', 'top', 'right', 'bottom', 'transform', 'transform-origin']) {
        shellEl.style.removeProperty(prop);
    }
    const h = Math.max(560, window.innerHeight - 36);
    const fit = Math.min(1, h / 832);
    const scale = Math.max(0.5, Math.min(1.7, fit * (settings.scale || 1)));
    shellEl.style.setProperty('--mp-scale', String(scale));
    const pos = settings.pos || { x: 0, y: 0 };
    shellEl.style.setProperty('--mp-x', (pos.x || 0) + 'px');
    shellEl.style.setProperty('--mp-y', (pos.y || 0) + 'px');
    requestAnimationFrame(() => clampIntoView());
}

function clampIntoView() {
    if (!shellEl || (isNarrow() && !document.documentElement.classList.contains('mp-mobile-float')) || shellEl.classList.contains('is-full')) return;
    const rect = shellEl.getBoundingClientRect();
    const settings = getSettings();
    const pos = { x: settings.pos?.x || 0, y: settings.pos?.y || 0 };
    let dx = 0;
    let dy = 0;
    if (rect.left < 8) dx = 8 - rect.left;
    if (rect.right > window.innerWidth - 8) dx = window.innerWidth - 8 - rect.right;
    if (rect.top < 8) dy = 8 - rect.top;
    if (rect.bottom > window.innerHeight - 8) dy = window.innerHeight - 8 - rect.bottom;
    if (!dx && !dy) return;
    pos.x += dx;
    pos.y += dy;
    shellEl.style.setProperty('--mp-x', pos.x + 'px');
    shellEl.style.setProperty('--mp-y', pos.y + 'px');
    settings.pos = pos;
}

/* --------------------------------- 拖拽 --------------------------------- */

function toggleFloatMode() {
    try {
        const on = globalThis.localStorage?.getItem('mirage_mobile_float') === '1';
        const next = !on;
        globalThis.localStorage?.setItem('mirage_mobile_float', next ? '1' : '0');
        document.documentElement.classList.toggle('mp-mobile-float', next);
        if (next) {
            const current = getSettings();
            current.pos = { x: 0, y: 0 };
            current.scale = Math.min(Number(current.scale) || 0.86, 0.86);
            saveNow('settings');
        }
        applyLayout();
        toast(next ? '悬浮窗模式' : '全屏模式');
    } catch { /* ignore */ }
}

function bindDrag(device) {
    let drag = null;
    let pinch = null;
    let frame = 0;
    let last = null;

    const clampPos = (x, y, scale) => {
        const rect = device.getBoundingClientRect();
        const vp = viewportMetrics();
        const w = rect.width;
        const h = rect.height;
        const margin = 18;
        const maxX = Math.max(0, (vp.width - w) / 2);
        const maxY = Math.max(0, (vp.height - h) / 2);
        return {
            x: Math.max(-maxX + margin, Math.min(maxX - margin, x)),
            y: Math.max(-maxY + margin, Math.min(maxY - margin, y)),
        };
    };

    const applyPos = (x, y) => {
        const settings = getSettings();
        const floating = document.documentElement.classList.contains('mp-mobile-float');
        if (!floating) return;
        const scale = Number(getComputedStyle(shellEl).getPropertyValue('--mp-scale')) || 0.82;
        const clamped = clampPos(x, y, scale);
        settings.pos = clamped;
        paintFloat(scale, clamped);
    };

    const stopInertia = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };

    const inertia = () => {
        if (!last) return;
        let { vx, vy, x, y } = last;
        last = null;
        const tick = () => {
            vx *= 0.93;
            vy *= 0.93;
            x += vx;
            y += vy;
            applyPos(x, y);
            if (Math.abs(vx) > 0.2 || Math.abs(vy) > 0.2) frame = requestAnimationFrame(tick);
            else { frame = 0; saveNow('settings'); }
        };
        frame = requestAnimationFrame(tick);
    };

    device.addEventListener('pointerdown', event => {
        if (event.pointerType === 'touch') {
            const points = device.__mpPoints || (device.__mpPoints = new Map());
            points.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (points.size === 2) {
                const [a, b] = [...points.values()];
                pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: Number(getSettings().scale) || 0.82 };
                drag = null;
                shellEl.classList.add('is-dragging');
                stopInertia();
                return;
            }
        }
        if (event.button !== 0) return;
        if (event.target.closest('button, input, textarea, .mp-island')) return;
        const rect = device.getBoundingClientRect();
        const edge = event.clientX < rect.left + 20 || event.clientX > rect.right - 20 || event.clientY > rect.bottom - 24;
        if (event.clientY - rect.top > 60 && !edge) return;
        const settings = getSettings();
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, bx: Number(settings.pos?.x) || 0, by: Number(settings.pos?.y) || 0, t: performance.now(), vx: 0, vy: 0 };
        shellEl.classList.add('is-dragging');
        device.setPointerCapture?.(event.pointerId);
    });

    window.addEventListener('pointermove', event => {
        if (pinch && device.__mpPoints?.has(event.pointerId)) {
            device.__mpPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const points = [...device.__mpPoints.values()];
            if (points.length >= 2) {
                const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
                if (pinch.dist > 8) {
                    getSettings().scale = Math.max(0.38, Math.min(1.12, pinch.scale * (dist / pinch.dist)));
                    scheduleLayout();
                }
                event.preventDefault();
            }
            return;
        }
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) < 2) return;
        const now = performance.now();
        const dt = Math.max(1, now - drag.t);
        drag.vx = dx / dt * 16;
        drag.vy = dy / dt * 16;
        drag.t = now;
        const settings = getSettings();
        applyPos(drag.bx + dx, drag.by + dy);
        last = { vx: drag.vx, vy: drag.vy, x: Number(settings.pos?.x) || 0, y: Number(settings.pos?.y) || 0 };
        event.preventDefault();
    }, { passive: false });

    const finish = event => {
        if (event?.pointerType === 'touch' && device.__mpPoints) {
            device.__mpPoints.delete(event.pointerId);
            if (device.__mpPoints.size < 2) { pinch = null; shellEl.classList.remove('is-dragging'); }
        }
        if (!drag || (event && event.pointerId !== drag.id)) return;
        drag = null;
        shellEl.classList.remove('is-dragging');
        if (last) inertia();
        saveNow('settings');
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);

    const handle = h('button', { type: 'button', class: 'mp-resize', 'aria-label': '缩放' });
    device.appendChild(handle);
    let resize = null;
    const startResize = (edge, event) => {
        event.preventDefault();
        event.stopPropagation();
        resize = { edge, x: event.clientX, y: event.clientY, scale: getSettings().scale || 1 };
        shellEl.classList.add('is-dragging');
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    handle.addEventListener('pointerdown', event => startResize('corner', event));
    for (const edge of ['left', 'right', 'bottom']) {
        const bar = h('div', { class: 'mp-edge mp-edge--' + edge, 'aria-hidden': 'true' });
        bar.addEventListener('pointerdown', event => startResize(edge, event));
        device.appendChild(bar);
    }
    window.addEventListener('pointermove', event => {
        if (!resize) return;
        const dx = event.clientX - resize.x;
        const dy = event.clientY - resize.y;
        let delta = 0;
        if (resize.edge === 'right') delta = dx;
        else if (resize.edge === 'left') delta = -dx;
        else if (resize.edge === 'bottom') delta = dy;
        else delta = (dx + dy) / 1.5;
        getSettings().scale = Math.max(0.38, Math.min(1.12, resize.scale + delta / 240));
        scheduleLayout();
        event.preventDefault();
    }, { passive: false });
    window.addEventListener('pointerup', () => {
        if (!resize) return;
        resize = null;
        shellEl.classList.remove('is-dragging');
        saveNow('settings');
    });

    shellEl.addEventListener('click', event => {
        if (event.target === shellEl && shellEl.classList.contains('is-full')) toggleFull();
    });
}

function toggleFull() {
    shellEl.classList.toggle('is-full');
    applyLayout();
    saveNow('settings');
}

/* --------------------------------- 打开/关闭 --------------------------------- */

export function openPhone(app = 'home', params = {}) {
    if (!shellEl) return;
    if (getSettings().enabled === false) {
        rawToast('小手机在「扩展设置」里被关掉了');
        return;
    }
    open = true;
    globalThis.__mpIslandToast = true;
    try { document.body.appendChild(rootEl); } catch { /* ignore */ }
    hideOtherFloaters(true);
    shellEl.classList.remove('is-closed');
    if (isNarrow()) {
        const settings = getSettings();
        settings.pos = { x: 0, y: 0 };
    }
    applyLayout();
    setFab(true);
    syncFabPosition();
    if (!clockTimer) clockTimer = setInterval(tick, 15000);
    if (app !== 'home') {
        openApp(app, params);
    } else {
        clearCurrent();
        screenEl.classList.add('is-home');
        refreshHome();
    }
    onOpenChanged(true);
    haptic(6);
}

function clearCurrent() {
    if (!current) return;
    current.view?.destroy?.();
    current.el?.remove();
    current = null;
}

export function closePhone() {
    if (!shellEl) return;
    open = false;
    globalThis.__mpIslandToast = false;
    shellEl.classList.add('is-closed');
    hideOtherFloaters(false);
    setFab(false);
    syncFabPosition();
    clearInterval(clockTimer);
    clockTimer = 0;
    onOpenChanged(false);
    if (isLite()) {
        setTimeout(() => {
            if (open) return;
            try { current?.view?.destroy?.(); } catch { /* ignore */ }
            current?.el?.remove();
            current = null;
            screenEl?.classList.add('is-home');
        }, 320);
    }
}

function setFab(isOpen) {
    if (!fabEl) return;
    const narrow = isNarrow();
    fabEl.classList.toggle('is-hidden', isOpen && !narrow);
    fabEl.classList.toggle('is-open', isOpen && narrow);
    const next = icon(isOpen && narrow ? 'down' : 'phone', 'mp-fab__icon');
    const old = fabEl.querySelector('.mp-ic');
    if (old) old.replaceWith(next);
    fabEl.setAttribute('aria-label', isOpen ? '收起小手机' : '打开小手机');
}

export function toggle() {
    if (open) closePhone();
    else openPhone();
}

function hideOtherFloaters(hide) {
    try {
        const list = document.querySelectorAll('#cd-fab, .cd-fab');
        for (const el of list) {
            if (hide) {
                if (!el.dataset.mpWasHidden) el.dataset.mpWasHidden = el.style.display || '1';
                el.style.setProperty('display', 'none', 'important');
            } else if (el.dataset.mpWasHidden) {
                el.style.removeProperty('display');
                delete el.dataset.mpWasHidden;
            }
        }
    } catch { /* ignore */ }
}

function onOpenChanged(value) {
    try { openListener?.(value); } catch (error) { console.warn('[幻镜手机] onOpenChange', error); }
    try { apiEvents.forEach(fn => fn(value)); } catch { /* ignore */ }
}

const apiEvents = new Set();
export function onPhoneToggle(fn) {
    apiEvents.add(fn);
    return () => apiEvents.delete(fn);
}

/* --------------------------------- 路由 --------------------------------- */

function setChrome(mode = 'dark') {
    screenEl?.classList.toggle('is-light-ui', mode === 'light');
}

function openApp(id, params = {}) {
    const def = APPS[id];
    if (!def) return;
    if (!open) openPhone('home');
    setChrome('dark');

    if (current) {
        current.view?.destroy?.();
        current.el?.remove();
    }
    screenEl.classList.remove('is-home');
    const el = h('div', { class: 'mp-app', 'data-app': id });
    el.appendChild(h('div', { class: 'mp-app__bg', 'data-wall': 'blur' }));
    viewEl.appendChild(el);
    const navApi = makeNav();
    let view;
    try {
        view = def.mount(el, { nav: navApi, params }) || {};
    } catch (error) {
        console.error('[幻镜手机] App 打开失败', id, error);
        el.remove();
        screenEl.classList.add('is-home');
        refreshHome();
        rawToast('这个 App 出错了，已返回桌面');
        return;
    }
    const hasOwnBack = !!el.querySelector('[aria-label="返回"], .mp-nav__btn, .mp-as__back, .mp-br__icon, .mp-tt__back, .mp-xhs__back, .mp-bl__back, .mp-back');
    if (id !== 'home' && !hasOwnBack) {
        el.appendChild(h('button', { class: 'mp-backchip', type: 'button', 'aria-label': '返回', onclick: () => goBack() }, icon('back')));
    }
    current = { id, params, el, view };
    if (id === 'chat' && params.threadId) markRead(params.threadId);
    refreshBadges();
}

function goHome() {
    screenEl?.classList.add('is-home');
    screenEl?.classList.add('is-returning');
    setTimeout(() => screenEl?.classList.remove('is-returning'), 460);
    setChrome('dark');
    if (!current) { refreshHome(); return; }
    const el = current.el;
    current.view?.destroy?.();
    current = null;
    el.classList.add('is-closing');
    setTimeout(() => el.remove(), 240);
    refreshHome();
    refreshBadges();
}

function goBack() {
    if (!current) return;
    if (current.id === 'chat' && current.params?.threadId) {
        openApp('chat');
        return;
    }
    goHome();
}

function refreshHome() {
    homeView?.refresh?.();
    applyWallpaper();
}

export function refreshAll() {
    refreshHome();
    current?.view?.refresh?.();
    refreshBadges();
}

function makeNav() {
    return {
        go: openApp,
        back: goBack,
        home: goHome,
        refresh: () => current?.view?.refresh?.(),
        toast: (text, ms) => rawToast(text, ms),
        openThread: threadId => openApp('chat', { threadId }),
        openMoments: () => openApp('moments'),
        toggleFloat: toggleFloatMode,
    isOpen: () => open,
        refreshAll,
        close: closePhone,
        applyTheme: refreshTheme,
        confirm: confirmSheet,
        sheet,
        haptic,
        setChrome,
    };
}

/* --------------------------------- 状态栏 --------------------------------- */

function tick() {
    if (!refs.statusTime) return;
    const now = new Date();
    refs.statusTime.textContent = clockText(now);
    if (islandEl.classList.contains('is-typing')) {
        refs.islandText.textContent = '正在输入' + '…';
    }
}

async function initBattery() {
    try {
        const battery = await navigator.getBattery?.();
        if (!battery) return;
        const paint = () => {
            refs.battery.style.opacity = battery.level < 0.2 ? '0.5' : '1';
            refs.battery.setAttribute('title', Math.round(battery.level * 100) + '%');
        };
        paint();
        battery.addEventListener?.('levelchange', paint);
    } catch { /* ignore */ }
}

/* --------------------------------- 灵动岛 --------------------------------- */

let islandTimer = 0;

export function islandShow({ text = '', avatarSrc = '', typing = false } = {}) {
    if (!islandEl || !getSettings().island) return;
    clearTimeout(islandTimer);
    refs.islandInner.innerHTML = '';
    if (avatarSrc) {
        const box = h('span', { class: 'mp-island__avatar' }, h('img', { src: avatarSrc, alt: '' }));
        refs.islandInner.appendChild(box);
    } else if (typing) {
        refs.islandInner.appendChild(h('span', { class: 'mp-island__dots' }, h('i'), h('i'), h('i')));
    }
    refs.islandText = h('span', { class: 'mp-island__text', text });
    refs.islandInner.appendChild(refs.islandText);
    islandEl.classList.add('is-active');
    islandEl.classList.toggle('is-typing', typing);
    if (!typing) islandTimer = setTimeout(() => islandHide(), 3200);
}

export function islandHide() {
    if (!islandEl) return;
    clearTimeout(islandTimer);
    islandEl.classList.remove('is-active', 'is-typing');
    setTimeout(() => { if (!islandEl.classList.contains('is-active')) refs.islandInner.innerHTML = ''; }, 300);
}

export function setTyping(threadId, typing) {
    if (typing) typingThreads.add(threadId);
    else typingThreads.delete(threadId);
    current?.view?.setTyping?.(threadId, typing);
    if (typing && typingThreads.size) {
        const thread = findThread(threadId);
        islandShow({ text: (thread?.members?.[0] || '对方') + ' 正在输入', typing: true });
    } else if (!typingThreads.size) {
        islandHide();
    }
}

/* --------------------------------- 通知 --------------------------------- */

export function notify({ title = '', text = '', avatarSrc = '', threadId = null } = {}) {
    if (!shellEl) return;
    refreshBadges();
    if (!open) {
        fabEl.classList.add('is-ringing');
        setTimeout(() => fabEl.classList.remove('is-ringing'), 2600);
        islandShow({ text: title || '新消息', avatarSrc });
        return;
    }
    const inThread = current?.id === 'chat' && current.params?.threadId === threadId;
    if (inThread) return;

    bannerEl.innerHTML = '';
    bannerEl.append(
        avatar({ name: title, src: avatarSrc, size: 34 }),
        h('div', { class: 'mp-banner__body' },
            h('div', { class: 'mp-banner__title', text: title || '收到新消息' }),
            h('div', { class: 'mp-banner__text', text: text || '' })),
    );
    bannerEl.onclick = () => {
        hideBanner();
        if (threadId) openPhone('chat', { threadId });
        else openPhone();
    };
    bannerEl.classList.add('in');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideBanner, 4200);
    islandShow({ text: title || '新消息', avatarSrc });
}

function hideBanner() {
    clearTimeout(bannerTimer);
    bannerEl?.classList.remove('in');
}

/* --------------------------------- 角标 --------------------------------- */

export function refreshBadges() {
    if (!rootEl) return;
    const count = totalUnread(getData());
    refs.fabBadge.textContent = count > 99 ? '99+' : String(count);
    refs.fabBadge.classList.toggle('is-hide', count === 0);
    current?.view?.refreshBadges?.(count);
}

/* --------------------------------- 其他 --------------------------------- */

function onVisibility() {
    if (document.visibilityState === 'hidden') {
        try { saveNow('data'); } catch { /* ignore */ }
    }
}

export function setEnabled(value) {
    if (!rootEl) return;
    if (!value) closePhone();
    rootEl.style.display = value ? '' : 'none';
    fabEl.classList.toggle('is-hidden', value ? open : true);
}

export function destroyPhone() {
    clearInterval(clockTimer);
    clearTimeout(bannerTimer);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    themeMedia?.removeEventListener?.('change', applyThemeVars.bind(null, rootEl, getSettings()));
    current?.view?.destroy?.();
    rootEl?.remove();
    rootEl = null;
    shellEl = null;
    current = null;
}

const api = {
    open: openPhone,
    close: closePhone,
    toggle,
    toggleFloat: toggleFloatMode,
    go: openApp,
    home: goHome,
    back: goBack,
    notify,
    refresh: refreshAll,
    refreshTheme,
    setTyping,
    islandShow,
    islandHide,
    refreshBadges,
    setEnabled,
    isOpen: () => open,
    destroy: destroyPhone,
};

/* 主屏 / 应用变化时保持同步 */
onChange(kind => {
    if (!rootEl) return;
    if (kind === 'badges') {
        refreshBadges();
        return;
    }
    if (kind === 'data' || kind === 'init') {
        refreshBadges();
        homeView?.refresh?.();
        if (current?.id === 'chat' && !typingThreads.size) current.view?.refresh?.();
    }
    if (kind === 'settings') {
        refreshTheme();
        homeView?.refresh?.();
    }
});