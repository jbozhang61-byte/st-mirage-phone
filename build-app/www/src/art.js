/**
 * 离线「照片」库：用 seed 生成上千种不同的构图，不需要外部图片。
 * 同一张图始终一致；有接口生图时会优先用真图。
 */
const PALETTES = {
    night: { sky: ['#22345c', '#070d18'], glow: '#ffe1a1', far: '#16233a', near: '#0a111c', accent: '#ffd27a', ink: '#04070c', text: '#e8f1ff' },
    dusk: { sky: ['#6d3b55', '#160d1a'], glow: '#ffb27a', far: '#3a2433', near: '#1a1018', accent: '#ffcf9e', ink: '#0d0710', text: '#fff1e6' },
    snow: { sky: ['#cddce7', '#7b8fa0'], glow: '#ffffff', far: '#9fb0bd', near: '#556a78', accent: '#ffffff', ink: '#33434e', text: '#20303a' },
    warm: { sky: ['#f6c9a0', '#b86a52'], glow: '#fff0d4', far: '#8a5a45', near: '#4a2b24', accent: '#ffcf9e', ink: '#2b1712', text: '#fff8ee' },
    cold: { sky: ['#cfe3f5', '#6f93b0'], glow: '#ffffff', far: '#7f9aad', near: '#3d5566', accent: '#eaf4ff', ink: '#1c2c38', text: '#f4fbff' },
    neon: { sky: ['#2b0b45', '#05020a'], glow: '#ff4d9d', far: '#1b0c27', near: '#07030c', accent: '#4de1ff', ink: '#04010a', text: '#e8feff' },
    green: { sky: ['#b8d9c2', '#3a5e4a'], glow: '#ffe9b0', far: '#5f816b', near: '#263d2f', accent: '#f4e2a1', ink: '#101c15', text: '#f6fff8' },
    paper: { sky: ['#efe4cf', '#cbb99b'], glow: '#fffaf0', far: '#c4b094', near: '#8f7a5d', accent: '#7c4a32', ink: '#3a2b1d', text: '#3a2b1d' },
};

const cache = new Map();

function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); }
    return value >>> 0;
}

function random(seed) {
    let state = seed || 1;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

const W = 600;
const H = 900;

function grain(rand) {
    const dots = [];
    for (let i = 0; i < 40; i++) dots.push('<circle cx="' + (rand() * W).toFixed(0) + '" cy="' + (rand() * H).toFixed(0) + '" r="' + (0.4 + rand() * 1.1).toFixed(1) + '" fill="#fff" opacity="' + (0.02 + rand() * 0.08).toFixed(2) + '"/>');
    return dots.join('');
}

function glow(p, x, y, r) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#glow)"/>';
}

function sceneLandscape(p, rand) {
    const horizon = 380 + rand() * 200;
    let out = '<circle cx="' + (100 + rand() * 400) + '" cy="' + (140 + rand() * 160) + '" r="' + (46 + rand() * 40) + '" fill="' + p.glow + '" opacity=".85"/>';
    for (let layer = 0; layer < 4; layer++) {
        let path = 'M0 ' + H + ' L0 ' + (horizon + layer * 48);
        for (let i = 1; i <= 8; i++) path += ' L' + (W / 8 * i).toFixed(0) + ' ' + (horizon + layer * 48 - 20 - rand() * 100).toFixed(0);
        path += ' L' + W + ' ' + H + ' Z';
        out += '<path d="' + path + '" fill="' + (layer % 2 ? p.near : p.far) + '" opacity="' + (0.5 + layer * 0.13).toFixed(2) + '"/>';
    }
    return out;
}

function sceneCity(p, rand) {
    let out = '<rect y="' + (H * 0.55) + '" width="' + W + '" height="' + (H * 0.45) + '" fill="' + p.near + '"/>';
    for (let i = 0; i < 12; i++) {
        const w = 26 + rand() * 52;
        const x = i * 52 + rand() * 12 - 20;
        const h = 110 + rand() * 330;
        out += '<rect x="' + x.toFixed(0) + '" y="' + (H * 0.6 - h).toFixed(0) + '" width="' + w.toFixed(0) + '" height="' + h.toFixed(0) + '" fill="' + p.ink + '" opacity=".88"/>';
        for (let j = 0; j < 8; j++) {
            if (rand() < 0.45) continue;
            out += '<rect x="' + (x + 5 + rand() * (w - 13)).toFixed(0) + '" y="' + (H * 0.6 - h + 12 + rand() * (h - 30)).toFixed(0) + '" width="' + (2 + rand() * 5).toFixed(0) + '" height="' + (2 + rand() * 4).toFixed(0) + '" fill="' + (rand() > 0.8 ? p.accent : p.glow) + '" opacity="' + (0.3 + rand() * 0.6).toFixed(2) + '"/>';
        }
    }
    return out;
}

