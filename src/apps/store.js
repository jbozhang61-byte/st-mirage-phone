/**
 * 应用商店：把「下载应用」做成手机里真实的一件事。
 * 目前上架的是几个内容类 App，装上后会出现在主屏。
 */
import { h, icon, toast } from '../render.js';
import { STORE_APPS } from '../app-meta.js';
import { installedApps, installApp, uninstallApp } from '../store.js';

export function mountStore(host, { nav }) {
    nav.setChrome?.('light');
    let keyword = '';
    let category = '全部';
    const CATS = ['全部', '社交', '社区', '视频', '工具', '音乐', '创作'];

    const el = h('div', { class: 'mp-as' });
    const body = h('div', { class: 'mp-as__body' });
    const head = h('div', { class: 'mp-as__head' },
        h('div', { class: 'mp-as__top' },
            h('button', { class: 'mp-as__back', type: 'button', 'aria-label': '回主屏', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-as__brand' },
                h('div', { class: 'mp-as__brand-title', text: '应用商店' }),
                h('div', { class: 'mp-as__brand-sub', text: '给你的手机装点新东西' }),
            ),
        ),
        h('div', { class: 'mp-as__search' }, icon('search'),
            h('input', {
                type: 'text', placeholder: '搜索 App', value: keyword,
                oninput: event => { event.target.value = event.target.value; keyword = event.target.value.trim(); render(); },
            }),
        ),
        h('div', { class: 'mp-as__cats' }),
    );
    const catsEl = head.querySelector('.mp-as__cats');
    el.append(head, body);
    host.appendChild(el);

    function filtered() {
        let list = STORE_APPS;
        if (category !== '全部') list = list.filter(app => app.category === category);
        if (keyword) list = list.filter(app => (app.name + app.sub + app.desc + app.category).toLowerCase().includes(keyword.toLowerCase()));
        return list;
    }

    function render() {
        const installed = installedApps();
        const apps = filtered();
        body.innerHTML = '';
        catsEl.innerHTML = '';
        for (const name of CATS) {
            catsEl.appendChild(h('button', {
                type: 'button', class: 'mp-as__cat' + (category === name ? ' on' : ''),
                text: name,
                onclick: () => { category = name; render(); },
            }));
        }

        const featured = category === '全部' && !keyword && (apps.find(app => !installed.includes(app.id)) || apps[0]);
        if (featured) body.appendChild(hero(featured, installed.includes(featured.id)));

        const list = h('div', { class: 'mp-as__list' });
        for (const app of apps) list.appendChild(row(app, installed.includes(app.id)));
        if (!apps.length) list.appendChild(h('div', { class: 'mp-as__empty', text: '没有找到这个 App' }));
        body.appendChild(h('div', { class: 'mp-as__card' },
            h('div', { class: 'mp-as__card-head' }, h('span', { text: category === '全部' ? '热门 App' : category }), h('span', { text: apps.length + ' 个' })),
            list,
        ));

        if (installed.length) {
            const mine = h('div', { class: 'mp-as__card' });
            for (const id of installed) {
                const app = STORE_APPS.find(item => item.id === id);
                if (!app) continue;
                mine.appendChild(row(app, true));
            }
            if (mine.children.length) {
                body.appendChild(h('div', { class: 'mp-as__card' },
                    h('div', { class: 'mp-as__card-head' }, h('span', { text: '我的应用' })),
                    mine,
                ));
            }
        }

        body.appendChild(h('div', { class: 'mp-as__foot', text: 'App 的图标和界面是照着它们的样子重新画的，只是这个世界里的版本。' }));
    }

    function sectionTitle(text) {
        return h('div', { class: 'mp-as__section', text });
    }

    function hero(app, isInstalled) {
        return h('div', { class: 'mp-as__hero', style: { background: 'linear-gradient(135deg,' + app.color + ',' + app.accent + ')' } },
            h('div', { class: 'mp-as__hero-kicker', text: '编辑推荐' }),
            h('div', { class: 'mp-as__hero-main' },
                h('span', { class: 'mp-as__hero-icon ' + app.cls }, icon(app.icon)),
                h('div', { class: 'mp-as__hero-info' },
                    h('div', { class: 'mp-as__hero-name', text: app.name }),
                    h('div', { class: 'mp-as__hero-sub', text: app.sub + ' · ' + app.category }),
                    h('div', { class: 'mp-as__hero-desc', text: app.desc }),
                ),
            ),
            h('div', { class: 'mp-as__hero-foot' },
                h('span', { class: 'mp-as__hero-meta', text: app.size + ' · ★ ' + app.rating }),
                actionButton(app, isInstalled, true),
            ),
        );
    }

    function row(app, isInstalled) {
        return h('div', { class: 'mp-as__row' },
            h('span', { class: 'mp-as__icon ' + app.cls }, icon(app.icon)),
            h('div', { class: 'mp-as__info' },
                h('div', { class: 'mp-as__name' }, app.name, h('span', { class: 'mp-as__sub', text: app.sub })),
                h('div', { class: 'mp-as__desc', text: app.desc }),
                h('div', { class: 'mp-as__meta', text: app.category + ' · ' + app.size + ' · ★ ' + app.rating }),
            ),
            h('div', { class: 'mp-as__actions' },
                installing.has(app.id) ? progressBlock(app) : actionButton(app, isInstalled, false),
                isInstalled ? h('button', {
                    type: 'button', class: 'mp-as__remove', text: '移除',
                    onclick: () => {
                        uninstallApp(app.id);
                        toast('已从主屏移除');
                        render();
                    },
                }) : null,
            ),
        );
    }

    const installing = new Map();

    function progressBlock(app) {
        const item = installing.get(app.id) || { progress: 0, speed: 0 };
        return h('div', { class: 'mp-as__progress' },
            h('div', { class: 'mp-as__bar' }, h('i', { style: { width: Math.min(100, Math.round(item.progress)) + '%' } })),
            h('span', { class: 'mp-as__speed', text: item.speed.toFixed(1) + ' MB/s · ' + Math.min(100, Math.round(item.progress)) + '%' }),
        );
    }

    function startDownload(app) {
        if (installing.has(app.id)) return;
        const mb = Math.max(8, parseFloat(app.size) || 50);
        installing.set(app.id, { progress: 0, speed: 8 + Math.random() * 12 });
        const timer = setInterval(() => {
            const item = installing.get(app.id);
            if (!item) { clearInterval(timer); return; }
            item.speed = Math.max(2, Math.min(48, item.speed + (Math.random() - .5) * 3));
            item.progress += (item.speed / mb) * 100 * 0.28;
            if (item.progress >= 100) {
                clearInterval(timer);
                installing.delete(app.id);
                installApp(app.id);
                toast('「' + app.name + '」已装到主屏');
                render();
                return;
            }
            render();
        }, 280);
        render();
    }

    function actionButton(app, isInstalled, big) {
        if (isInstalled) {
            return h('button', {
                type: 'button', class: 'mp-as__get installed' + (big ? ' big' : ''), text: '打开',
                onclick: () => nav.go(app.id),
            });
        }
        return h('button', {
            type: 'button', class: 'mp-as__get' + (big ? ' big' : ''), text: '获取',
            onclick: () => {
                installApp(app.id);
                toast('「' + app.name + '」已装到主屏');
                render();
            },
        });
    }

    render();
    return { refresh: render };
}