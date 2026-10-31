/**
 * 幻镜手机 · Mirage Phone
 * SillyTavern 第三方扩展入口：挂载手机、接事件、注入手机状态、生成扩展设置面板。
 */
import { ctx, subscribe, toast, characterAvatar, chatId, currentCharacter, memoryContext, importantStoryContext } from './src/st.js';
import {
    initStore, getSettings, getData, onChange, saveNow, flushSave, findThread,
} from './src/store.js';
import { ACCENTS } from './src/state.js';
import { createPhone, openPhone, refreshTheme } from './src/phone.js';
import { avatarUrl } from './src/avatars.js';
import { aiEvents, runProactive, refreshInjection, isBusy } from './src/ai.js';

let bootErrorTimer = 0;
function showBootError(message) {
    try {
        let box = document.getElementById('mp-boot-error');
        if (!box) {
            box = document.createElement('div');
            box.id = 'mp-boot-error';
            box.style.cssText = 'position:fixed;left:12px;top:12px;z-index:2147483000;max-width:420px;background:#7a1f2b;color:#fff;font:12px/1.5 system-ui;padding:10px 12px;border-radius:10px;box-shadow:0 8px 24px #0007;white-space:pre-wrap;cursor:pointer;';
            box.title = '点击关闭';
            box.addEventListener('click', () => box.remove());
            document.body.appendChild(box);
        }
        box.textContent = '幻镜手机出错：' + message;
        clearTimeout(bootErrorTimer);
        bootErrorTimer = setTimeout(() => { try { box.remove(); } catch { /* ignore */ } }, 6000);
    } catch { /* ignore */ }
}

window.addEventListener('error', event => {
    const file = String(event.filename || '');
    const stack = String(event.error?.stack || '');
    if (!file.includes('st-mirage-phone') && !stack.includes('st-mirage-phone')) return;
    showBootError(event.message || '未知错误');
});
window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    const text = String(reason?.message || reason || '');
    const stack = String(reason?.stack || '');
    // 只报告来自本扩展的错误；别的扩展 / 酒馆内部的异常不要显示成「幻镜手机出错」
    if (!stack.includes('st-mirage-phone')) {
        console.warn('[幻镜手机] 忽略外部异常', reason);
        return;
    }
    if (text) showBootError(text);
});

const VERSION = '1.5.10';
let phone = null;
let started = false;
let panel = null;
const panelRefs = { theme: null, accent: null, rounds: null };
let proactiveTimer = 0;
let proactiveRounds = 0;
let lastChatId = '';
let chatSyncTimer = 0;
let chatSyncToken = 0;
let injectTimer = 0;

/* --------------------------------- 启动 --------------------------------- */

function boot() {
    if (started) return;
    const context = ctx();
    if (!context || !document.body) {
        setTimeout(boot, 260);
        return;
    }
    started = true;
    initStore();
    // 「我」页显示的版本号跟着 manifest 走，别一直停在旧版本
    if (getSettings().version !== VERSION) {
        getSettings().version = VERSION;
        saveNow('settings');
    }
    globalThis.__mpAvatarUrl = name => avatarUrl(name);
    globalThis.__mpArtPack = getSettings().artPack !== false;
    globalThis.__mpRealPhotos = getSettings().realPhotos !== false;
    lastChatId = chatId();
    ensureCity();
    phone = createPhone(openState => {
        const settings = getSettings();
        settings.collapsed = !openState;
        saveNow('settings');
        syncPanel();
    });
    if (getSettings().enabled === false) phone.setEnabled(false);
    buildSettingsPanel();
    addMenuEntry();
    watchMenu();
    wireEvents();
    refreshInjection();
    console.info('[幻镜手机] v' + VERSION + ' 已加载');
}

/* --------------------------------- 事件 --------------------------------- */

function syncChatState() {
    initStore();
    refreshInjection();
    phone?.refresh();
    phone?.refreshBadges();
    syncPanel();
    ensureCity();
}

function scheduleChatSync() {
    clearTimeout(chatSyncTimer);
    const token = ++chatSyncToken;
    const startedAt = chatId();
    chatSyncTimer = setTimeout(() => {
        if (token !== chatSyncToken) return;
        syncChatState();
        lastChatId = chatId();
        // 酒馆切换聊天时 chatMetadata 可能晚一拍，再补一次
        if (lastChatId !== startedAt) setTimeout(() => { if (token === chatSyncToken) syncChatState(); }, 500);
    }, 180);
}