function sceneStreet(p, rand) {
    let out = '<rect width="' + W + '" height="' + H + '" fill="' + p.near + '"/>';
    out += '<path d="M' + (W * 0.2) + ' ' + H + ' L' + (W * 0.44) + ' ' + (H * 0.42) + ' L' + (W * 0.56) + ' ' + (H * 0.42) + ' L' + (W * 0.86) + ' ' + H + ' Z" fill="' + p.ink + '" opacity=".65"/>';
    for (let i = 0; i < 7; i++) {
        const t = i / 7;
        out += '<rect x="' + (W * 0.18 + t * W * 0.1) + '" y="' + (H * 0.3 - t * 100) + '" width="' + (10 + t * 16).toFixed(0) + '" height="' + (30 + t * 90).toFixed(0) + '" fill="' + p.far + '" opacity=".9"/>';
        out += '<circle cx="' + (W * 0.2 + t * W * 0.12) + '" cy="' + (H * 0.3 - t * 100) + '" r="' + (7 + t * 16).toFixed(0) + '" fill="' + p.glow + '" opacity=".8"/>';
    }
    return out;
}

function sceneInterior(p, rand) {
    let out = '<rect width="' + W + '" height="' + H + '" fill="' + p.far + '"/>';
    out += '<rect x="80" y="120" width="260" height="330" rx="6" fill="' + p.sky[0] + '" opacity=".8"/>';
    out += '<rect x="80" y="120" width="260" height="330" rx="6" fill="none" stroke="' + p.ink + '" stroke-width="10" opacity=".5"/>';
    out += '<path d="M80 120 L340 450" stroke="' + p.ink + '" stroke-width="9" opacity=".35"/>';
    out += '<rect x="365" y="380" width="170" height="16" rx="8" fill="' + p.ink + '" opacity=".7"/>';
    out += '<circle cx="450" cy="350" r="26" fill="' + p.glow + '" opacity=".9"/>';
    out += '<rect x="426" y="350" width="10" height="120" fill="' + p.ink + '" opacity=".6"/>';
    out += '<rect x="60" y="600" width="480" height="180" rx="20" fill="' + p.ink + '" opacity=".4"/>';
    return out;
}

function scenePortrait(p, rand) {
    const cx = W / 2 + (rand() - 0.5) * 80;
    let out = '<rect width="' + W + '" height="' + H + '" fill="' + p.far + '"/>';
    out += '<circle cx="' + cx + '" cy="320" r="200" fill="' + p.glow + '" opacity=".25"/>';
    out += '<ellipse cx="' + cx + '" cy="330" rx="120" ry="145" fill="' + p.ink + '"/>';
    out += '<path d="M' + (cx - 190) + ' ' + H + ' Q' + (cx - 160) + ' 560 ' + cx + ' 470 Q' + (cx + 160) + ' 560 ' + (cx + 190) + ' ' + H + ' Z" fill="' + p.ink + '"/>';
    out += '<path d="M' + (cx - 110) + ' 300 Q' + cx + ' 200 ' + (cx + 110) + ' 300" stroke="' + p.accent + '" stroke-width="6" fill="none" opacity=".4"/>';
    return out;
}

function sceneFood(p, rand) {
    let out = '<rect width="' + W + '" height="' + H + '" fill="' + (p === PALETTES.paper ? '#d8c3a0' : p.far) + '"/>';
    for (let i = 0; i < 3; i++) {
        const cx = 160 + rand() * 300;
        const cy = 250 + rand() * 380;
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (78 + rand() * 34) + '" fill="' + p.ink + '" opacity=".2"/>';
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (58 + rand() * 28) + '" fill="' + p.glow + '" opacity=".55"/>';
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (30 + rand() * 22) + '" fill="' + p.accent + '" opacity=".7"/>';
    }
    out += '<rect x="420" y="120" width="90" height="130" rx="12" fill="' + p.glow + '" opacity=".5"/>';
    out += '<rect x="440" y="80" width="50" height="70" rx="8" fill="' + p.accent + '" opacity=".4"/>';
    return out;
}

function sceneProduct(p, rand) {
    let out = '<rect width="' + W + '" height="' + H + '" fill="' + p.sky[0] + '"/>';
    out += '<rect y="540" width="' + W + '" height="360" fill="' + p.far + '" opacity=".8"/>';
    out += '<rect x="200" y="210" width="180" height="300" rx="26" fill="' + p.ink + '" opacity=".9"/>';
    out += '<rect x="250" y="150" width="80" height="80" rx="12" fill="' + p.accent + '" opacity=".7"/>';
    out += '<ellipse cx="300" cy="575" rx="150" ry="22" fill="#000" opacity=".25"/>';
    out += '<circle cx="420" cy="300" r="54" fill="' + p.glow + '" opacity=".25"/>';
    return out;
}

