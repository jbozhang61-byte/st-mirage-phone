/**
 * 主屏：大时钟、最近消息、应用网格、底部 Dock。
 */
import { h, icon, avatar, clockText, weekdayText, relativeText, sheet, toast } from '../render.js';
import { getCast, getData, getSettings, saveNow } from '../store.js';
import { totalUnread } from '../state.js';
import { characterAvatar, currentCharacter, storyContext } from '../st.js';
import { buildWeather, weatherLine } from '../weather.js';
import { CORE_APPS, installedAppMeta } from '../app-meta.js';

const DOCK = ['chat', 'contacts', 'moments', 'me'];

export function mountHome(host, { nav }) {
    let timeEl = null;
    let draggedAt = 0;
    let editing = false;
    let dateEl = null;

    function render() {
        const data = getData();
        const settings = getSettings();
        const story = storyContext(2, 260);
        const weather = buildWeather({
            city: data.meta.city || '此间',
            storyText: story.map(s => s.text).join(' '),
        });
        const unread = totalUnread(data);
        const latest = [...data.threads].filter(t => t.msgs.length).sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
        const newMoments = hasNewMoments(data);

        host.innerHTML = '';

        const scroll = h('div', { class: 'mp-home__scroll' });

        timeEl = h('div', { class: 'mp-clock__time', text: clockText() });
        dateEl = h('div', { class: 'mp-clock__date' },
            h('span', { text: (new Date().getMonth() + 1) + '月' + new Date().getDate() + '日 周' + weekdayText() }),
            h('i', { class: 'dot' }),
            h('span', { text: weatherLine(weather) }),
        );
        scroll.appendChild(h('div', { class: 'mp-home__clock' }, timeEl, dateEl));

        // 最近消息 / 引导
        if (latest) {
            const msg = latest.msgs[latest.msgs.length - 1];
            const preview = previewText(msg) || '（空）';
            const from = msg.from === 'me' ? '你：' : '';
            scroll.appendChild(h('div', {
                class: 'mp-glance',
                onclick: () => nav.go('chat', { threadId: latest.id }),
            },
                avatar({ name: latest.members[0], src: characterAvatar(latest.members[0]), size: 40, cls: 'mp-glance__avatar' }),
                h('div', { class: 'mp-glance__main' },
                    h('div', { class: 'mp-glance__top' }, icon('message'), h('span', { text: '最近的手机消息' }), h('span', { style: { marginLeft: 'auto' }, text: relativeText(msg.ts) })),
                    h('div', { class: 'mp-glance__text' }, h('b', { text: latest.members.join('、') + '　' }), from + preview),
                    h('div', { class: 'mp-glance__time', text: latest.unread ? latest.unread + ' 条未读' : '点一下继续聊' }),
                ),
            ));
        } else {
            scroll.appendChild(h('div', {
                class: 'mp-glance',
                onclick: () => nav.go('contacts'),
            },
                h('div', { class: 'mp-glance__main' },
                    h('div', { class: 'mp-glance__top' }, icon('sparkle'), h('span', { text: '还没有人给你发消息' })),
                    h('div', { class: 'mp-glance__text', text: '去通讯录挑一个人，开始第一段手机上的对话。' }),
                    h('div', { class: 'mp-glance__time', text: currentCharacter()?.name ? '当前角色：' + currentCharacter().name : '选择角色' }),
                ),
            ));
        }

        // 应用网格：系统 App + 应用商店里装上的
        const apps = [...CORE_APPS, ...installedAppMeta(settings.apps || [])];
        const grid = h('div', { class: 'mp-appgrid' + (editing ? ' is-editing' : '') });
        scroll.appendChild(h('div', { class: 'mp-home__editbar' },
            h('span', { text: editing ? '拖动图标排序，松手完成' : '桌面' }),
            h('button', {
                type: 'button', class: 'mp-home__editbtn',
                text: editing ? '完成' : '编辑',
                onclick: () => { editing = !editing; render(); },
            }),
        ));
        const entries = buildEntries(apps);
        for (const entry of entries) {
            if (entry.type === 'folder') {
                grid.appendChild(folderIcon(entry.folder, nav));
                continue;
            }
            const badge = entry.app.id === 'chat' ? unread : (entry.app.id === 'moments' && newMoments ? -1 : 0);
            grid.appendChild(appIcon(entry.app, badge, nav));
        }
        scroll.appendChild(grid);

        // 天气小组件
        scroll.appendChild(h('div', { class: 'mp-widget-weather', 'data-w': weather.kind, onclick: () => nav.go('weather') },
            h('div', { class: 'mp-widget-weather__left' },
                h('div', { class: 'mp-widget-weather__city', text: weather.city }),
                h('div', { class: 'mp-widget-weather__temp', text: weather.temp + '°' }),
                h('div', { class: 'mp-widget-weather__cond', text: weather.name + ' · ' + weather.wind }),
            ),
            h('div', { class: 'mp-widget-weather__right' },
                icon(weather.icon, '', 42),
                h('div', { class: 'mp-widget-weather__range', text: weather.low + '° / ' + weather.high + '°' }),
            ),
        ));

        host.appendChild(scroll);

        // Dock
        const dock = h('div', { class: 'mp-home__dock' });
        for (const id of DOCK) {
            const app = apps.find(a => a.id === id);
            if (app) dock.appendChild(appIcon(app, id === 'chat' ? unread : 0, nav, true));
        }
        const search = h('button', {
            type: 'button', class: 'mp-home__search',
            onclick: () => openSearch(),
        }, icon('search'), h('span', { text: '搜索 App' }), h('span', { class: 'mp-home__search-mic' }, icon('mic')));
        host.appendChild(search);
        host.appendChild(dock);
    }

    function appIcon(app, badge, navApi, dock = false) {
        const glyph = h('span', { class: 'mp-appicon__glyph ' + app.cls }, icon(app.icon));
        if (badge > 0) glyph.appendChild(h('span', { class: 'mp-appicon__badge', text: badge > 99 ? '99+' : String(badge) }));
        else if (badge === -1) glyph.appendChild(h('span', { class: 'mp-appicon__badge is-dot' }));
        const button = h('button', {
            type: 'button',
            class: 'mp-appicon',
            onclick: () => {
                if (Date.now() - draggedAt < 300) return;
                if (editing) { draggedAt = Date.now(); openIconMenu(app.id); return; }
                if (app.id === 'float') {
                    globalThis.MiragePhone?.close?.();
                    toast('已最小化到悬浮球');
                    return;
                }
                navApi.haptic?.(5);
                navApi.go(app.id);
            },
            'aria-label': app.label,
        }, glyph, dock ? null : h('span', { class: 'mp-appicon__label', text: app.label }));
        if (!dock) {
            button.dataset.appid = app.id;
            bindDrag(button, app.id);
        }
        return button;
    }

    function layout() {
        const settings = getSettings();
        settings.home = settings.home || { order: [], folders: [] };
        settings.home.folders = Array.isArray(settings.home.folders) ? settings.home.folders : [];
        settings.home.order = Array.isArray(settings.home.order) ? settings.home.order : [];
        return settings.home;
    }

    function buildEntries(apps) {
        const layoutData = layout();
        const folders = layoutData.folders;
        const folderOf = new Map();
        for (const folder of folders) for (const id of folder.apps || []) folderOf.set(id, folder);
        const byId = new Map(apps.map(app => [app.id, app]));
        const entries = [];
        const seen = new Set();
        const pushApp = id => {
            if (seen.has(id) || seen.has('folder:' + id)) return;
            const app = byId.get(id);
            if (!app) return;
            const folder = folderOf.get(id);
            if (folder) {
                if (!seen.has('folder:' + folder.id)) { seen.add('folder:' + folder.id); entries.push({ type: 'folder', folder }); }
                return;
            }
            seen.add(id);
            entries.push({ type: 'app', app });
        };
        for (const id of layoutData.order) {
            if (String(id).startsWith('folder:')) {
                const folder = folders.find(item => 'folder:' + item.id === id);
                if (folder && !seen.has(id)) { seen.add(id); entries.push({ type: 'folder', folder }); }
            } else pushApp(id);
        }
        for (const app of apps) pushApp(app.id);
        for (const folder of folders) if (!seen.has('folder:' + folder.id)) { seen.add('folder:' + folder.id); entries.push({ type: 'folder', folder }); }
        return entries;
    }

    function persist() {
        const settings = getSettings();
        settings.home = settings.home || { order: [], folders: [] };
        const inFolder = new Set(settings.home.folders.flatMap(folder => folder.apps || []));
        settings.home.order = (settings.home.order || []).filter(id => !inFolder.has(id));
        saveNow('settings');
        render();
    }

    function bindDrag(el, id) {
        let start = null;
        let active = false;
        let armed = false;
        let ghost = null;
        let timer = 0;
        let hoverTimer = 0;
        let hoverTarget = null;

        const cleanup = () => {
            clearTimeout(timer);
            clearTimeout(hoverTimer);
            hoverTarget?.classList.remove('is-drop-target');
            hoverTarget = null;
            el.classList.remove('is-dragging', 'is-armed');
            ghost?.remove();
            ghost = null;
            armed = false;
        };

        el.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            start = { x: event.clientX, y: event.clientY };
            active = false;
            armed = false;
            el.setPointerCapture?.(event.pointerId);
            // 长按 5 秒才进入可拖动状态，避免误触
            timer = setTimeout(() => {
                if (!start || active) return;
                armed = true;
                draggedAt = Date.now();
                el.classList.add('is-armed');
                try { navigator.vibrate?.(12); } catch { /* ignore */ }
            }, editing ? 0 : 5000);
        });

        el.addEventListener('pointermove', event => {
            if (!start || !armed) return;
            if (!active && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) return;
            if (!active) {
                active = true;
                el.classList.add('is-dragging');
                const glyph = el.querySelector('.mp-appicon__glyph');
                if (glyph) {
                    const screen = document.querySelector('.mp-screen');
                    ghost = h('div', { class: 'mp-drag-ghost' }, glyph.cloneNode(true));
                    (screen || document.body).appendChild(ghost);
                }
            }
            event.preventDefault();
            if (ghost) {
                const screen = document.querySelector('.mp-screen');
                const rect = screen?.getBoundingClientRect() || { left: 0, top: 0, width: 390, height: 800 };
                const left = Math.min(Math.max(event.clientX - rect.left - 34, 2), rect.width - 70);
                const top = Math.min(Math.max(event.clientY - rect.top - 34, 2), rect.height - 70);
                ghost.style.left = left + 'px';
                ghost.style.top = top + 'px';
            }

            // 悬停在另一个图标上 600ms = 建组（和真手机一样）
            const under = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-appid]');
            const underId = under?.dataset?.appid;
            const targetId = underId && underId !== id && !String(underId).startsWith('folder:') ? underId : null;
            if (targetId !== hoverTarget?.dataset?.appid) {
                clearTimeout(hoverTimer);
                hoverTarget?.classList.remove('is-drop-target');
                hoverTarget = targetId ? document.querySelector('[data-appid="' + targetId + '"]') : null;
                if (hoverTarget) {
                    hoverTarget.classList.add('is-drop-target');
                    hoverTimer = setTimeout(() => {
                        if (!start) return;
                        groupApps(id, targetId);
                        start = null;
                        cleanup();
                    }, 600);
                }
            }
        });

        const finish = event => {
            clearTimeout(timer);
            if (!start) return;
            const was = active;
            start = null;
            el.classList.remove('is-dragging');
            ghost?.remove();
            ghost = null;
            clearTimeout(hoverTimer);
            hoverTarget?.classList.remove('is-drop-target');
            hoverTarget = null;
            if (!was) {
                if (armed) { draggedAt = Date.now(); openIconMenu(id); }
                return;
            }
            draggedAt = Date.now();
            dropAt(id, event.clientX, event.clientY);
        };

        el.addEventListener('pointerup', finish);
        el.addEventListener('pointercancel', finish);
    }

    function dropAt(sourceId, x, y) {
        const screen = document.querySelector('.mp-screen');
        if (screen) {
            const rect = screen.getBoundingClientRect();
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
        }
        const target = document.elementFromPoint(x, y)?.closest?.('[data-appid]');
        if (!target) return;
        const targetId = target.dataset.appid;
        if (!targetId || targetId === sourceId) return;
        const settings = getSettings();
        const layoutData = settings.home;
        layoutData.folders = layoutData.folders || [];
        layoutData.order = layoutData.order || [];
        if (!layoutData.order.includes(targetId)) {
            const apps = [...CORE_APPS, ...installedAppMeta(settings.apps || [])];
            layoutData.order = buildEntries(apps).map(entry => entry.type === 'folder' ? 'folder:' + entry.folder.id : entry.app.id);
        }
        for (const folder of layoutData.folders) folder.apps = (folder.apps || []).filter(id => id !== sourceId);
        layoutData.order = layoutData.order.filter(id => id !== sourceId);

        const targetFolder = targetId.startsWith('folder:') ? layoutData.folders.find(folder => 'folder:' + folder.id === targetId) : null;
        if (targetFolder) {
            targetFolder.apps = [...new Set([...(targetFolder.apps || []), sourceId])];
        } else {
            const index = layoutData.order.indexOf(targetId);
            if (index >= 0) layoutData.order.splice(index, 0, sourceId);
            else layoutData.order.push(sourceId);
        }
        persist();
    }

    function openIconMenu(id) {
        const settings = getSettings();
        const layoutData = settings.home;
        const all = [...CORE_APPS, ...installedAppMeta(settings.apps || [])];
        const app = all.find(item => item.id === id);
        if (!app) return;
        const content = h('div', { class: 'mp-folder__list' },
            h('button', { type: 'button', class: 'mp-folder__row', onclick: () => { layoutData.order = (layoutData.order || []).filter(item => item !== id); layoutData.order.push(id); persist(); s.close(); } }, h('span', { class: 'mp-folder__rowname', text: '移到末尾' })),
            h('button', {
                type: 'button', class: 'mp-folder__row',
                onclick: () => {
                    const base = [...(layoutData.order || [])];
                    const at = base.indexOf(id);
                    const after = at >= 0 ? base.slice(at + 1) : [];
                    const next = all.find(item => item.id === after[0]) || null;
                    const peer = next || all.find(item => item.id !== id && item.id !== 'float');
                    if (!peer) return;
                    layoutData.folders = layoutData.folders || [];
                    const folder = { id: 'f' + Date.now().toString(36), name: '分组 ' + (layoutData.folders.length + 1), apps: [id, peer.id] };
                    layoutData.folders.push(folder);
                    layoutData.order = (layoutData.order || []).filter(item => item !== id && item !== peer.id);
                    layoutData.order.push('folder:' + folder.id);
                    persist();
                    s.close();
                },
            }, h('span', { class: 'mp-folder__rowname', text: '和下一个 App 建组' })),
            (layoutData.folders || []).length ? h('div', { class: 'mp-folder__group' },
                h('div', { class: 'mp-folder__group-title', text: '移入分组' }),
                ...layoutData.folders.map(folder => h('button', {
                    type: 'button', class: 'mp-folder__row',
                    onclick: () => {
                        folder.apps = [...new Set([...(folder.apps || []), id])];
                        layoutData.order = (layoutData.order || []).filter(item => item !== id);
                        persist();
                        s.close();
                    },
                }, h('span', { class: 'mp-folder__rowname', text: folder.name }))),
            ) : null,
        );
        const s = sheet({ title: app.name, content });
    }

    function groupApps(a, b) {
        const settings = getSettings();
        const layoutData = settings.home;
        layoutData.folders = layoutData.folders || [];
        const folder = { id: 'f' + Date.now().toString(36), name: '分组 ' + (layoutData.folders.length + 1), apps: [a, b] };
        layoutData.folders.push(folder);
        layoutData.order = (layoutData.order || []).filter(id => id !== a && id !== b);
        layoutData.order.push('folder:' + folder.id);
        persist();
    }

    function folderIcon(folder, navApi) {
        const glyph = h('span', { class: 'mp-appicon__glyph mp-folder' });
        const inner = h('span', { class: 'mp-folder__grid' });
        const all = [...CORE_APPS, ...installedAppMeta(getSettings().apps || [])];
        for (const id of (folder.apps || []).slice(0, 4)) {
            const app = all.find(item => item.id === id);
            if (app) inner.appendChild(h('span', { class: 'mp-folder__mini ' + app.cls }, icon(app.icon)));
        }
        glyph.appendChild(inner);
        const button = h('button', {
            type: 'button', class: 'mp-appicon', 'data-appid': 'folder:' + folder.id,
            onclick: () => { if (Date.now() - draggedAt < 300) return; openFolder(folder, navApi); },
        }, glyph, h('span', { class: 'mp-appicon__label', text: folder.name }));
        bindDrag(button, 'folder:' + folder.id);
        return button;
    }

    function openFolder(folder, navApi) {
        const list = h('div', { class: 'mp-folder__list' });
        const titleEl = h('div', { class: 'mp-folder__title', text: folder.name });
        const current = () => {
            const settings = getSettings();
            return (settings.home.folders || []).find(item => item.id === folder.id) || null;
        };
        const draw = () => {
            const f = current();
            list.innerHTML = '';
            if (!f) return;
            titleEl.textContent = f.name;
            const all = [...CORE_APPS, ...installedAppMeta(getSettings().apps || [])];
            for (const id of f.apps || []) {
                const app = all.find(item => item.id === id);
                if (!app) continue;
                list.appendChild(h('div', { class: 'mp-folder__row' },
                    h('span', { class: 'mp-folder__rowicon ' + app.cls }, icon(app.icon)),
                    h('span', { class: 'mp-folder__rowname', text: app.name }),
                    h('button', {
                        type: 'button', class: 'mp-folder__open', text: '打开',
                        onclick: event => { event.stopPropagation(); s.close(); navApi.go(app.id); },
                    }),
                    h('button', {
                        type: 'button', class: 'mp-folder__remove', text: '移出',
                        onclick: event => {
                            event.stopPropagation();
                            const target = current();
                            if (!target) return;
                            target.apps = (target.apps || []).filter(item => item !== id);
                            if (!target.apps.length) {
                                const settings = getSettings();
                                settings.home.folders = (settings.home.folders || []).filter(item => item.id !== folder.id);
                                settings.home.order = (settings.home.order || []).filter(item => item !== 'folder:' + folder.id);
                                saveNow('settings');
                                s.close();
                                render();
                                toast('分组已空，自动解散');
                                return;
                            }
                            saveNow('settings');
                            render();
                            draw();
                        },
                    }),
                ));
            }
            if (!list.children.length) list.appendChild(h('div', { class: 'mp-st-hint', text: '分组是空的。' }));
        };
        draw();
        const s = sheet({
            title: '分组',
            content: h('div', {}, titleEl, list, h('div', { class: 'mp-folder__actions' },
                h('button', {
                    type: 'button', class: 'mp-btn small', text: '重命名',
                    onclick: () => {
                        const f = current();
                        if (!f) return;
                        const input = h('input', { class: 'mp-input', value: f.name });
                        const rename = sheet({
                            title: '重命名分组',
                            content: h('div', { class: 'mp-field-list' }, input),
                            actions: h('button', {
                                class: 'mp-btn primary small', type: 'button', text: '保存',
                                onclick: () => {
                                    f.name = input.value.trim() || f.name;
                                    saveNow('settings');
                                    rename.close();
                                    render();
                                    titleEl.textContent = f.name;
                                },
                            }),
                        });
                    },
                }),
                h('button', {
                    type: 'button', class: 'mp-btn small', text: '解散',
                    onclick: () => {
                        const settings = getSettings();
                        settings.home.folders = (settings.home.folders || []).filter(item => item.id !== folder.id);
                        settings.home.order = (settings.home.order || []).filter(item => item !== 'folder:' + folder.id);
                        saveNow('settings');
                        s.close();
                        render();
                        toast('分组已解散');
                    },
                }),
            )),
        });
    }

    function openSearch() {
        const input = h('input', { class: 'mp-input', type: 'text', placeholder: '搜索 App、联系人…' });
        const list = h('div', { class: 'mp-home__results' });
        const draw = () => {
            const key = input.value.trim();
            list.innerHTML = '';
            for (const app of apps.filter(item => !key || item.name.includes(key) || (item.label || '').includes(key))) {
                list.appendChild(h('button', {
                    type: 'button', class: 'mp-home__result',
                    onclick: () => { s.close(); nav.go(app.id); },
                }, icon(app.icon), h('span', { text: app.name }), h('small', { text: '应用' })));
            }
            for (const person of getCast().filter(item => key && item.name.includes(key))) {
                list.appendChild(h('button', {
                    type: 'button', class: 'mp-home__result',
                    onclick: () => { s.close(); nav.go('contacts'); },
                }, icon('user'), h('span', { text: person.name }), h('small', { text: '联系人' })));
            }
        };
        input.addEventListener('input', draw);
        const s = sheet({ title: '搜索', content: h('div', { class: 'mp-home__searchbox' }, input, list) });
        draw();
        setTimeout(() => input.focus(), 150);
    }

    function previewText(msg) {
        if (!msg) return '';
        if (msg.type === 'voice') return '[语音]';
        if (msg.type === 'photo') return '[图片]';
        if (msg.type === 'sticker') return '[表情]';
        if (msg.type === 'redpacket') return '[红包] ' + msg.text;
        if (msg.type === 'transfer') return '[转账] ' + msg.text;
        if (msg.type === 'location') return '[位置] ' + msg.text;
        return msg.text;
    }

    function tick() {
        if (!timeEl) return;
        timeEl.textContent = clockText();
    }

    const timer = setInterval(tick, 20000);
    render();
    return {
        refresh: render,
        destroy() { clearInterval(timer); },
    };
}

function hasNewMoments(data) {
    const seen = Number(data.meta.momentsSeen) || 0;
    return data.moments.some(m => m.ts > seen);
}