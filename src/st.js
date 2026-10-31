/**
 * 酒馆桥接层 — 把 SillyTavern 的 API 收在一处，
 * 界面与业务代码只依赖这里，方便在浏览器预览环境里替换。
 */
export const MODULE = 'mirage_phone';

/** 取得酒馆 context（预览环境下由 preview/stub.js 提供同名对象）。 */
export function ctx() {
    try {
        return globalThis.SillyTavern?.getContext?.() ?? null;
    } catch (error) {
        console.warn('[幻镜手机] getContext 失败', error);
        return null;
    }
}

export function hasTavern() {
    return !!ctx();
}

/** 用户 / 角色名。 */
export function userName() {
    const c = ctx();
    return String(c?.name1 || c?.name || '我').trim();
}

export function currentCharacter() {
    const c = ctx();
    if (!c) return null;
    if (c.groupId) {
        const group = c.groups?.find(g => String(g.id) === String(c.groupId));
        return group ? { name: group.name, avatar: null, group: true, members: (group.members || []).map(a => c.characters?.find(ch => ch.avatar === a)?.name).filter(Boolean) } : null;
    }
    const ch = c.characters?.[c.characterId];
    return ch ? { ...ch, group: false } : null;
}

/** 所有角色卡（只取小手机用得到的字段）。 */
export function allCharacters() {
    const c = ctx();
    return (c?.characters || []).filter(ch => ch && ch.name).map(ch => ({
        name: ch.name,
        avatar: ch.avatar || '',
        description: ch.description || '',
        personality: ch.personality || '',
        scenario: ch.scenario || '',
        mesExample: ch.mes_example || '',
    }));
}

export function findCharacter(name) {
    if (!name) return null;
    const list = allCharacters();
    return list.find(ch => ch.name === name)
        || list.find(ch => ch.name.toLowerCase() === String(name).toLowerCase())
        || null;
}

/** 酒馆头像缩略图；没有就返回空串，界面退回首字母。 */
export function thumbnailUrl(type, file) {
    if (!file) return '';
    // 酒馆自带的占位头像不要用，交给首字母渐变头像
    if (/^(none|user-default|default)\b/i.test(String(file)) || /user-default|default-avatar/i.test(String(file))) return '';
    const c = ctx();
    try {
        if (typeof c?.getThumbnailUrl === 'function') return c.getThumbnailUrl(type, file);
    } catch { /* ignore */ }
    return `/thumbnail?type=${type}&file=${encodeURIComponent(file)}`;
}

export function characterAvatar(name) {
    const ch = findCharacter(name);
    return ch?.avatar ? thumbnailUrl('avatar', ch.avatar) : '';
}

/** 用户人设头像（酒馆的 personas.js）。 */
let personaAvatar = '';
export async function loadPersonaAvatar() {
    if (globalThis.__miragePersonaAvatar) {
        personaAvatar = String(globalThis.__miragePersonaAvatar);
        return personaAvatar;
    }
    try {
        const mod = await import(/* @vite-ignore */ new URL('../../../../personas.js', import.meta.url).href);
        personaAvatar = thumbnailUrl('persona', mod?.user_avatar || '');
    } catch { /* 预览环境或旧版酒馆：忽略 */ }
    return personaAvatar;
}
export function personaAvatarUrl() {
    return personaAvatar;
}

export function personaDescription() {
    const c = ctx();
    return String(c?.powerUserSettings?.persona_description || '').slice(0, 2000);
}

/** 最近的剧情，给手机当背景。 */
export function storyContext(limit = 8, each = 360) {
    const c = ctx();
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    return chat
        .filter(m => m && !m.is_system && String(m.mes || '').trim())
        .slice(-limit)
        .map(m => ({
            name: m.is_user ? userName() : String(m.name || '对方'),
            isUser: !!m.is_user,
            text: String(m.mes || '').replace(/\s+/g, ' ').trim().slice(0, each),
        }));
}

