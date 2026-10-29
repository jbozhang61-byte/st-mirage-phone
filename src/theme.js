/**
 * 主题：颜色、深浅、玻璃强度。只改 .mp-root 上的 CSS 变量。
 */
import { ACCENTS } from './state.js';

export function hexToRgb(hex) {
    const value = String(hex || '').replace('#', '');
    const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    const num = parseInt(full, 16);
    if (!Number.isFinite(num)) return [240, 163, 94];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function luminance([r, g, b]) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function resolveTheme(settings) {
    if (settings?.theme === 'light') return 'light';
    if (settings?.theme === 'dark') return 'dark';
    try {
        return globalThis.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
}

/** 低配设备 / 用户选择「流畅」时，关掉昂贵的模糊与动效。 */
export function resolvePerf(settings) {
    if (settings?.perf === 'lite') return true;
    if (settings?.perf === 'full') return false;
    try {
        if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return true;
        if (globalThis.matchMedia?.('(max-width: 760px)')?.matches) return true;
        const cores = globalThis.navigator?.hardwareConcurrency || 8;
        const memory = globalThis.navigator?.deviceMemory || 8;
        return cores <= 4 || memory <= 4;
    } catch {
        return false;
    }
}

export function isLite() {
    try {
        return resolvePerf(JSON.parse(globalThis.localStorage?.getItem('mirage_perf') || 'null') || { perf: 'auto' });
    } catch {
        return false;
    }
}

export function applyThemeVars(el, settings) {
    if (!el) return;
    const lite = resolvePerf(settings);
    el.classList.toggle('is-lite', lite);
    try { globalThis.localStorage?.setItem('mirage_perf', JSON.stringify({ perf: settings?.perf || 'auto' })); } catch { /* ignore */ }
    const accent = ACCENTS[settings?.accent] || ACCENTS.amber;
    const rgb = hexToRgb(accent.color);
    el.setAttribute('data-theme', resolveTheme(settings));
    el.setAttribute('data-skin', settings?.skin || 'mirage');
    el.style.setProperty('--mp-accent', accent.color);
    el.style.setProperty('--mp-accent-rgb', rgb.join(', '));
    el.style.setProperty('--mp-accent-ink', luminance(rgb) > 0.62 ? '#2b1d10' : '#ffffff');
    const blur = Math.round(10 + (Number(settings?.glass) || 0) * 22);
    el.style.setProperty('--mp-blur', blur + 'px');
}