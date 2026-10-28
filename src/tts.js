/** 浏览器自带 TTS：朗读手机消息，不依赖外部接口。 */
import { getSettings } from './store.js';

export function ttsSupported() {
    return typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance !== 'undefined';
}

export function ttsVoices() {
    if (!ttsSupported()) return [];
    try { return globalThis.speechSynthesis.getVoices() || []; } catch { return []; }
}

export function ttsConfig() {
    const settings = getSettings();
    return settings.tts || { enabled: false, auto: false, rate: 1, voice: '' };
}

export function stopTts() {
    if (!ttsSupported()) return;
    try { globalThis.speechSynthesis.cancel(); } catch { /* ignore */ }
}

export function speak(text, { voiceName = '', rate = 1 } = {}) {
    const clean = String(text || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!clean || !ttsSupported()) return false;
    const config = ttsConfig();
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
        utter.pitch = 1;
        globalThis.speechSynthesis.speak(utter);
        return true;
    } catch {
        return false;
    }
}