/**
 * 优先从记忆里取：酒馆的记忆扩展、摘要、长期记忆、向量存储留下的文字。
 * 没有记忆扩展时返回空数组，让调用方退回聊天记录。
 */
export function memoryContext(limit = 12) {
    const c = ctx();
    const out = [];
    const seen = new Set();
    const push = (text, tag) => {
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        if (clean.length < 16 || seen.has(clean)) return;
        seen.add(clean);
        out.push({ text: clean.slice(0, 1200), tag });
    };
    const walk = (value, path, depth) => {
        if (!value || depth > 3 || out.length > 80) return;
        if (typeof value === 'string') {
            if (value.length >= 24 && /memory|summary|记忆|摘要|长期|vector|vectorized|remember/i.test(path)) push(value, 'memory');
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) walk(item, path, depth + 1);
            return;
        }
        if (typeof value === 'object') {
            for (const [key, item] of Object.entries(value)) walk(item, path + '.' + key, depth + 1);
        }
    };
    try { walk(c?.chatMetadata, 'chatMetadata', 0); } catch { /* ignore */ }
    try {
        for (const msg of Array.isArray(c?.chat) ? c.chat : []) {
            const name = String(msg?.name || '');
            if (msg?.is_system || /summary|摘要|记忆|总结/i.test(name) || /summary/i.test(String(msg?.extra?.type || ''))) {
                push(msg?.mes, 'summary');
            }
        }
    } catch { /* ignore */ }
    return out.slice(-limit);
}

/** 记忆库/摘要拼成一段纯文本，给各种生成用。 */
export function memoryText(limit = 12, each = 600) {
    return memoryContext(limit).map(item => String(item.text || '').slice(0, each)).filter(Boolean).join('\n');
}

/**
 * 从聊天里挑重要的，而不是只取最后几条。
 * 摘要/系统消息、长消息、带事件词和引号的消息权重更高，同时保留最近几条。
 */