function sceneAbstract(p, rand) {
    let out = '';
    for (let i = 0; i < 9; i++) {
        out += '<circle cx="' + (rand() * W).toFixed(0) + '" cy="' + (rand() * H).toFixed(0) + '" r="' + (60 + rand() * 220).toFixed(0) + '" fill="' + (i % 2 ? p.accent : p.glow) + '" opacity="' + (0.05 + rand() * 0.14).toFixed(2) + '"/>';
    }
    return out;
}

function sceneSnow(p, rand) {
    let out = sceneLandscape(p, rand);
    for (let i = 0; i < 60; i++) out += '<circle cx="' + (rand() * W).toFixed(0) + '" cy="' + (rand() * H).toFixed(0) + '" r="' + (1 + rand() * 3).toFixed(1) + '" fill="#fff" opacity="' + (0.2 + rand() * 0.6).toFixed(2) + '"/>';
    return out;
}

function sceneBook(p, rand) {
    let out = '<rect width="' + W + '" height="' + H + '" fill="' + p.far + '"/>';
    out += '<rect x="120" y="180" width="360" height="480" rx="8" fill="' + p.ink + '" opacity=".85"/>';
    out += '<rect x="140" y="200" width="320" height="440" rx="4" fill="' + p.sky[0] + '" opacity=".55"/>';
    for (let i = 0; i < 7; i++) out += '<rect x="180" y="' + (270 + i * 38) + '" width="' + (140 + rand() * 150).toFixed(0) + '" height="4" rx="2" fill="' + p.text + '" opacity=".3"/>';
    out += '<circle cx="300" cy="230" r="30" fill="' + p.accent + '" opacity=".5"/>';
    return out;
}

const SCENES = [sceneLandscape, sceneCity, sceneStreet, sceneInterior, scenePortrait, sceneFood, sceneProduct, sceneAbstract, sceneSnow, sceneBook];
const MOOD_SCENE = { snow: sceneSnow, food: sceneFood, portrait: scenePortrait, city: sceneCity };
const SCENE_SETS = {
    night: [sceneLandscape, sceneCity, sceneStreet, sceneInterior, scenePortrait, sceneAbstract],
    dusk: [sceneLandscape, sceneCity, sceneStreet, sceneInterior, scenePortrait, sceneAbstract],
    neon: [sceneStreet, sceneCity, sceneAbstract, sceneInterior],
    snow: [sceneSnow, sceneLandscape, sceneCity],
    warm: [sceneLandscape, sceneFood, sceneInterior, scenePortrait],
    cold: [sceneLandscape, sceneSnow, sceneCity, sceneAbstract],
    green: [sceneLandscape, sceneInterior, sceneAbstract],
    paper: [sceneBook, sceneProduct, sceneFood, sceneAbstract],
};

export function artSvg(seedText, mood = 'night') {
    const moodKey = PALETTES[mood] ? mood : 'night';
    const p = PALETTES[moodKey];
    const seed = hash(seedText || 'mirage');
    const rand = random(seed);
    const set = SCENE_SETS[moodKey] || SCENES;
    const scene = MOOD_SCENE[mood] || set[seed % set.length];
    return '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">' +
        '<defs>' +
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + p.sky[0] + '"/><stop offset="1" stop-color="' + p.sky[1] + '"/></linearGradient>' +
        '<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="' + p.glow + '" stop-opacity=".9"/><stop offset="1" stop-color="' + p.glow + '" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="vig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".12"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>' +
        '</defs>' +
        '<rect width="600" height="900" fill="url(#sky)"/>' +
        scene(p, rand) + grain(rand) +
        '<rect width="600" height="900" fill="url(#vig)"/>' +
        '<rect width="600" height="900" fill="' + p.ink + '" opacity="' + (0.03 + rand() * 0.05).toFixed(2) + '"/>' +
        '</svg>';
}

const LIB_COUNT = 240;
let libBase = '';
try { libBase = new URL('../assets/library/', import.meta.url).href; } catch { libBase = ''; }

function libraryUrl(seedText) {
    if (!libBase || globalThis.__mpArtPack === false) return '';
    const index = (hash(seedText || 'mirage') % LIB_COUNT) + 1;
    return 'url("' + libBase + 'art-' + String(index).padStart(3, '0') + '.svg")';
}

export function artFor(seedText, mood = 'night') {
    const key = mood + '|' + seedText;
    if (cache.has(key)) return cache.get(key);
    const data = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(artSvg(seedText, mood)) + '")';
    const pack = libraryUrl(seedText);
    const real = globalThis.__mpRealPhotos === false ? '' : 'url("https://picsum.photos/seed/' + encodeURIComponent(seedText + '|' + mood) + '/600/900")';
    const layers = [real, pack, data].filter(Boolean);
    const url = layers.join(', ');
    if (cache.size > 400) cache.clear();
    cache.set(key, url);
    return url;
}