function ensureCity() {
    try {
        const data = getData();
        const card = currentCharacter();
        if (!data?.meta) return;
        if (data.meta.cityManual) return;
        const memory = memoryContext(6).map(item => item.text);
        const story = importantStoryContext(10, 420).map(item => item.text);
        const sample = [card?.scenario, card?.description, ...memory, ...story].join('\n');
        const match = sample.match(/([\u4e00-\u9fa5]{2,4})(?:市|城|镇|村|区|县)/);
        if (match?.[1] && match[1] !== data.meta.city) {
            data.meta.city = match[1];
            saveNow('data');
        }
    } catch { /* ignore */ }
}

function wireEvents() {
    for (const eventName of ['CHAT_CHANGED', 'CHARACTER_CHANGED', 'CHAT_LOADED', 'GROUP_UPDATED']) {
        subscribe(eventName, () => scheduleChatSync());
    }
    subscribe('MESSAGE_RECEIVED', () => {
        refreshInjection();
        try {
            const c = ctx();
            const last = c?.chat?.[c.chat.length - 1];
            if (last && !last.is_user) proactiveRounds += 1;
        } catch { /* ignore */ }
        scheduleProactive();
        phone.refreshBadges();
    });
    subscribe('GENERATION_STARTED', () => refreshInjection());
    subscribe('CHARACTER_MESSAGE_RENDERED', () => phone?.refreshBadges());

    aiEvents.addEventListener('typing', event => {
        const { threadId, typing } = event.detail || {};
        if (!threadId) return;
        phone?.setTyping(threadId, typing);
    });

    aiEvents.addEventListener('reply', event => {
        const { threadId, messages } = event.detail || {};
        if (!messages?.length) return;
        const thread = findThread(threadId);
        const last = messages[messages.length - 1];
        const title = thread?.members?.[0] || '新消息';
        const preview = last.type === 'voice' ? '[语音]' : last.type === 'photo' ? '[图片]' : last.text;
        phone?.notify({
            title,
            text: String(preview || '').slice(0, 60),
            avatarSrc: characterAvatar(title),
            threadId,
        });
        phone?.refreshBadges();
    });

    onChange(kind => {
        if (kind === 'settings') syncPanel();
        if (kind === 'data') {
            clearTimeout(injectTimer);
            injectTimer = setTimeout(() => {
                refreshInjection();
                phone?.refreshBadges();
            }, 700);
        }
    });

    window.addEventListener('beforeunload', () => {
        try { flushSave(); } catch { /* ignore */ }
    });

    document.addEventListener('keydown', event => {
        if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'p') {
            const target = event.target;
            if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            event.preventDefault();
            phone?.toggle();
        }
    });
}

function scheduleProactive() {
    const settings = getSettings();
    if (!settings.proactive.enabled) return;
    const need = Math.max(1, Math.min(20, Number(settings.proactive.rounds) || 1));
    if (proactiveRounds < need) return;
    clearTimeout(proactiveTimer);
    proactiveTimer = setTimeout(async () => {
        if (isBusy()) return;
        proactiveRounds = 0;
        const result = await runProactive();
        if (result) {
            const thread = findThread(result.threadId);
            phone?.refreshBadges();
            if (!thread?.unread) return;
        }
    }, 1600);
}

/* ------------------------------ 扩展设置面板 ------------------------------ */