export function importantStoryContext(limit = 48, each = 840) {
    const c = ctx();
    const chat = Array.isArray(c?.chat) ? c.chat : [];
    const messages = chat
        .map((msg, index) => ({ msg, index }))
        .filter(item => item.msg && !item.msg.is_system && String(item.msg.mes || '').trim());
    if (!messages.length) return [];
    const words = ['记得', '答应', '秘密', '发现', '决定', '离开', '回来', '以前', '后来', '因为', '所以', '约定', '照片', '钥匙', '名字', '真相', '害怕', '喜欢', '爱', '死'];
    const scored = messages.map(item => {
        const text = String(item.msg.mes || '');
        let score = 0;
        if (text.length > 120) score += 2;
        if (text.length > 400) score += 1;
        if (/[「」“”"']/.test(text)) score += 1;
        for (const word of words) if (text.includes(word)) score += 1;
        score += (item.index / Math.max(1, messages.length)) * 2;
        return { ...item, score };
    });
    const keep = new Set();
    const last = scored.slice(-8);
    for (const item of last) keep.add(item.index);
    for (const item of [...scored].sort((a, b) => b.score - a.score)) {
        if (keep.size >= limit) break;
        keep.add(item.index);
    }
    return scored
        .filter(item => keep.has(item.index))
        .sort((a, b) => a.index - b.index)
        .map(item => ({
            name: item.msg.is_user ? userName() : String(item.msg.name || '对方'),
            isUser: !!item.msg.is_user,
            text: String(item.msg.mes || '').replace(/\s+/g, ' ').trim().slice(0, each),
        }));
}

/** 把一段文字作为角色消息写进酒馆当前聊天。 */
export function appendStoryMessage(text, { name = '' } = {}) {
    try {
        const c = ctx();
        if (!c || !Array.isArray(c.chat)) return false;
        const character = c.characters?.[c.characterId];
        const speaker = name || character?.name || '旁白';
        const message = {
            name: speaker,
            is_user: false,
            is_system: false,
            send_date: Date.now(),
            mes: String(text || '').trim(),
            extra: {},
        };
        if (!message.mes) return false;
        c.chat.push(message);
        c.addOneMessage?.(message);
        c.saveChat?.();
        c.scrollChatToBottom?.();
        return true;
    } catch {
        return false;
    }
}

/** 让酒馆主模型按一段指令生成一次完整回复。 */
/** 以用户身份发一条消息，然后让酒馆 AI 生成回复。 */
export function sendAsUserAndGenerate(text) {
    try {
        const c = ctx();
        if (!c) return false;
        const content = String(text || '').trim();
        if (!content) return false;

        // 优先走酒馆自己的发送框，保证用户消息一定出现并触发回复
        const textarea = document.querySelector('#send_textarea');
        const button = document.querySelector('#send_but');
        if (textarea && button) {
            textarea.value = content;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            button.click();
            return true;
        }

        if (!Array.isArray(c.chat)) return false;
        const message = {
            name: c.name1 || userName() || '我',
            is_user: true,
            is_system: false,
            send_date: Date.now(),
            mes: content,
            extra: {},
        };
        c.chat.push(message);
        c.addOneMessage?.(message);
        c.saveChat?.();
        c.scrollChatToBottom?.();
        setTimeout(() => { try { c.generate?.(); } catch { /* ignore */ } }, 260);
        return true;
    } catch {
        return false;
    }
}

export function generateStory(instruction) {
    try {
        const c = ctx();
        if (!c) return false;
        setOneShot(instruction);
        let cleared = false;
        const clear = () => {
            if (cleared) return;
            cleared = true;
            setOneShot('');
        };
        try {
            const key = c.eventTypes?.GENERATION_ENDED;
            c.eventSource?.once?.(key, clear);
        } catch { /* ignore */ }
        setTimeout(clear, 120000);
        setTimeout(() => { try { c.generate?.(); } catch { clear(); } }, 180);
        return true;
    } catch {
        return false;
    }
}

export function chatId() {
    try {
        return ctx()?.getCurrentChatId?.() || ctx()?.chatId || '';
    } catch {
        return '';
    }
}

/**
 * 独立生成（不写入聊天）。
 * 加一层超时：酒馆的 generateRaw 没有超时，接口卡住时手机不能一直转圈。
 */
const GENERATE_TIMEOUT = 120000;

function customAI() {
    try {
        const config = ctx()?.extensionSettings?.mirage_phone?.ai;
        if (!config || config.useMain !== false) return null;
        if (!config.baseUrl || !config.model) return null;
        return { baseUrl: String(config.baseUrl).replace(/\/$/, ''), apiKey: String(config.apiKey || ''), model: String(config.model) };
    } catch { return null; }
}

async function customGenerate(config, system, prompt, length) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT);
    try {
        const response = await fetch(config.baseUrl + '/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.apiKey },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    ...(system ? [{ role: 'system', content: system }] : []),
                    { role: 'user', content: prompt },
                ],
                max_tokens: Math.max(64, Math.round(length)),
                temperature: 0.9,
            }),
        });
        if (!response.ok) {
            let detail = '';
            try { detail = (await response.text()).slice(0, 160); } catch { /* ignore */ }
            throw new Error('独立 API 返回 ' + response.status + (detail ? '：' + detail : ''));
        }
        const data = await response.json();
        if (data?.error) throw new Error('独立 API 报错：' + String(data.error?.message || data.error).slice(0, 180));
        const choice = data?.choices?.[0];
        const text = String(choice?.message?.content || choice?.text || '').trim();
        if (!text) throw new Error('独立 API 没有返回内容');
        return text;
    } finally {
        clearTimeout(timer);
    }
}

/** 从原始响应里取正文；有些推理模型会把手上的 JSON 放进 reasoning。 */
function textFromData(data) {
    const choice = data?.choices?.[0];
    let text = choice?.message?.content ?? choice?.text ?? '';
    if (Array.isArray(text)) text = text.map(part => (typeof part === 'string' ? part : part?.text || '')).join('');
    return String(text || '').trim();
}

