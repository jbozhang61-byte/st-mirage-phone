/** 手机里的 AI 助手：按正文、记忆库、私聊和其它 App 回答。 */
import { h, icon, avatar, sheet, toast } from '../render.js';
import { getData, getFeed, saveNow, getSettings } from '../store.js';
import { generateText, importantStoryContext, memoryContext, userName, currentCharacter } from '../st.js';
import { phoneStateSummary } from '../prompts.js';
import { recentOtherChats } from '../ai.js';

const PROVIDERS = {
    inherit: { name: '跟随扩展设置', baseUrl: '', model: '' },
    deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    moonshot: { name: 'Moonshot / Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    zhipu: { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
    custom: { name: '自定义', baseUrl: '', model: '' },
};

export function mountAI(host, ctx) {
    return mountAssistant(host, ctx, {});
}

export function mountAssistant(host, { nav }, brand = {}) {
    nav.setChrome?.('dark');
    const appId = brand.id || 'ai';
    const appName = brand.name || 'AI';
    const appSub = brand.sub || 'ASSISTANT';
    const fixedProvider = brand.provider || '';
    const body = h('div', { class: 'mp-aiapp__body' });
    const el = h('div', { class: 'mp-aiapp' },
        h('div', { class: 'mp-nav' },
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
            h('div', { class: 'mp-nav__title' }, appName, h('small', { text: appSub })),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '模型设置', onclick: () => providerSheet() }, icon('settings')),
            h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '新对话', onclick: () => reset() }, icon('plus')),
        ),
        body,
    );
    host.appendChild(el);
    let busy = false;

    function appConfig() {
        const settings = getSettings();
        settings.aiApps = settings.aiApps && typeof settings.aiApps === 'object' ? settings.aiApps : {};
        const config = settings.aiApps[appId] && typeof settings.aiApps[appId] === 'object' ? settings.aiApps[appId] : {};
        return {
            provider: fixedProvider || config.provider || settings.aiApp?.provider || 'inherit',
            baseUrl: config.baseUrl || '',
            apiKey: config.apiKey || '',
            model: config.model || '',
        };
    }

    function data() {
        const current = getData();
        current.aiApps = current.aiApps && typeof current.aiApps === 'object' ? current.aiApps : {};
        current.aiApps[appId] = current.aiApps[appId] && typeof current.aiApps[appId] === 'object' ? current.aiApps[appId] : { messages: [] };
        current.aiApps[appId].messages = Array.isArray(current.aiApps[appId].messages) ? current.aiApps[appId].messages : [];
        return current.aiApps[appId];
    }

    function context() {
        const current = getData();
        const memory = memoryContext(12).map(item => String(item.text || '').slice(0, 500)).filter(Boolean).join('\n');
        const story = importantStoryContext(40, 360).map(line => (line.isUser ? userName() : line.name) + '：' + line.text).join('\n');
        const phone = phoneStateSummary({
            threads: current.threads,
            user: userName(),
            hearts: getFeed('heart')?.items || [],
            selfProfile: current.heartSelf || null,
            worldProfile: current.worldInfo || null,
            extras: recentOtherChats(),
        });
        return [
            story ? '【正文最近发生的事】\n' + story : '',
            memory ? '【记忆库 / 摘要】\n' + memory : '',
            phone,
        ].filter(Boolean).join('\n\n');
    }

    function scrollBottom() {
        requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
    }

    function drawTyping() {
        let node = body.querySelector('.mp-aiapp__typing');
        if (!node) {
            node = h('div', { class: 'mp-aiapp__msg is-ai mp-aiapp__typing' },
                h('div', { class: 'mp-aiapp__bubble' }, h('i'), h('i'), h('i')),
            );
            body.appendChild(node);
        }
        scrollBottom();
    }

    function removeTyping() { body.querySelector('.mp-aiapp__typing')?.remove(); }

    function render() {
        const app = data();
        body.innerHTML = '';
        if (!app.messages.length) {
            body.appendChild(h('div', { class: 'mp-aiapp__hello' },
                h('div', { class: 'mp-aiapp__logo' }, icon(brand.icon || 'sparkle')),
                h('div', { class: 'mp-aiapp__title', text: '我知道这部手机和最近的故事' }),
                h('div', { class: 'mp-aiapp__sub', text: '可以问剧情、谁在聊什么、谁对你有好感，或者让我帮你理一理。' }),
                h('div', { class: 'mp-aiapp__chips' },
                    ...['总结最近剧情', '手机里大家聊了什么', '谁对我有好感'].map(text => h('button', {
                        type: 'button', class: 'mp-aiapp__chip', text, onclick: () => send(text),
                    })),
                ),
            ));
        }
        for (const msg of app.messages) {
            body.appendChild(h('div', { class: 'mp-aiapp__msg ' + (msg.role === 'user' ? 'is-user' : 'is-ai') },
                msg.role === 'ai' ? h('div', { class: 'mp-aiapp__avatar' }, avatar({ name: 'AI', size: 24 })) : null,
                h('div', { class: 'mp-aiapp__bubble', text: msg.text }),
            ));
        }
        if (busy) drawTyping();
        scrollBottom();
    }

    function reset() {
        if (busy) return;
        data().messages.length = 0;
        saveNow('data');
        render();
    }

    async function callModel({ system, prompt, length }) {
        const config = appConfig();
        const provider = PROVIDERS[config.provider] ? config.provider : 'inherit';
        if (provider === 'inherit' || !config.apiKey) {
            return generateText({ system, prompt, length });
        }
        const preset = PROVIDERS[provider];
        const baseUrl = String(config.baseUrl || preset.baseUrl).replace(/\/$/, '');
        const model = String(config.model || preset.model);
        if (!baseUrl || !model) throw new Error('先在模型设置里填接口地址和模型');
        const response = await fetch(baseUrl + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (config.apiKey || '') },
            body: JSON.stringify({
                model,
                messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
                max_tokens: Math.max(128, Math.round(length)),
                temperature: 0.8,
            }),
        });
        if (!response.ok) {
            let detail = '';
            try { detail = (await response.text()).slice(0, 200); } catch { /* ignore */ }
            throw new Error('接口返回 ' + response.status + (detail ? '：' + detail : ''));
        }
        const json = await response.json();
        const answer = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || '';
        if (!answer) throw new Error('接口没有返回内容');
        return String(answer).trim();
    }

    function providerSheet() {
        const config = appConfig();
        let provider = fixedProvider || config.provider || 'inherit';
        const baseInput = h('input', { class: 'mp-input', type: 'text', value: config.baseUrl || '', placeholder: '接口地址，例如 https://api.deepseek.com/v1' });
        const modelInput = h('input', { class: 'mp-input', type: 'text', value: config.model || '', placeholder: '模型名，例如 deepseek-chat' });
        const keyInput = h('input', { class: 'mp-input', type: 'password', value: config.apiKey || '', placeholder: 'API Key（只存在本地设置）' });
        const hint = h('div', { class: 'mp-st-hint', text: '跟随扩展设置：使用酒馆当前 API 或扩展里的独立 API。' });
        const applyPreset = () => {
            const preset = PROVIDERS[provider];
            baseInput.disabled = provider === 'inherit';
            modelInput.disabled = provider === 'inherit';
            keyInput.disabled = provider === 'inherit';
            if (preset.baseUrl && !baseInput.value) baseInput.value = preset.baseUrl;
            if (preset.model && !modelInput.value) modelInput.value = preset.model;
            hint.textContent = provider === 'inherit' ? '使用酒馆当前 API 或扩展里的独立 API。' : '注意：API Key 只保存在本机扩展设置里。';
        };
        applyPreset();
        const choices = h('div', { class: 'mp-aiapp__chips' });
        if (!fixedProvider) for (const [id, preset] of Object.entries(PROVIDERS)) {
            choices.appendChild(h('button', {
                type: 'button', class: 'mp-aiapp__chip' + (provider === id ? ' is-on' : ''), text: preset.name,
                onclick: event => {
                    provider = id;
                    [...choices.children].forEach(btn => btn.classList.toggle('is-on', btn === event.currentTarget));
                    const item = PROVIDERS[id];
                    if (item.baseUrl) baseInput.value = item.baseUrl;
                    if (item.model) modelInput.value = item.model;
                    applyPreset();
                },
            }));
        }
        const dialog = sheet({
            title: appName + ' 模型',
            content: h('div', { class: 'mp-field-list' },
                h('div', { class: 'mp-aiapp__chips' }, choices),
                h('div', {}, h('label', { text: '接口地址' }), baseInput),
                h('div', {}, h('label', { text: '模型' }), modelInput),
                h('div', {}, h('label', { text: 'API Key' }), keyInput),
                hint,
            ),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '保存',
                onclick: () => {
                    const current = getSettings();
                    current.aiApps = current.aiApps && typeof current.aiApps === 'object' ? current.aiApps : {};
                    current.aiApps[appId] = {
                        provider,
                        baseUrl: baseInput.value.trim(),
                        model: modelInput.value.trim(),
                        apiKey: keyInput.value.trim(),
                    };
                    saveNow('settings');
                    dialog.close();
                    toast('模型已保存');
                },
            }),
        });
    }

    async function send(text) {
        const value = String(text || '').trim();
        if (!value || busy) return;
        const app = data();
        app.messages.push({ role: 'user', text: value.slice(0, 2000), ts: Date.now() });
        saveNow('data');
        busy = true;
        render();
        try {
            const raw = await callModel({
                system: [
                    '你是「幻镜手机」里的 AI 助手，知道这个聊天（酒馆正文）和手机里发生的一切。',
                    '优先根据提供的资料回答；资料里没有的就直说不知道，不要编造。',
                    '用中文、口语、简洁，必要时分点；不要写旁白，不要提「注入」「上下文」这些词。',
                ].join('\n'),
                prompt: context() + '\n\n用户问：' + value,
                length: 900,
            });
            const answer = String(raw || '').trim() || '我这边没读到可用的内容。';
            app.messages.push({ role: 'ai', text: answer.slice(0, 3000), ts: Date.now() });
        } catch (error) {
            app.messages.push({ role: 'ai', text: '生成失败：' + (error?.message || '未知错误'), ts: Date.now() });
        } finally {
            busy = false;
            saveNow('data');
            render();
        }
    }

    /* 底部输入 */
    const input = h('input', { class: 'mp-cm__input', type: 'text', placeholder: '问 AI…' });
    const sendBtn = h('button', { class: 'mp-cm__send', type: 'button', onclick: () => { const value = input.value; input.value = ''; send(value); } }, icon('send'));
    el.appendChild(h('div', { class: 'mp-aiapp__composer' }, input, sendBtn));
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); const value = input.value; input.value = ''; send(value); }
    });

    render();
    return { refresh: render };
}