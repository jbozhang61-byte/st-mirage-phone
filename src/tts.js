/** TTS：系统语音，或 OpenAI 兼容的 /audio/speech 接口。 */
import { getSettings } from './store.js';

let audioEl = null;
let audioUrl = '';

export function ttsSupported() {
    return typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance !== 'undefined';
}

export function ttsVoices() {
    if (!ttsSupported()) return [];
    try { return globalThis.speechSynthesis.getVoices() || []; } catch { return []; }
}

/** 中文优先的语音列表：能选的都是中文，其它语言放后面。 */
export function ttsVoiceList() {
    const voices = ttsVoices();
    const zh = voices.filter(voice => /zh|Chinese|中文|普通话|粤语/i.test(String(voice.lang || '') + ' ' + String(voice.name || '')));
    return [...zh, ...voices.filter(voice => !zh.includes(voice))];
}

export function ttsConfig() {
    return getSettings().tts || {};
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * 挑一个系统语音：指定了名字就用指定的人；开了「按人分配」就按说话人名字散列，
 * 保证同一个人永远是同一个嗓子、不同人有不同嗓子。
 */
export function pickVoice(voices, { name = '', config = {} } = {}) {
    const list = Array.isArray(voices) ? voices.filter(Boolean) : [];
    if (!list.length) return null;
    const named = name ? list.find(voice => voice.name === name) : null;
    if (named) return named;
    const chosen = config.voice ? list.find(voice => voice.name === config.voice) : null;
    if (chosen) return chosen;
    const zh = list.filter(voice => /zh|Chinese|中文|普通话/i.test(String(voice.lang || '') + ' ' + String(voice.name || '')));
    const pool = zh.length ? zh : list;
    if (config.multiVoice !== false && pool.length > 1 && !config.voice) {
        const speaker = String(config.speaker || '');
        if (speaker) {
            // FNV-1a：名字散得开一点，不同人尽量落到不同嗓子
            let hash = 2166136261;
            for (let i = 0; i < speaker.length; i++) {
                hash ^= speaker.charCodeAt(i);
                hash = Math.imul(hash, 16777619);
            }
            // 再抖一次，名字短、嗓子少的时候也不容易全挤到同一个
            const mixed = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d) >>> 0;
            return pool[mixed % pool.length];
        }
    }
    return pool[0];
}

export function stopTts() {
    try { globalThis.speechSynthesis?.cancel(); } catch { /* ignore */ }
    try { audioEl?.pause(); } catch { /* ignore */ }
    audioEl = null;
    if (audioUrl) { try { URL.revokeObjectURL(audioUrl); } catch { /* ignore */ } audioUrl = ''; }
}

async function apiSpeak(text, config) {
    const baseUrl = String(config.baseUrl || '').replace(/\/$/, '');
    if (!baseUrl) throw new Error('没有填 TTS 接口地址');
    const response = await fetch(baseUrl + '/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (config.apiKey || '') },
        body: JSON.stringify({
            model: config.model || 'tts-1',
            input: text,
            voice: config.apiVoice || 'alloy',
            speed: clamp(Number(config.rate) || 1, 0.5, 2),
            response_format: 'mp3',
        }),
    });
    if (!response.ok) {
        let detail = '';
        try { detail = (await response.text()).slice(0, 160); } catch { /* ignore */ }
        throw new Error('TTS 接口返回 ' + response.status + (detail ? '：' + detail : ''));
    }
    const blob = await response.blob();
    stopTts();
    audioUrl = URL.createObjectURL(blob);
    audioEl = new Audio(audioUrl);
    audioEl.volume = clamp(Number(config.volume ?? 1), 0, 1);
    await audioEl.play();
    return true;
}

export async function speak(text, { voiceName = '', rate = 0, speaker = '' } = {}) {
    const clean = String(text || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 900);
    if (!clean) return false;
    const config = ttsConfig();
    if (config.provider === 'openai') {
        try {
            return await apiSpeak(clean, config);
        } catch (error) {
            console.warn('[幻镜手机] 接口 TTS 失败，改用系统语音', error);
        }
    }
    if (!ttsSupported()) return false;
    const picked = pickVoice(ttsVoiceList(), { name: voiceName, config: { ...config, speaker } });
    try {
        globalThis.speechSynthesis.cancel();
        const utter = new globalThis.SpeechSynthesisUtterance(clean);
        utter.lang = picked?.lang || 'zh-CN';
        if (picked) utter.voice = picked;
        // 系统语音在 0.8–1.25 之外很容易变调，这里收窄一点
        utter.rate = clamp(Number(rate || config.rate) || 1, 0.6, 1.6);
        utter.pitch = clamp(Number(config.pitch) || 1, 0.8, 1.3);
        utter.volume = clamp(Number(config.volume ?? 1), 0, 1);
        globalThis.speechSynthesis.speak(utter);
        return true;
    } catch {
        return false;
    }
}