function buildSettingsPanel() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) {
        setTimeout(buildSettingsPanel, 500);
        return;
    }
    document.getElementById('mp_st_panel')?.remove();

    const settings = getSettings();
    const root = document.createElement('div');
    root.className = 'inline-drawer mp-st-panel';
    root.id = 'mp_st_panel';

    const content = document.createElement('div');
    content.className = 'inline-drawer-content mp-st-content';

    const head = document.createElement('div');
    head.className = 'inline-drawer-toggle inline-drawer-header';
    const title = document.createElement('b');
    title.className = 'mp-st-title';
    title.textContent = '幻镜手机 · Mirage Phone';
    const badge = document.createElement('span');
    badge.className = 'mp-st-badge';
    badge.textContent = 'v' + VERSION;
    const chevron = document.createElement('div');
    chevron.className = 'inline-drawer-icon fa-solid fa-circle-chevron-down down';
    head.append(title, badge, chevron);
    root.append(head, content);

    const hint = document.createElement('div');
    hint.className = 'mp-st-hint';
    hint.textContent = '点右下角手机图标，或输入框左边的魔杖菜单「小手机」。Alt+P 也能打开，手机里右上角可以关闭。';
    content.appendChild(hint);

    const enabled = checkRow('启用小手机', settings.enabled, value => {
        getSettings().enabled = value;
        saveNow('settings');
        phone?.setEnabled(value);
        syncPanel();
    });
    const inject = checkRow('把手机消息带进正文', settings.inject.enabled, value => {
        getSettings().inject.enabled = value;
        saveNow('settings');
        refreshInjection();
    });
    const proactive = checkRow('剧情后主动来信', settings.proactive.enabled, value => {
        getSettings().proactive.enabled = value;
        saveNow('settings');
        syncPanel();
    });
    const hideFab = checkRow('隐藏悬浮球（用魔杖打开）', settings.hideFab, value => {
        getSettings().hideFab = value;
        saveNow('settings');
        phone?.refreshFab?.();
    });

    const roundsRow = document.createElement('div');
    roundsRow.className = 'mp-st-row';
    const roundsLabel = document.createElement('label');
    roundsLabel.textContent = '几轮剧情后主动来信';
    const roundsSelect = document.createElement('select');
    roundsSelect.className = 'text_pole';
    for (let i = 1; i <= 10; i++) {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = i + ' 轮';
        option.selected = (Number(settings.proactive.rounds) || 1) === i;
        roundsSelect.appendChild(option);
    }
    roundsSelect.addEventListener('change', () => {
        getSettings().proactive.rounds = Number(roundsSelect.value) || 1;
        proactiveRounds = 0;
        saveNow('settings');
    });
    roundsRow.append(roundsLabel, roundsSelect);
    panelRefs.rounds = roundsSelect;

    panelRefs.theme = null;
    panelRefs.accent = null;

    const themeRow = document.createElement('div');
    themeRow.className = 'mp-st-row';
    const themeLabel = document.createElement('label');
    themeLabel.textContent = '主题';
    const themeSelect = document.createElement('select');
    themeSelect.className = 'text_pole';
    for (const [value, label] of [['auto', '跟随系统'], ['dark', '深色'], ['light', '浅色']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = settings.theme === value;
        themeSelect.appendChild(option);
    }
    themeSelect.addEventListener('change', () => {
        getSettings().theme = themeSelect.value;
        saveNow('settings');
        refreshTheme();
    });
    panelRefs.theme = themeSelect;
    themeRow.append(themeLabel, themeSelect);

    const accentRow = document.createElement('div');
    accentRow.className = 'mp-st-row';
    const accentLabel = document.createElement('label');
    accentLabel.textContent = '强调色';
    const accentSelect = document.createElement('select');
    accentSelect.className = 'text_pole';
    for (const [value, accent] of Object.entries(ACCENTS)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = accent.name;
        option.selected = settings.accent === value;
        accentSelect.appendChild(option);
    }
    accentSelect.addEventListener('change', () => {
        getSettings().accent = accentSelect.value;
        saveNow('settings');
        refreshTheme();
    });
    panelRefs.accent = accentSelect;
    accentRow.append(accentLabel, accentSelect);

    const actions = document.createElement('div');
    actions.className = 'mp-st-actions';
    const openBtn = document.createElement('button');
    openBtn.className = 'menu_button';
    openBtn.id = 'mp_st_open';
    openBtn.textContent = '打开小手机';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'menu_button';
    clearBtn.textContent = '清空数据';
    clearBtn.addEventListener('click', async () => {
        let ok = false;
        if (typeof globalThis.callGenericPopup === 'function') {
            const result = await globalThis.callGenericPopup('清空当前聊天的手机数据？聊天、朋友圈、备忘都会消失，酒馆正文不受影响。', 2);
            ok = result === 1 || result === true;
        } else {
            ok = globalThis.confirm?.('清空当前聊天的手机数据？') === true;
        }
        if (ok) {
            const { resetData } = await import('./src/store.js');
            resetData();
            phone?.refresh();
            toast('已经清空');
        }
    });
    actions.append(openBtn, clearBtn);

    content.append(enabled, inject, proactive, hideFab, roundsRow, themeRow, accentRow, actions);
    host.appendChild(root);
    panel = root;
    syncPanel();
}