function jsonFromReasoning(data) {
    const choice = data?.choices?.[0];
    const reasoning = String(choice?.message?.reasoning_content || choice?.message?.reasoning || '');
    const start = reasoning.indexOf('{');
    const end = reasoning.lastIndexOf('}');
    return start >= 0 && end > start ? reasoning.slice(start, end + 1) : '';
}

/**
 * 独立生成（不写入聊天）。
 * 优先走 generateRawData 自己取正文：酒馆的 generateRaw 会再清洗一遍，
 * 有时会把 JSON 或推理模型的结果清成空字符串（No message generated）。
 */
export async function generateText({ system = '', prompt = '', length = 320, json = false } = {}) {
    const c = ctx();
    if (!c) throw new Error('还没有连上酒馆');
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) throw new Error('提示词是空的');

    const request = {
        prompt: cleanPrompt,
        systemPrompt: String(system || '').trim(),
        responseLength: Math.max(64, Math.round(length)),
        trimNames: false,
    };

    async function attempt() {
        const custom = customAI();
        if (custom) {
            // 设置里选了独立 API 就只走独立 API，不再偷偷回退主 API
            return await customGenerate(custom, String(system || '').trim(), cleanPrompt, request.responseLength);
        }
        if (typeof c.generateRawData === 'function') {
            const data = await c.generateRawData(request);
            const text = textFromData(data) || (json ? jsonFromReasoning(data) : '');
            if (text) return text;
            throw new Error('模型没有返回内容');
        }
        if (typeof c.generateRaw === 'function') {
            const raw = await c.generateRaw(request);
            return String(raw || '').trim();
        }
        if (typeof c.generateQuietPrompt === 'function') {
            const raw = await c.generateQuietPrompt({
                quietPrompt: [system, cleanPrompt].filter(Boolean).join('\n\n'),
                quietToLoud: false,
                responseLength: request.responseLength,
            });
            return String(raw || '').trim();
        }
        throw new Error('当前酒馆版本不支持独立生成，请更新到 1.13 以上');
    }

    let timer = 0;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
            try { c.stopGeneration?.(); } catch { /* ignore */ }
            reject(new Error('等了 ' + Math.round(GENERATE_TIMEOUT / 1000) + ' 秒还没有回复，检查一下酒馆的 API 设置'));
        }, GENERATE_TIMEOUT);
    });

    const work = (async () => {
        let lastError = null;
        for (let i = 0; i < 2; i++) {
            try {
                return await attempt();
            } catch (error) {
                lastError = error;
                const text = String(error?.message || '');
                const retryable = /No message generated|没有返回内容|空|empty/i.test(text);
                if (!retryable || i === 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        throw lastError || new Error('生成失败');
    })();

    try {
        return await Promise.race([work, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

/** 手机里点「带进剧情」时，把一段话交给下一次正文。 */
const oneShotKey = 'mirage_phone_oneshot';
export function setOneShot(text) {
    const c = ctx();
    if (!c?.setExtensionPrompt) return false;
    c.setExtensionPrompt(oneShotKey, String(text || ''), 1, 0, false, 0);
    return true;
}
export function clearOneShot() {
    const c = ctx();
    if (!c?.setExtensionPrompt) return;
    c.setExtensionPrompt(oneShotKey, '', 1, 0, false, 0);
}

/** 手机状态注入正文（每次生成都会带上）。 */
export function setPhonePrompt(text, { depth = 2, enabled = true } = {}) {
    const c = ctx();
    if (!c?.setExtensionPrompt) return;
    const key = 'mirage_phone_state';
    if (!enabled || !text) {
        c.setExtensionPrompt(key, '', 1, 0, false, 0);
        return;
    }
    c.setExtensionPrompt(key, String(text), 1, Math.max(0, Math.round(depth)), false, 0);
}

/** 保存聊天级数据 / 全局设置。 */
export function saveChatMetadata() {
    const c = ctx();
    try {
        if (typeof c?.saveMetadata === 'function') { c.saveMetadata(); return; }
        if (typeof c?.saveMetadataDebounced === 'function') { c.saveMetadataDebounced(); return; }
    } catch (error) {
        console.warn('[幻镜手机] 保存聊天数据失败', error);
    }
}

export function saveGlobalSettings() {
    try {
        ctx()?.saveSettingsDebounced?.();
    } catch (error) {
        console.warn('[幻镜手机] 保存设置失败', error);
    }
}

export function subscribe(eventName, handler) {
    const c = ctx();
    const key = c?.eventTypes?.[eventName] || eventName;
    try {
        c?.eventSource?.on?.(key, handler);
        return () => c?.eventSource?.removeListener?.(key, handler);
    } catch {
        return () => {};
    }
}

export function toast(message, type = 'info') {
    const text = String(message || '').slice(0, 200);
    try {
        if (globalThis.toastr?.[type]) { globalThis.toastr[type](text, '幻镜手机'); return; }
    } catch { /* ignore */ }
    console.info('[幻镜手机]', text);
}

/** 读世界书条目：角色卡内嵌的 + 绑定的那本。返回 [{title, content}]。 */
export async function worldBookEntries(limit = 60) {
    const c = ctx();
    const out = [];
    const seen = new Set();
    const push = (title, content) => {
        const text = String(content || '').trim();
        if (!text) return;
        const key = text.slice(0, 40);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ title: String(title || '条目').slice(0, 40), content: text.slice(0, 420) });
    };
    try {
        const data = c?.characters?.[c?.characterId]?.data;
        const book = data?.character_book || data?.data?.character_book;
        for (const entry of book?.entries || []) {
            if (entry?.disable) continue;
            push(entry?.comment || entry?.keys?.[0] || entry?.key?.[0], entry?.content);
            if (out.length >= limit) return out;
        }
    } catch { /* ignore */ }
    const names = new Set();
    try {
        const bound = c?.characters?.[c?.characterId]?.data?.extensions?.world;
        if (bound) names.add(String(bound));
        const chatWorld = c?.chatMetadata?.world_info || c?.chatMetadata?.worldInfo;
        if (chatWorld) names.add(String(chatWorld));
    } catch { /* ignore */ }
    for (const name of names) {
        try {
            const response = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...requestHeaders() },
                body: JSON.stringify({ name }),
            });
            if (!response.ok) continue;
            const json = await response.json();
            for (const entry of Object.values(json?.entries || {})) {
                if (entry?.disable) continue;
                push(entry?.comment || entry?.key?.[0], entry?.content);
                if (out.length >= limit) return out;
            }
        } catch { /* ignore */ }
    }
    return out;
}

export function requestHeaders() {
    try {
        return ctx()?.getRequestHeaders?.() || {};
    } catch {
        return {};
    }
}

/** 在正文输入框里填字（不发送），用于「带进输入框」。 */
export function fillInput(text) {
    const c = ctx();
    try {
        if (typeof globalThis.triggerSlash === 'function') {
            const escaped = String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
            globalThis.triggerSlash(`/setinput "${escaped}"`);
            return true;
        }
        const area = document.querySelector('#send_textarea');
        if (area instanceof HTMLTextAreaElement) {
            area.value = String(text);
            area.dispatchEvent(new Event('input', { bubbles: true }));
            area.focus();
            return true;
        }
    } catch (error) {
        console.warn('[幻镜手机] 填入输入框失败', error);
    }
    return false;
}

/**
 * 只看视口宽度，不看酒馆的 isMobile。
 * ST 的 context.isMobile 在 1.18 里是个对象（不是布尔值），
 * 用它判断会让桌面端误以为在手机上，缩放就失效了。
 */
export function isNarrow() {
    try {
        const width = globalThis.innerWidth || 0;
        const height = globalThis.innerHeight || 0;
        // 竖屏手机：按宽度；横屏手机：按高度（平板横屏通常高度 > 520，不受影响）
        return width <= 760 || (height <= 520 && width <= 940);
    } catch {
        return false;
    }
}