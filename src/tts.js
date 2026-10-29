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

export function ttsConfig() {
    return getSettings().tts || {};
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
            speed: Math.max(0.5, Math.min(2, Number(config.rate) || 1)),
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
    audioEl.volume = Math.max(0, Math.min(1, Number(config.volume) || 1));
    await audioEl.play();
    return true;
}

export async function speak(text, { voiceName = '', rate = 1 } = {}) {
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
    const voices = ttsVoices();
    const picked = voices.find(item => item.name === (voiceName || config.voice))
        || voices.find(item => /^zh|Chinese|中文|普通话/i.test(item.lang + ' ' + item.name))
        || voices[0];
    try {
        globalThis.speechSynthesis.cancel();
        const utter = new globalThis.SpeechSynthesisUtterance(clean);
        utter.lang = picked?.lang || 'zh-CN';
        if (picked) utter.voice = picked;
        utter.rate = Math.max(0.5, Math.min(2, Number(rate || config.rate) || 1));
        utter.pitch = Math.max(0.5, Math.min(2, Number(config.pitch) || 1));
        utter.volume = Math.max(0, Math.min(1, Number(config.volume) || 1));
        globalThis.speechSynthesis.speak(utter);
        return true;
    } catch {
        return false;
    }
}
