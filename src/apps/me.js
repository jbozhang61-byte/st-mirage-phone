/** 我：个人中心。资料、资产、世界、账号与快捷入口。 */
import { h, icon, avatar, toast } from '../render.js';
import { getData, getSettings, installedApps } from '../store.js';
import { getCast } from '../store.js';
import { userName, personaAvatarUrl, currentCharacter, personaDescription } from '../st.js';


export function mountMe(host, { nav }) {
    nav.setChrome?.('dark');
    const el = h('div', { class: 'mp-me-page' });
    const body = h('div', { class: 'mp-me-page__body' });
    el.appendChild(body);
    host.appendChild(el);

    function render() {
        const data = getData();
        const settings = getSettings();
        const name = userName() || '我';
        const cast = getCast();
        const world = currentCharacter()?.name || '未选择角色';
        const unread = (data.threads || []).reduce((sum, thread) => sum + (thread.unread || 0), 0);
        const apps = installedApps();
        body.innerHTML = '';

        body.appendChild(h('div', { class: 'mp-me-page__hero' },
            avatar({ name, size: 72, src: personaAvatarUrl() }),
            h('div', { class: 'mp-me-page__id' },
                h('div', { class: 'mp-me-page__name', text: name }),
                h('div', { class: 'mp-me-page__sub', text: world }),
                h('div', { class: 'mp-me-page__bio', text: (personaDescription() || '在这个世界里的手机主人。').slice(0, 80) }),
            ),
            h('button', { type: 'button', class: 'mp-me-page__edit', 'aria-label': '设置', onclick: () => nav.go('settings') }, icon('settings')),
        ));

        body.appendChild(h('div', { class: 'mp-me-page__stats' },
            stat('联系人', String(cast.length)),
            stat('未读', String(unread)),
            stat('资产', '¥' + Math.round(data.stocks?.cash ?? 100000).toLocaleString('zh-CN')),
        ));

        body.appendChild(section('我的', [
            row('钱包', '钱包与流水', 'wallet', () => nav.go('wallet')),
            row('相册', '这个世界拍下的照片', 'photos', () => nav.go('photos')),
            row('相遇', '正在约会的人', 'spark', () => nav.go('spark')),
            row('股市', '我的持仓', 'stocks', () => nav.go('stocks')),
        ]));

        body.appendChild(section('账号', [
            row('当前角色', world, 'user', () => toast('在酒馆里切换角色卡')),
            row('窗口模式', '全屏 / 悬浮窗切换', 'maximize', () => { globalThis.MiragePhone?.toggleFloat?.(); toast('已切换窗口模式'); }),
            row('手机 AI', settings.ai?.useMain !== false ? '跟随酒馆主 API' : '自定义接口', 'sparkle', () => nav.go('settings')),
            row('已装应用', apps.map(app => app.name).join('、') || '只有内置应用', 'grid', () => nav.go('store')),
        ]));

        body.appendChild(section('关于', [
            row('版本', '幻镜手机 ' + (settings.version || '1.4.2'), 'info', () => toast('幻镜手机 · Mirage Phone')),
            row('设置', '外观、AI、数据', 'settings', () => nav.go('settings')),
        ]));
    }

    function stat(label, value) {
        return h('div', { class: 'mp-me-page__stat' }, h('b', { text: value }), h('span', { text: label }));
    }

    function section(title, rows) {
        return h('div', { class: 'mp-me-page__section' },
            h('div', { class: 'mp-me-page__section-title', text: title }),
            h('div', { class: 'mp-me-page__card' }, ...rows),
        );
    }

    function row(title, sub, iconName, onClick) {
        return h('button', { type: 'button', class: 'mp-me-page__row', onclick: onClick },
            h('span', { class: 'mp-me-page__ico' }, icon(iconName)),
            h('span', { class: 'mp-me-page__rowmain' }, h('b', { text: title }), h('span', { text: sub })),
            icon('chevron'),
        );
    }

    render();
    return { refresh: render };
}