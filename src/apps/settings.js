/**
 * 设置：外观、手机、AI、数据。改完立刻生效。
 */
import { h, icon, sheet, confirmSheet, toast } from '../render.js';
import { getSettings, getData, patchSettings, replaceData, resetData, saveNow } from '../store.js';
import { ACCENTS, WALLPAPERS, DEFAULT_STYLE } from '../state.js';
import { storeImage } from '../images.js';
import { previewInjection } from '../ai.js';
import { isNarrow } from '../st.js';
import { generateImage } from '../imagegen.js';
import { ttsVoices, ttsSupported } from '../tts.js';

export function mountSettings(host, { nav }) {
    const body = h('div', { class: 'mp-body' });
    const el = h('div', { class: 'mp-conv' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, '设置', h('small', { text: 'SETTINGS' })),
            h('div', { class: 'mp-nav__spacer' }),
        ),
        body,
    );
    host.appendChild(el);

    function render() {
        const settings = getSettings();
        const keep = body.scrollTop;
        body.innerHTML = '';
        const wrap = h('div', { class: 'mp-settings' });

        /* ---------------- 外观 ---------------- */
        wrap.appendChild(section('外观', [
            row({ icon: 'grid', label: '界面风格', hint: '整套换掉布局、字体和组件，不只是换色' },
                h('div', { class: 'mp-skins' },
                    ...[['mirage', '默认', '霓虹玻璃与渐变'], ['paper', '纸墨', '纸张、衬线、硬边'], ['neon', '霓虹', '终端、霓虹、切角']].map(([id, name, hint]) =>
                        h('button', {
                            type: 'button', class: 'mp-skin is-' + id + (settings.skin === id ? ' on' : ''),
                            onclick: () => { patchSettings('skin', id); nav.applyTheme(); render(); },
                        }, h('span', { class: 'mp-skin__preview' }), h('b', { text: name }), h('small', { text: hint })),
                    ),
                )),
            row({ icon: 'sun', label: '主题', hint: '跟随系统时会随酒馆所在设备切换' },
                choices([['auto', '跟随'], ['light', '浅色'], ['dark', '深色']], settings.theme, value => {
                    patchSettings('theme', value);
                    nav.applyTheme();
                    render();
                })),
            row({ icon: 'sparkle', label: '强调色', hint: '气泡、按钮和图标的那一点颜色' },
                swatches(settings.accent, value => {
                    patchSettings('accent', value);
                    nav.applyTheme();
                    render();
                })),
            row({ icon: 'image', label: '壁纸', hint: '点一下换一张' },
                h('div', { class: 'mp-wallpapers' },
                    ...Object.entries(WALLPAPERS).filter(([id]) => id !== 'custom').map(([id, wall]) =>
                        h('div', {
                            class: 'mp-wall-card' + (settings.wallpaper === id ? ' on' : ''),
                            onclick: () => { patchSettings('wallpaper', id); nav.applyTheme(); render(); },
                        }, h('div', { class: 'mp-wallpaper', 'data-wall': id }), h('span', { text: wall.name })),
                    ),
                    h('div', {
                        class: 'mp-wall-card is-upload' + (settings.wallpaper === 'custom' ? ' on' : ''),
                        onclick: () => uploadWallpaper(),
                    }, icon('plus'), h('span', { text: '自己的照片' })),
                )),
            row({ icon: 'eye', label: '玻璃质感', hint: '模糊越强，越像真的玻璃' },
                slider(0, 1.4, 0.05, settings.glass, v => Math.round(v * 100) + '%', value => {
                    patchSettings('glass', value);
                    nav.applyTheme();
                })),
            row({ icon: 'edit', label: '个性签名', hint: '会显示在朋友圈名片上' },
                h('div', { class: 'mp-field' }, textInput(settings.signature || '', '写一句话', value => { patchSettings('signature', value); }))),
        ]));

        /* ---------------- 手机 ---------------- */
        wrap.appendChild(section('手机', [
            isNarrow() ? null : row({ icon: 'settings', label: '窗口大小', hint: '拖动顶部状态栏可以移动到任意位置' },
                slider(0.7, 1.35, 0.05, settings.scale, v => Math.round(v * 100) + '%', value => {
                    patchSettings('scale', value);
                    nav.applyTheme();
                })),
            row({ icon: 'ai', label: '灵动岛', hint: '收到消息 / 正在输入时展开' }, toggle(settings.island, value => { patchSettings('island', value); })),
            row({ icon: 'phone', label: '振动反馈', hint: '手机上发送和领取时轻轻震一下' }, toggle(settings.haptics, value => { patchSettings('haptics', value); })),
            row({ icon: 'maximize', label: '手机端用悬浮窗', hint: '窄屏上也用可拖动的小窗口，而不是铺满屏幕' },
                toggle(globalThis.localStorage?.getItem('mirage_mobile_float') === '1', value => {
                    try { globalThis.localStorage?.setItem('mirage_mobile_float', value ? '1' : '0'); } catch { /* ignore */ }
                    toast('刷新后生效');
                })),
            row({ icon: 'power', label: '性能模式', hint: '流畅会关掉毛玻璃和动画，低配手机更省电' },
                choices([['auto', '自动'], ['lite', '流畅'], ['full', '完整']], settings.perf || 'auto', value => {
                    patchSettings('perf', value);
                    nav.applyTheme();
                    render();
                })),
        ]));

        /* ---------------- AI ---------------- */
        wrap.appendChild(section('AI', [
            row({ icon: 'comment', label: '评论风格', hint: '生成评论区时用的语气' },
                choices([['真实网友', '真实'], ['温柔', '温柔'], ['毒舌', '毒舌'], ['二次元', '二次元'], ['文艺', '文艺'], ['简短', '简短']], settings.ai?.commentStyle || '真实网友', value => {
                    patchSettings('ai.commentStyle', value);
                    toast('评论风格已切换');
                })),
            row({ icon: 'message', label: '回复长度', hint: '模型一次最多写多少字，太长会变啰嗦' },
                slider(120, 800, 20, settings.ai.length, v => Math.round(v) + ' tokens', value => {
                    patchSettings('ai.length', Math.round(value));
                })),
            row({ icon: 'sparkle', label: '口吻规则', hint: '这里写的东西会出现在每次手机回复的提示词里' },
                h('div', { class: 'mp-field' },
                    h('textarea', {
                        rows: '7',
                        onchange: event => { patchSettings('ai.style', event.target.value.trim() || DEFAULT_STYLE); toast('已保存'); },
                        text: settings.ai.style,
                    }),
                    h('div', { class: 'mp-st-hint', text: '留空保存会恢复默认。' }),
                )),
            row({ icon: 'bell', label: '剧情后主动来信', hint: '每次正文回复后，让角色判断要不要发消息（会多一次请求）' },
                toggle(settings.proactive.enabled, value => { patchSettings('proactive.enabled', value); render(); })),
            settings.proactive.enabled ? row({ icon: 'clock', label: '最短间隔', hint: '两次主动来信之间至少隔多久' },
                slider(30, 600, 30, settings.proactive.cooldown, v => Math.round(v / 60) + ' 分钟', value => {
                    patchSettings('proactive.cooldown', Math.round(value));
                })) : null,
            row({ icon: 'download', label: '把手机消息带进正文', hint: '让下一次正文知道手机上聊了什么' },
                toggle(settings.inject.enabled, value => { patchSettings('inject.enabled', value); render(); })),
            settings.inject.enabled ? row({ icon: 'more', label: '注入深度', hint: '越小越靠近正文末尾' },
                slider(0, 10, 1, settings.inject.depth, v => '第 ' + Math.round(v) + ' 条', value => {
                    patchSettings('inject.depth', Math.round(value));
                })) : null,
            row({ icon: 'eye', label: '看看现在注入的内容' },
                h('button', {
                    class: 'mp-btn small', type: 'button', text: '预览',
                    onclick: () => {
                        const text = previewInjection();
                        sheet({ title: '注入正文的内容', content: h('div', { class: 'mp-sheet-body' }, h('pre', { class: 'mp-pre', text: text || '现在还没有可以注入的消息。' })) });
                    },
                })),
        ]));

        /* ---------------- 手机 AI 接口 ---------------- */
        wrap.appendChild(section('手机 AI 接口', [
            row({ icon: 'sparkle', label: '跟随酒馆主 API', hint: '关掉后手机用下面这套接口，正文仍然走酒馆' },
                toggle(settings.ai?.useMain !== false, value => patchAI({ useMain: value }))),
            settings.ai?.useMain === false ? row({ icon: 'globe', label: '接口地址', hint: 'OpenAI 兼容，例如 https://api.deepseek.com/v1' },
                h('div', { class: 'mp-field' }, h('input', {
                    type: 'text', value: settings.ai?.baseUrl || '', placeholder: 'https://…/v1',
                    onchange: event => patchAI({ baseUrl: event.target.value.trim() }),
                }))) : null,
            settings.ai?.useMain === false ? row({ icon: 'key', label: 'API Key', hint: '只保存在本地设置' },
                h('div', { class: 'mp-field' }, h('input', {
                    type: 'password', value: settings.ai?.apiKey || '', placeholder: 'sk-…',
                    onchange: event => patchAI({ apiKey: event.target.value.trim() }),
                }))) : null,
            settings.ai?.useMain === false ? row({ icon: 'grid', label: '模型', hint: '例如 deepseek-chat' },
                h('div', { class: 'mp-field' }, h('input', {
                    type: 'text', value: settings.ai?.model || '', placeholder: 'deepseek-chat',
                    onchange: event => patchAI({ model: event.target.value.trim() }),
                }))) : null,
        ]));

        /* ---------------- 生图 ---------------- */
        wrap.appendChild(section('AI 配图', [
            row({ icon: 'image', label: '启用', hint: '用你自己的生图接口给抖音/Ins 配图；没配就用程序化照片' },
                toggle(settings.image?.enabled, value => { patchImage({ enabled: value }); })),
            settings.image?.enabled ? row({ icon: 'globe', label: '接口形态', hint: 'OpenAI / SD WebUI / ComfyUI' },
                choices([['openai', 'OpenAI'], ['sd', 'SD WebUI'], ['comfyui', 'ComfyUI']], settings.image?.provider || 'openai', value => patchImage({ provider: value }))) : null,
            settings.image?.enabled ? row({ icon: 'link', label: '接口地址', hint: 'OpenAI: …/v1　SD: :7860　ComfyUI: :8188' },
                h('div', { class: 'mp-field' }, h('input', {
                    type: 'text', value: settings.image?.endpoint || '', placeholder: 'https://…',
                    onchange: event => patchImage({ endpoint: event.target.value.trim() }),
                }))) : null,
            settings.image?.enabled && (settings.image?.provider || 'openai') === 'openai' ? row({ icon: 'key', label: 'API Key', hint: '只存在本地设置里' },
                h('div', { class: 'mp-field' }, h('input', {
                    type: 'password', value: settings.image?.apiKey || '', placeholder: 'sk-…',
                    onchange: event => patchImage({ apiKey: event.target.value.trim() }),
                }))) : null,
            settings.image?.enabled && (settings.image?.provider || 'openai') === 'openai' ? row({ icon: 'grid', label: '模型 / 尺寸', hint: '例如 gpt-image-1 · 1024x1024' },
                h('div', { class: 'mp-field' }, h('input', {
                    type: 'text', value: (settings.image?.model || '') + ' ' + (settings.image?.size || ''), placeholder: 'gpt-image-1 1024x1024',
                    onchange: event => {
                        const [model, size] = event.target.value.trim().split(/\s+/);
                        patchImage({ model: model || 'gpt-image-1', size: size || '1024x1024' });
                    },
                }))) : null,
            settings.image?.enabled && (settings.image?.provider || 'openai') === 'comfyui' ? row({ icon: 'grid', label: '模型文件名', hint: 'ComfyUI 的 CheckpointLoaderSimple 里填的 ckpt 名' },
                h('div', { class: 'mp-field' }, h('input', {
                    type: 'text', value: settings.image?.comfyCheckpoint || '', placeholder: 'sd_xl_base_1.0.safetensors',
                    onchange: event => patchImage({ comfyCheckpoint: event.target.value.trim() }),
                }))) : null,
            settings.image?.enabled && (settings.image?.provider || 'openai') === 'comfyui' ? row({ icon: 'edit', label: '工作流 JSON', hint: '可选；留空用内置文生图工作流，支持 {{prompt}} / {{negative}} 占位' },
                h('div', { class: 'mp-field' }, h('textarea', {
                    class: 'mp-input', rows: '4', placeholder: '{ "3": { "class_type": "KSampler", ... } }',
                    value: settings.image?.comfyWorkflow || '',
                    onchange: event => patchImage({ comfyWorkflow: event.target.value }),
                }))) : null,
            settings.image?.enabled ? row({ icon: 'refresh', label: '测试接口', hint: '生成一张测试图，成功会提示' },
                h('button', {
                    class: 'mp-btn small', type: 'button', text: '生成一张',
                    onclick: async () => {
                        toast('正在生成…');
                        try {
                            await generateImage('雪夜里的旧城街道，一家亮着灯的小店，电影质感照片');
                            toast('接口通了');
                        } catch (error) { toast(String(error?.message || '生成失败'), 3200); }
                    },
                })) : null,
        ]));

        /* ---------------- 语音 ---------------- */
        const voices = ttsVoices();
        wrap.appendChild(section('语音朗读', [
            row({ icon: 'volume', label: '启用 TTS', hint: ttsSupported() ? '用系统语音朗读手机消息' : '当前浏览器不支持语音合成' },
                toggle(settings.tts?.enabled, value => patchTTS({ enabled: value }))),
            settings.tts?.enabled ? row({ icon: 'bell', label: '自动朗读', hint: '手机收到新回复时自动读出来' },
                toggle(settings.tts?.auto, value => patchTTS({ auto: value }))) : null,
            settings.tts?.enabled ? row({ icon: 'music', label: '语速', hint: '0.6 慢 – 1.6 快' },
                slider(0.6, 1.6, 0.1, Number(settings.tts?.rate) || 1, v => Number(v).toFixed(1) + '×', value => patchTTS({ rate: Number(value) }))) : null,
            settings.tts?.enabled ? row({ icon: 'user', label: '声音', hint: voices.length ? '系统里可用的语音' : '系统没有返回语音包' },
                h('select', {
                    class: 'text_pole',
                    onchange: event => patchTTS({ voice: event.target.value }),
                }, h('option', { value: '', text: '系统默认' }), ...voices.map(voice => h('option', {
                    value: voice.name, selected: settings.tts?.voice === voice.name,
                    text: voice.name + (voice.lang ? ' · ' + voice.lang : ''),
                })))) : null,
        ]));

        /* ---------------- 数据 ---------------- */
        wrap.appendChild(section('数据', [
            row({ icon: 'download', label: '导出这部手机', hint: '聊天、朋友圈、备忘都会存成一个 JSON 文件' },
                h('button', { class: 'mp-btn small', type: 'button', text: '导出', onclick: () => exportData() })),
            row({ icon: 'upload', label: '导入', hint: '会覆盖当前聊天里的手机数据' },
                h('button', { class: 'mp-btn small', type: 'button', text: '选择文件', onclick: () => importData() })),
            row({ icon: 'trash', label: '清空这部手机', hint: '只清当前聊天，不影响角色卡和正文' },
                h('button', { class: 'mp-btn small danger', type: 'button', text: '清空', onclick: () => clearAll() })),
        ]));

        /* ---------------- 关于 ---------------- */
        wrap.appendChild(section('关于', [
            h('div', { class: 'mp-about' },
                h('div', { class: 'mp-about__logo' }, icon('phone')),
                h('div', { class: 'mp-about__name', text: '幻镜手机' }),
                h('div', { class: 'mp-about__ver', text: 'Mirage Phone · v1.0.0' }),
                h('div', { class: 'mp-about__text', text: '给 SillyTavern 的一部小手机。所有内容都由你自己连接的模型生成，记录只存在当前聊天里。' }),
            ),
            helpRow('拖动', '按住顶部状态栏，可以把手机拖到任何位置'),
            helpRow('双击', '双击顶部，在窗口和全屏之间切换'),
            helpRow('长按消息', '复制、带进剧情或者删除'),
            helpRow('聊天记录', '点右上角 ···，可以把这段对话带进下一次正文'),
        ]));

        body.appendChild(wrap);
        body.scrollTop = keep;
    }

    /* ------------------------------ 组件 ------------------------------ */

    function patchAI(patch) {
        const current = getSettings();
        current.ai = { ...(current.ai || {}), ...patch };
        saveNow('settings');
        render();
    }

    function patchTTS(patch) {
        const current = getSettings();
        current.tts = { ...(current.tts || {}), ...patch };
        saveNow('settings');
        render();
    }

    function patchImage(patch) {
        const current = getSettings();
        current.image = { ...(current.image || {}), ...patch };
        saveNow('settings');
        render();
    }

    function section(title, rows) {
        return h('div', { class: 'mp-section' },
            h('div', { class: 'mp-section__title', text: title }),
            h('div', { class: 'mp-card' }, rows.filter(Boolean)),
        );
    }

    function row({ icon: iconName, label, hint, control, onClick }, ...rest) {
        const content = control || rest[0] || null;
        if (content && (content.classList?.contains('mp-choices') || content.classList?.contains('mp-wallpapers') || content.classList?.contains('mp-swatches') || content.classList?.contains('mp-field') || content.classList?.contains('mp-range'))) {
            return h('div', { class: 'mp-row is-block' + (onClick ? ' is-tap' : '') },
                h('div', { class: 'mp-row__head' },
                    h('span', { class: 'mp-row__icon' }, icon(iconName || 'settings')),
                    h('div', { class: 'mp-row__main' },
                        h('div', { class: 'mp-row__label', text: label }),
                        hint ? h('div', { class: 'mp-row__hint', text: hint }) : null,
                    ),
                ),
                content,
            );
        }
        return h('div', { class: 'mp-row' + (onClick ? ' is-tap' : ''), onclick: onClick },
            h('span', { class: 'mp-row__icon' }, icon(iconName || 'settings')),
            h('div', { class: 'mp-row__main' },
                h('div', { class: 'mp-row__label', text: label }),
                hint ? h('div', { class: 'mp-row__hint', text: hint }) : null,
            ),
            content,
        );
    }

    function helpRow(title, text) {
        return h('div', { class: 'mp-row' },
            h('div', { class: 'mp-row__main' },
                h('div', { class: 'mp-row__label', text: title }),
                h('div', { class: 'mp-row__hint', text }),
            ),
        );
    }

    function choices(list, value, onPick) {
        return h('div', { class: 'mp-choices' }, list.map(([id, label]) =>
            h('button', { class: 'mp-choice' + (value === id ? ' on' : ''), type: 'button', text: label, onclick: () => onPick(id) }),
        ));
    }

    function swatches(value, onPick) {
        return h('div', { class: 'mp-swatches' }, Object.entries(ACCENTS).map(([id, accent]) =>
            h('button', {
                class: 'mp-swatch' + (value === id ? ' on' : ''),
                type: 'button',
                title: accent.name,
                'aria-label': accent.name,
                style: { background: 'linear-gradient(145deg,' + accent.soft + ',' + accent.color + ')' },
                onclick: () => onPick(id),
            }),
        ));
    }

    function toggle(value, onChange) {
        const btn = h('button', { class: 'mp-switch', type: 'button', role: 'switch', 'aria-checked': value ? 'true' : 'false' });
        btn.addEventListener('click', () => {
            const next = btn.getAttribute('aria-checked') !== 'true';
            btn.setAttribute('aria-checked', next ? 'true' : 'false');
            onChange(next);
        });
        return btn;
    }

    function slider(min, max, step, value, format, onInput) {
        const out = h('span', { class: 'mp-row__value', text: format(value) });
        const input = h('input', {
            class: 'mp-slider', type: 'range', min: String(min), max: String(max), step: String(step), value: String(value),
            oninput: event => {
                const v = Number(event.target.value);
                out.textContent = format(v);
                onInput(v);
            },
        });
        return h('div', { class: 'mp-range' }, h('div', { class: 'mp-range__top' }, h('span', { text: '' }), out), input);
    }

    function textInput(value, placeholder, onInput) {
        return h('input', {
            class: 'mp-input', type: 'text', value: value || '', placeholder,
            onchange: event => onInput(event.target.value.trim()),
        });
    }

    /* ------------------------------ 动作 ------------------------------ */

    function uploadWallpaper() {
        const file = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
        file.addEventListener('change', async () => {
            const f = file.files?.[0];
            if (!f) return;
            try {
                const stored = await storeImage(f);
                localStorage.setItem('mirage_phone_wall', stored.url);
                patchSettings('wallpaper', 'custom');
                nav.applyTheme();
                toast('壁纸换好了');
                render();
            } catch (error) {
                toast('这张图用不了：' + error.message);
            }
        });
        document.body.appendChild(file);
        file.click();
        setTimeout(() => file.remove(), 60000);
    }

    function exportData() {
        const payload = { app: 'mirage-phone', version: 1, exportedAt: new Date().toISOString(), data: getData() };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = h('a', { href: url, download: 'mirage-phone-' + new Date().toISOString().slice(0, 10) + '.json' });
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 3000);
        toast('已经导出');
    }

    function importData() {
        const file = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
        file.addEventListener('change', async () => {
            const f = file.files?.[0];
            if (!f) return;
            try {
                const text = await f.text();
                const parsed = JSON.parse(text);
                const ok = await confirmSheet('导入会覆盖当前聊天的手机数据，继续？', { ok: '导入' });
                if (!ok) return;
                replaceData(parsed.data || parsed);
                toast('导入完成');
                render();
                nav.refreshAll();
            } catch (error) {
                toast('文件读不了：' + error.message);
            }
        });
        document.body.appendChild(file);
        file.click();
        setTimeout(() => file.remove(), 60000);
    }

    async function clearAll() {
        const ok = await confirmSheet('清空当前聊天的手机数据？聊天、朋友圈、备忘都会消失，酒馆正文不受影响。', { ok: '清空', danger: true });
        if (!ok) return;
        resetData();
        toast('已经清空');
        nav.home();
        nav.refreshAll();
    }

    render();
    return { refresh: render };
}