function checkRow(label, checked, onChangeValue) {
    const row = document.createElement('label');
    row.className = 'mp-st-row';
    row.style.cursor = 'pointer';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    input.addEventListener('change', event => { event.stopPropagation(); onChangeValue(input.checked); });
    input.style.pointerEvents = 'auto';
    const span = document.createElement('span');
    span.textContent = label;
    row.append(input, span);
    row.addEventListener('click', event => {
        if (event.target === input) return;
        event.preventDefault();
        input.checked = !input.checked;
        onChangeValue(input.checked);
    });
    return row;
}

function syncPanel() {
    const settings = getSettings();
    const openBtn = document.getElementById('mp_st_open');
    if (panelRefs.theme) panelRefs.theme.value = settings.theme;
    if (panelRefs.accent) panelRefs.accent.value = settings.accent;
    if (openBtn) openBtn.textContent = phone?.isOpen?.() ? '收起小手机' : '打开小手机';
    if (openBtn) openBtn.onclick = () => {
        if (phone?.isOpen?.()) { phone.close(); return; }
        const current = getSettings();
        if (current.enabled === false) {
            current.enabled = true;
            saveNow('settings');
            phone?.setEnabled(true);
        }
        openPhone();
    };
    if (panel) {
        const boxes = panel.querySelectorAll('input[type="checkbox"]');
        if (boxes[0]) boxes[0].checked = settings.enabled;
        if (boxes[1]) boxes[1].checked = settings.inject.enabled;
        if (boxes[2]) boxes[2].checked = settings.proactive.enabled;
        if (boxes[3]) boxes[3].checked = settings.hideFab;
        if (panelRefs.rounds) panelRefs.rounds.value = String(Number(settings.proactive.rounds) || 1);
    }
}

/* -------------------------------- 魔杖菜单 -------------------------------- */

let menuObserver = null;
function addMenuEntry(attempt = 0) {
    const menu = document.getElementById('extensionsMenu');
    if (!menu) {
        if (attempt < 40) setTimeout(() => addMenuEntry(attempt + 1), 500);
        return;
    }
    if (!document.getElementById('mp_menu_item')) {
        const item = document.createElement('div');
        item.id = 'mp_menu_item';
        item.className = 'list-group-item flex-container flexGap5 interactable';
        item.tabIndex = 0;
        item.title = '打开小手机';
        item.style.display = 'flex';
        item.innerHTML = '<div class="fa-solid fa-mobile-screen extensionsMenuExtensionButton"></div><span>小手机</span>';
        item.addEventListener('click', () => openPhone());
        item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPhone(); } });
        menu.appendChild(item);
    }
    // 魔杖菜单按钮在“没有任何菜单项”时会被酒馆隐藏；补一个可见项后强制显示
    try { globalThis.jQuery?.('#extensionsMenuButton').css('display', 'flex'); } catch { /* ignore */ }
    try { menuObserver?.disconnect(); } catch { /* ignore */ }
    menuObserver = null;
}

function watchMenu() {
    if (document.getElementById('mp_menu_item')) return;
    if (typeof MutationObserver !== 'function') return;
    menuObserver = new MutationObserver(() => {
        if (document.getElementById('extensionsMenu')) addMenuEntry(0);
    });
    menuObserver.observe(document.body, { childList: true, subtree: true });
}

/* --------------------------------- 入口 --------------------------------- */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}

// 酒馆初始化完成后补一次（聊天可能还没载入）
subscribe('APP_READY', () => {
    if (!started) boot();
    else {
        initStore();
        refreshInjection();
        phone?.refresh();
        syncPanel();
    }
});

globalThis.MiragePhone = {
    version: VERSION,
    open: () => openPhone(),
    close: () => phone?.close(),
    toggle: () => phone?.toggle(),
    openApp: (id, params) => phone?.go(id, params),
    go: (id, params) => phone?.go(id, params),
    home: () => phone?.home(),
    toggleFloat: () => phone?.toggleFloat?.(),
    refresh: () => phone?.refresh(),
    get data() { return getData(); },
    get settings() { return getSettings(); },
};