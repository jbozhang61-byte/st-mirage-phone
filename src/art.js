/**
 * 程序化「照片」：不用外部图片，也能让视频位/照片位看起来像一张真照片。
 * 同一个 seed 永远得到同一张图。
 */
const PALETTES = {
    warm: { sky: ['#f6c9a0', '#b86a52'], sun: '#ffe9c9', far: '#8a5a45', near: '#4a2b24', accent: '#ffcf9e' },
    cold: { sky: ['#cfe3f5', '#6f93b0'], sun: '#ffffff', far: '#7f9aad', near: '#3d5566', accent: '#eaf4ff' },
    night: { sky: ['#22345c', '#070d18'], sun: '#f5f0dc', far: '#16233a', near: '#0a111c', accent: '#ffd27a' },
    neon: { sky: ['#3a1257', '#070310'], sun: '#ff4d9d', far: '#241038', near: '#0c0514', accent: '#4de1ff' },
    street: { sky: ['#4a3550', '#120b16'], sun: '#ffd08a', far: '#2a1e2e', near: '#140d18', accent: '#ffb46b' },
};

const cache = new Map();

function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) {
        value ^= text.charCodeAt(i);
        value = Math.imul(value, 16777619);
    }
    return value >>> 0;
}

function random(seed) {
    let state = seed;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

export function artFor(seedText, mood = 'night') {
    const key = mood + '|' + seedText;
    if (cache.has(key)) return cache.get(key);
    const palette = PALETTES[mood] || PALETTES.night;
    const rand = random(hash(seedText || 'mirage'));
    const W = 600, H = 900;
    const sunX = 120 + rand() * 360;
    const sunY = 160 + rand() * 160;
    const horizon = 430 + rand() * 90;

    const hills = [];
    for (let layer = 0; layer < 3; layer++) {
        const base = horizon + layer * 55;
        let path = 'M0 ' + H + ' L0 ' + base;
        const steps = 7;
        for (let i = 1; i <= steps; i++) {
            const x = (W / steps) * i;
            const y = base - 20 - rand() * 90 + (layer * 8);
            path += ' L' + x.toFixed(0) + ' ' + y.toFixed(0);
        }
        path += ' L' + W + ' ' + H + ' Z';
        hills.push('<path d="' + path + '" fill="' + (layer === 0 ? palette.far : palette.near) + '" opacity="' + (0.55 + layer * 0.2).toFixed(2) + '"/>');
    }

    const windows = [];
    if (mood === 'night' || mood === 'neon' || mood === 'street') {
        const count = 26 + Math.floor(rand() * 18);
        for (let i = 0; i < count; i++) {
            const x = 20 + rand() * (W - 40);
            const y = horizon + 60 + rand() * 260;
            const lit = rand() > 0.35;
            if (!lit) continue;
            windows.push('<rect x="' + x.toFixed(0) + '" y="' + y.toFixed(0) + '" width="' + (3 + rand() * 4).toFixed(0) + '" height="' + (4 + rand() * 5).toFixed(0) + '" fill="' + (rand() > 0.7 ? palette.accent : '#ffd9a0') + '" opacity="' + (0.35 + rand() * 0.55).toFixed(2) + '"/>');
        }
    }

    const bokeh = [];
    for (let i = 0; i < 14; i++) {
        bokeh.push('<circle cx="' + (rand() * W).toFixed(0) + '" cy="' + (rand() * H * 0.8).toFixed(0) + '" r="' + (2 + rand() * 7).toFixed(1) + '" fill="' + palette.accent + '" opacity="' + (0.08 + rand() * 0.18).toFixed(2) + '"/>');
    }

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">' +
        '<defs>' +
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + palette.sky[0] + '"/><stop offset="1" stop-color="' + palette.sky[1] + '"/></linearGradient>' +
        '<radialGradient id="sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="' + palette.sun + '" stop-opacity="1"/><stop offset="1" stop-color="' + palette.sun + '" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".05"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>' +
        '</defs>' +
        '<rect width="600" height="900" fill="url(#sky)"/>' +
        '<circle cx="' + sunX.toFixed(0) + '" cy="' + sunY.toFixed(0) + '" r="150" fill="url(#sun)" opacity=".75"/>' +
        '<circle cx="' + sunX.toFixed(0) + '" cy="' + sunY.toFixed(0) + '" r="26" fill="' + palette.sun + '" opacity=".9"/>' +
        hills.join('') + windows.join('') + bokeh.join('') +
        '<rect width="600" height="900" fill="url(#vignette)"/>' +
        (mood === 'neon' ? '<rect width="600" height="900" fill="#0a0014" opacity=".18"/>' : '') +
        '</svg>';

    const url = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
    if (cache.size > 80) cache.clear();
    cache.set(key, url);
    return url;
}
