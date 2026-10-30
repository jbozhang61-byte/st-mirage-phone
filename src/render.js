/**
 * 极简 DOM 工具、图标、头像、时间格式化、弹层与轻提示。
 * 不依赖任何框架，也不污染酒馆的样式。
 */

export function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props && typeof props === 'object' && !(props instanceof Node) && !Array.isArray(props)) {
        for (const [key, value] of Object.entries(props)) {
            if (value === undefined || value === null || value === false) continue;
            if (key === 'class' || key === 'className') el.className = value;
            else if (key === 'text') el.textContent = String(value);
            else if (key === 'html') el.innerHTML = value;
            else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
            else if (key === 'dataset' && typeof value === 'object') Object.assign(el.dataset, value);
            else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
            else if (key === 'ref' && typeof value === 'function') value(el);
            else if (value === true) el.setAttribute(key, '');
            else el.setAttribute(key, String(value));
        }
    } else if (props !== undefined && props !== null) {
        children.unshift(props);
    }
    append(el, children);
    return el;
}

export function append(el, children) {
    for (const child of children.flat(4)) {
        if (child === null || child === undefined || child === false) continue;
        el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
}

export function frag(...children) {
    return append(document.createDocumentFragment(), children);
}

export function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* -------------------------------- 图标 -------------------------------- */

const ICONS = {
    message: '<path d="M20.5 11.6a7.9 7.9 0 0 1-8.6 7.9 9 9 0 0 1-3.3-.6L3.5 20.5l1.5-5.1A7.9 7.9 0 1 1 20.5 11.6Z"/><circle cx="8.6" cy="11.8" r="1.05" fill="currentColor" stroke="none"/><circle cx="12.4" cy="11.8" r="1.05" fill="currentColor" stroke="none"/><circle cx="16.2" cy="11.8" r="1.05" fill="currentColor" stroke="none"/>',
    moments: '<circle cx="12" cy="12" r="3.1"/><circle cx="18.6" cy="6.4" r="1.9"/><circle cx="5.1" cy="17.9" r="1.9"/><path d="M12 4.2v4.7M9.1 13.6l-3.2 3.2M14.9 13.6l3.2 3.2"/>',
    contacts: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20.2c.6-3.9 3.5-6.1 7.2-6.1s6.6 2.2 7.2 6.1"/>',
    photos: '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="3.2"/><circle cx="8.6" cy="9.6" r="1.5"/><path d="M4.2 17.4l4.6-4.3a2 2 0 0 1 2.7 0l3 2.8 1.9-1.6a2 2 0 0 1 2.6 0l1.6 1.4"/>',
    notes: '<path d="M5.4 4.4h9.1l4.1 4.1v11.1a1.9 1.9 0 0 1-1.9 1.9H5.4a1.9 1.9 0 0 1-1.9-1.9V6.3a1.9 1.9 0 0 1 1.9-1.9Z"/><path d="M14.3 4.6v4.2h4.2M7.8 12.4h7.2M7.8 16.1h4.8"/>',
    weather: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5"/>',
    settings: '<path d="M4 7.2h9M17 7.2h3M4 16.8h3M11 16.8h9"/><circle cx="14.9" cy="7.2" r="2.3"/><circle cx="8.9" cy="16.8" r="2.3"/>',
    back: '<path d="M14.6 5.4 8 12l6.6 6.6"/>',
    chevron: '<path d="M9.4 5.4 16 12l-6.6 6.6"/>',
    down: '<path d="M5.4 9.4 12 16l6.6-6.6"/>',
    plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
    send: '<path d="M12 19.6V5.2m0 0-5.6 5.6M12 5.2l5.6 5.6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="M4.8 12.6 9.6 17.4 19.2 6.9"/>',
    heart: '<path d="M12 20s-7.6-4.7-7.6-9.5A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.6 2.9C19.6 15.3 12 20 12 20Z"/>',
    comment: '<path d="M20.4 11.4a7.7 7.7 0 0 1-8.4 7.6 9 9 0 0 1-3.1-.5L4 20l1.4-4.3A7.7 7.7 0 1 1 20.4 11.4Z"/>',
    more: '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    mic: '<rect x="9" y="3.2" width="6" height="10.6" rx="3"/><path d="M5.8 11.4a6.2 6.2 0 0 0 12.4 0M12 17.6v3.2M8.8 20.8h6.4"/>',
    image: '<rect x="3.6" y="5" width="16.8" height="14" rx="3"/><circle cx="8.8" cy="10" r="1.4"/><path d="M4.4 17.2l4.4-4.1a2 2 0 0 1 2.7 0l3 2.7 1.8-1.5a2 2 0 0 1 2.5 0l1.3 1.1"/>',
    video: '<rect x="3.2" y="6" width="12.4" height="12" rx="3"/><path d="M15.6 10.4l4.2-2.6a.9.9 0 0 1 1.4.8v6.8a.9.9 0 0 1-1.4.7l-4.2-2.6"/>',
    phone: '<path d="M7.1 3.6h2.4l1.5 4-2 1.4a11.7 11.7 0 0 0 5 5l1.4-2 4 1.5v2.4a2.2 2.2 0 0 1-2.4 2.2C10.2 17.7 4.3 11.8 3.9 5.9a2.2 2.2 0 0 1 2.2-2.3Z"/>',
    location: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="9.8" r="2.6"/>',
    envelope: '<rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.8"/><path d="M3.9 6.7 12 12.8l8.1-6.1"/>',
    transfer: '<path d="M4 8.4h13.2m0 0-3.4-3.4m3.4 3.4-3.4 3.4M20 15.6H6.8m0 0 3.4-3.4m-3.4 3.4 3.4 3.4"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4.4v4.2h-4.2"/>',
    sparkle: '<path d="M12 3.4l1.7 4.6 4.6 1.7-4.6 1.7L12 16l-1.7-4.6L5.7 9.7l4.6-1.7Zm6.4 11.2.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9Z"/>',
    trash: '<path d="M4.8 6.8h14.4M9.4 6.6V4.4h5.2v2.2M6.6 6.9l.9 12a1.8 1.8 0 0 0 1.8 1.7h5.4a1.8 1.8 0 0 0 1.8-1.7l.9-12M10 10.6v6M14 10.6v6"/>',
    pin: '<path d="M12 3.4a5.4 5.4 0 0 1 5.4 5.4c0 4-4 7.6-5.4 10.9-1.4-3.3-5.4-6.9-5.4-10.9A5.4 5.4 0 0 1 12 3.4Z"/><circle cx="12" cy="8.8" r="1.9"/>',
    search: '<circle cx="10.9" cy="10.9" r="6.5"/><path d="M15.7 15.7 20.4 20.4"/>',
    edit: '<path d="M15.4 4.6l4 4L8.9 19.1l-4.7.7.7-4.7ZM13.4 6.6l4 4"/>',
    bell: '<path d="M6.6 9.9a5.4 5.4 0 0 1 10.8 0c0 4 1.4 5.4 1.4 5.4H5.2s1.4-1.4 1.4-5.4Z"/><path d="M10.2 18.6a2 2 0 0 0 3.6 0"/>',
    eye: '<path d="M2.6 12S6 6.2 12 6.2 21.4 12 21.4 12 18 17.8 12 17.8 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    arrowUp: '<path d="M12 19.4V5m0 0-6 6m6-6 6 6"/>',
    arrowDown: '<path d="M12 4.6V19m0 0 6-6m-6 6-6-6"/>',
    user: '<circle cx="12" cy="8" r="3.4"/><path d="M5.4 20c.7-3.6 3.3-5.6 6.6-5.6s5.9 2 6.6 5.6"/>',
    moon: '<path d="M20 14.2A8.3 8.3 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.3M12 18.9v2.3M2.8 12h2.3M18.9 12h2.3M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6"/>',
    cloud: '<path d="M7.4 18.4h9.4a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6-1.3 3.7 3.7 0 0 0-.2 8.5Z"/>',
    rain: '<path d="M7.4 15.6h9.4a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6-1.3 3.7 3.7 0 0 0-.2 8.5Z"/><path d="M8.6 18.2l-.8 2.2M12.6 18.2l-.8 2.2M16.6 18.2l-.8 2.2"/>',
    lock: '<rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2.6"/><path d="M8.2 10.2V7.8a3.8 3.8 0 0 1 7.6 0v2.4"/>',
    unlock: '<rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2.6"/><path d="M8.2 10.2V7.8a3.8 3.8 0 0 1 7.2-1.6"/>',
    download: '<path d="M12 4.4v10.8m0 0 4.2-4.2M12 15.2l-4.2-4.2M4.8 19.6h14.4"/>',
    upload: '<path d="M12 19.6V8.8m0 0L7.8 13M12 8.8l4.2 4.2M4.8 4.4h14.4"/>',
    info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.2M12 7.9v.1"/>',
    star: '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8Z"/>',
    copy: '<rect x="8.4" y="8.4" width="11.2" height="11.2" rx="2.6"/><path d="M15.6 5.6H6.6a2 2 0 0 0-2 2v8.2"/>',
    wifi: '<path d="M4.2 9.6a12.4 12.4 0 0 1 15.6 0M7 12.9a8.2 8.2 0 0 1 10 0M9.8 16.1a4 4 0 0 1 4.4 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
    battery: '<rect x="3" y="8.4" width="15.6" height="7.2" rx="2"/><path d="M20.4 11v2"/><rect x="4.6" y="10" width="9.6" height="4" rx="1" fill="currentColor" stroke="none" opacity=".85"/>',
    group: '<circle cx="9" cy="8.6" r="3.1"/><path d="M3.6 19.2c.6-3.2 2.9-5 5.4-5s4.8 1.8 5.4 5"/><path d="M15.4 6.2a3 3 0 0 1 0 5.9M17.2 14.6c1.9.4 3.2 2 3.6 4.6"/>',
    ai: '<rect x="4" y="6.4" width="16" height="12" rx="4"/><path d="M9 11.2v2.2M15 11.2v2.2M12 3.6v2.6M8.4 20.4h7.2"/>',
    wallet: '<rect x="3.4" y="6.6" width="17.2" height="12.8" rx="3"/><path d="M3.8 10.2h16.4M16.4 14.4h1.4"/>',
    music: '<path d="M9.2 17.4V6.6l8-1.8v10.4"/><circle cx="7" cy="18" r="2.3"/><circle cx="15.2" cy="16" r="2.3"/>',
    camera: '<path d="M4 8.6h2.6L8 6.2h8l1.4 2.4H20a1.8 1.8 0 0 1 1.8 1.8v8a1.8 1.8 0 0 1-1.8 1.8H4a1.8 1.8 0 0 1-1.8-1.8v-8A1.8 1.8 0 0 1 4 8.6Z"/><circle cx="12" cy="14.4" r="3.4"/>',
    power: '<path d="M12 3.6v8.2"/><path d="M6.4 7.4a7.6 7.6 0 1 0 11.2 0"/>',
    play: '<path d="M8 5.4v13.2L19.2 12Z" fill="currentColor" stroke="none"/>',
    bag: '<path d="M6 8.4h12l1 12.2H5Z"/><path d="M9 8.2V6.8a3 3 0 0 1 6 0v1.4"/>',
    hash: '<path d="M9.4 4.4 7.8 19.6M16.2 4.4l-1.6 15.2M4.6 9.2h15M4 15h15"/>',
    book: '<path d="M4.4 5.6c2.6-1 5.4-1 7.6.6 2.2-1.6 5-1.6 7.6-.6v12.8c-2.6-1-5.4-1-7.6.6-2.2-1.6-5-1.6-7.6-.6Z"/><path d="M12 6.2v12.8"/>',
    tv: '<rect x="3.2" y="6.4" width="17.6" height="11.8" rx="2.6"/><path d="M8.4 20.4h7.2M8.4 3.2l3.6 3.2 3.6-3.2"/>',
    xlogo: '<path d="M4.6 4.2l14.8 15.6M19.4 4.2 4.6 19.8"/>',
    flame: '<path d="M12 21c3.6 0 6-2.4 6-5.6 0-2.4-1.4-4-3-5.6-.8-.8-1.4-1.6-1.6-2.8-2.2 1.2-3.4 3-3.4 4.6 0 .8.2 1.4.6 2-1.4-.2-2.2-1.2-2.6-2.4-1.2 1.6-2 3.4-2 5.4C6 18.6 8.4 21 12 21Z"/>',
    share: '<path d="M12 15.6V4.4m0 0L7.6 8.8M12 4.4l4.4 4.4"/><path d="M5 12.8v5.6a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6v-5.6"/>',
    home: '<path d="M4.2 10.4 12 4.2l7.8 6.2v8.2a1.4 1.4 0 0 1-1.4 1.4H5.6a1.4 1.4 0 0 1-1.4-1.4Z"/><path d="M9.4 20v-5.4h5.2V20"/>',
    media: '<rect x="3.4" y="5" width="17.2" height="14" rx="3"/><path d="M10.6 9.4v5.2l4.4-2.6Z" fill="currentColor" stroke="none"/>',
    grid: '<rect x="4" y="4" width="6.6" height="6.6" rx="1.6"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.6"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.6"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.6"/>',
    globe: '<circle cx="12" cy="12" r="8.4"/><ellipse cx="12" cy="12" rx="3.6" ry="8.4"/><path d="M3.8 9.4h16.4M3.8 14.6h16.4"/>',
    map: '<path d="M9 4.4 4.2 6.2v13.4l4.8-1.8 6 1.8 4.8-1.8V4.4l-4.8 1.8Z"/><path d="M9 4.4v13.4M15 6.2v13.4"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="4.6"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none"/>',
    reddit: '<circle cx="12" cy="13" r="7.2"/><circle cx="9.2" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M9.4 15.2a3.6 3.6 0 0 0 5.2 0"/><path d="M12 5.8 13.4 3l3 1.2"/>',
    zhihu: '<path d="M4.4 5.2h9.4v8.4H8.6L5 16.8v-3.2H4.4Z"/><path d="M14.6 8.4h5v8a2 2 0 0 1-2 2h-.6l-2.4 2v-2h-.4Z"/>',
    quora: '<circle cx="12" cy="11.4" r="7.4"/><path d="M10.4 18.4 15 22"/>',
    youtube: '<rect x="3.2" y="6" width="17.6" height="12" rx="3.6"/><path d="M10.4 9.4v5.2l4.4-2.6Z" fill="currentColor" stroke="none"/>',
    discord: '<path d="M7.5 8.2c2.8-1.4 6.2-1.4 9 0l1.6 6.6a11 11 0 0 1-3.4 1.6l-.9-1.6a8 8 0 0 1-3.6 0l-.9 1.6a11 11 0 0 1-3.4-1.6Z"/><circle cx="9.6" cy="12.4" r=".9" fill="currentColor" stroke="none"/><circle cx="14.4" cy="12.4" r=".9" fill="currentColor" stroke="none"/>',
    mail: '<rect x="3.4" y="5.6" width="17.2" height="12.8" rx="2.4"/><path d="m4.4 7.2 7.6 5.4 7.6-5.4"/>',
    chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 4-5 3 3 5-7"/>',
    maximize: '<path d="M4 9V4h5"/><path d="M20 15v5h-5"/><path d="m4 4 6 6"/><path d="m20 20-6-6"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="4.2"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none"/>',

};

// 重新绘制的品牌图标：更接近真实 App 的辨识度
const ICON_REDESIGN = {
    reddit: '<circle cx="12" cy="13.2" r="6.8"/><path d="M12 6.4 13.2 3.4l2.8 1"/><circle cx="16.2" cy="4.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.3" cy="12.2" r="1.15" fill="currentColor" stroke="none"/><circle cx="14.7" cy="12.2" r="1.15" fill="currentColor" stroke="none"/><path d="M9.2 15.4c1.6 1.4 4 1.4 5.6 0"/><path d="M5.4 11.6c-.9-.2-1.5.5-1.2 1.3.2.7.8 1.1 1.5 1M18.6 11.6c.9-.2 1.5.5 1.2 1.3-.2.7-.8 1.1-1.5 1"/>',
    discord: '<path d="M7.2 8.1c2.9-1.3 6.7-1.3 9.6 0l1.6 6.8c-1.1.8-2.4 1.3-3.8 1.5l-.9-1.7a8.2 8.2 0 0 1-3.4 0l-.9 1.7c-1.4-.2-2.7-.7-3.8-1.5Z"/><circle cx="9.6" cy="12.2" r="1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="12.2" r="1" fill="currentColor" stroke="none"/><path d="M9.8 15.1c1.4.6 3 .6 4.4 0"/>',
    telegram: '<path d="M21.2 4.1 3.4 11.3l4.9 1.7 1.2 5.6 2.9-3.1 3.8 2.9Z" fill="currentColor" stroke="none"/><path d="m8.3 13 8.4-6.1-6.5 7.1" stroke="#fff" stroke-width="1.1" opacity=".65"/>',
    spotify: '<circle cx="12" cy="12" r="8.4"/><path d="M7.4 9.2c3.1-.9 6.6-.5 9.2 1M8.1 12.3c2.5-.7 5.2-.4 7.4.9M8.8 15.3c1.9-.5 3.9-.3 5.7.6"/>',
    zhihu: '<text x="12" y="17" text-anchor="middle" font-size="15" font-family="\'Noto Serif SC\',\'Songti SC\',serif" font-weight="700" fill="currentColor" stroke="none">知</text>',
    quora: '<circle cx="12" cy="11.2" r="7.3"/><path d="M10.3 17.9 15.4 23"/><path d="M9.9 8.6a2.4 2.4 0 0 1 4.4 1.5c0 1.6-1.7 2-1.7 3.1" stroke-width="1.5"/><circle cx="12.6" cy="16.2" r=".9" fill="currentColor" stroke="none"/>',
    weibo: '<path d="M2.8 12.4c2.2-4 6-6.2 9.8-5.8 2.4.3 3.8 1.8 2.9 3.8-.8 1.8-3 3.4-5.6 3.8-2.3.4-4.2-.2-4.7-1.4-.3-.8.1-1.8.8-2.7"/>,<circle cx="9.4" cy="12.6" r="1.2" fill="currentColor" stroke="none"/><path d="M16.8 5.4c2.2.4 3.8 2 4.2 4.2M16.2 8.4c1.1.2 1.9 1 2.1 2.1"/>',
    xhs: '<rect x="3.6" y="4.6" width="16.8" height="14.8" rx="4"/><path d="M7.6 16.2V9.4c0-.6.7-1 1.2-.6l2.1 1.8c.3.3.8.3 1.1 0l2.2-1.8c.5-.4 1.2 0 1.2.6v6.8"/><path d="M7 7.2h10"/>',
    bili: '<rect x="3.2" y="6.6" width="17.6" height="11.6" rx="3.2"/><path d="m7.8 6.4 2.6-2.6M16.2 6.4 13.6 3.8"/><path d="M10.2 10.2v4.4l4.2-2.2Z" fill="currentColor" stroke="none"/>',
    tiktok: '<path d="M14.2 4.2v9.6a3.1 3.1 0 1 1-2.4-3" stroke-width="2"/><path d="M14.2 4.2c.4 2.2 1.9 3.6 4 3.8" stroke-width="2"/>',
    gmail: '<rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.8"/><path d="m4 7 8 5.8L20 7"/><path d="M4 17.4V8l8 5.8L20 8v9.4" opacity=".55"/>',
    youtube: '<rect x="2.8" y="5.8" width="18.4" height="12.4" rx="3.8"/><path d="M10.2 9.2v5.6l4.8-2.8Z" fill="currentColor" stroke="none"/>',
    stocks: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m6.8 15.2 3.6-4.4 3 2.6 4.8-6"/><circle cx="6.8" cy="15.2" r=".9" fill="currentColor" stroke="none"/><circle cx="10.4" cy="10.8" r=".9" fill="currentColor" stroke="none"/><circle cx="13.4" cy="13.4" r=".9" fill="currentColor" stroke="none"/><circle cx="18.2" cy="7.4" r=".9" fill="currentColor" stroke="none"/>',
    browser: '<circle cx="12" cy="12" r="8.4"/><ellipse cx="12" cy="12" rx="3.5" ry="8.4"/><path d="M3.8 9.4h16.4M3.8 14.6h16.4"/><path d="M12 3.6c2.4 2.4 2.4 14.4 0 16.8" opacity=".5"/>',
    maps: '<path d="M9 4.4 4.2 6.2v13.4l4.8-1.8 6 1.8 4.8-1.8V4.4l-4.8 1.8Z"/><path d="M9 4.4v13.4M15 6.2v13.4"/><circle cx="12" cy="11.2" r="1.6" fill="currentColor" stroke="none"/>',
    xlogo: '<path d="M4.4 4.2h3.4l4.3 5.7 5-5.7h2.6l-6.4 7.3 6.6 8.3h-3.4l-4.5-6-5.3 6H3.9l6.8-7.7Z" fill="currentColor" stroke="none"/>',
    tieba: '<text x="12" y="16.8" text-anchor="middle" font-size="14" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-weight="700" fill="currentColor" stroke="none">贴</text>',
    facebook: '<path d="M14.6 21v-7.2h2.7l.4-3h-3.1V9c0-.9.3-1.5 1.6-1.5h1.6V4.8c-.3 0-1.3-.1-2.4-.1-2.4 0-3.9 1.4-3.9 4V10H8.9v3h2.6v7.2Z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="7" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.6" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none"/>',
    volume: '<path d="M4.4 9.6h3.2L12 6v12l-4.4-3.6H4.4Z"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6M18 7a7.4 7.4 0 0 1 0 10"/>',
    signal: '<path d="M20.5 11.6a7.9 7.9 0 0 1-8.6 7.9 9 9 0 0 1-3.3-.6L3.5 20.5l1.5-5.1A7.9 7.9 0 1 1 20.5 11.6Z"/><rect x="9.7" y="9.6" width="4.6" height="3.9" rx="1.1"/><path d="M10.9 9.6V8.4a1.1 1.1 0 0 1 2.2 0v1.2"/>',
    deepseek: '<path d="M3.5 13.4c3.1-4.4 8.4-5.6 12-3.1 2 1.4 2.5 3.7 1.1 5.2-1.3 1.4-3.8 1.5-5.4.3-1.2-.9-1.3-2.4-.3-3.2"/><path d="M14.4 5.9c1.6.3 2.9 1.3 3.6 2.7"/><circle cx="15.9" cy="9.6" r=".9" fill="currentColor" stroke="none"/><path d="M7.2 7.1c1.2-.7 2.4-1 3.6-.9"/>',
    chatgpt: '<path d="M12 3.1c2.5 0 4.5 2 4.5 4.5v.8l.9.5c2 1.2 2.7 3.7 1.5 5.7-1.2 2-3.7 2.7-5.7 1.5l-.9-.5-.9.5c-2 1.2-4.5.5-5.7-1.5-1.2-2-.5-4.5 1.5-5.7l.9-.5v-.8C8.1 5.1 10 3.1 12 3.1Z"/><path d="M9.5 6.4 12 7.8l2.5-1.4M9.5 17.6 12 16.2l2.5 1.4M4.8 11.9l2.2 1.2M19.2 11.9l-2.2 1.2M8.4 4.9l1.1 2.2M15.6 19.1l-1.1-2.2M8.4 19.1l1.1-2.2M15.6 4.9l-1.1 2.2"/>',
    claude: '<path d="M12 4.4v15.2M4.4 12h15.2M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4"/><path d="M12 8.1v7.8M8.1 12h7.8" opacity=".45"/>',
    gemini: '<path d="M12 2.8c.7 5.2 3.9 8.4 9.1 9.1-5.2.7-8.4 3.9-9.1 9.1-.7-5.2-3.9-8.4-9.1-9.1 5.2-.7 8.4-3.9 9.1-9.1Z" fill="currentColor" stroke="none"/>',
    pdd: '<text x="12" y="16.8" text-anchor="middle" font-size="13" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-weight="700" fill="currentColor" stroke="none">拼</text>', 
    taobao: '<text x="12" y="16.8" text-anchor="middle" font-size="13" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-weight="700" fill="currentColor" stroke="none">淘</text>',
    jd: '<text x="12" y="16.8" text-anchor="middle" font-size="13" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-weight="700" fill="currentColor" stroke="none">京</text>',
    amazon: '<text x="11" y="15.4" text-anchor="middle" font-size="13" font-family="Arial, sans-serif" font-weight="700" fill="currentColor" stroke="none">a</text><path d="M6.2 18.2c3.4 1.5 8 1.2 11.3-.8M15.4 16.5l2.4.6-.7 2.3"/>',
    calendar: '<rect x="3.8" y="5.2" width="16.4" height="15" rx="3"/><path d="M3.8 9.6h16.4M8.2 3.4v3.4M15.8 3.4v3.4"/><circle cx="8.4" cy="13.4" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="13.4" r="1" fill="currentColor" stroke="none"/><circle cx="8.4" cy="17" r="1" fill="currentColor" stroke="none"/>',
    live: '<circle cx="12" cy="12" r="2.4"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.4 9.4 0 0 0 0 13.2M18.6 5.4a9.4 9.4 0 0 1 0 13.2"/>',
    douban: '<text x="12" y="16.8" text-anchor="middle" font-size="13" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-weight="700" fill="currentColor" stroke="none">豆</text>',
    xianyu: '<text x="12" y="16.8" text-anchor="middle" font-size="13" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-weight="700" fill="currentColor" stroke="none">闲</text>',
    train: '<rect x="5.4" y="3.6" width="13.2" height="14.4" rx="3"/><path d="M5.4 10.4h13.2M8.4 21l2-3M15.6 21l-2-3"/><circle cx="8.8" cy="14.4" r="1" fill="currentColor" stroke="none"/><circle cx="15.2" cy="14.4" r="1" fill="currentColor" stroke="none"/>',
};
Object.assign(ICONS, ICON_REDESIGN);

const SPRITE_ID = 'mp-icon-sprite';

export function ensureSprite() {
    if (document.getElementById(SPRITE_ID)) return;
    const symbols = Object.entries(ICONS).map(([name, body]) =>
        '<symbol id="mp-i-' + name + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + body + '</symbol>'
    ).join('');
    const host = document.createElement('div');
    host.id = SPRITE_ID;
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + symbols + '</svg>';
    document.body.appendChild(host);
}

export function icon(name, cls = '', size) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mp-ic' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    if (size) { svg.style.width = size + 'px'; svg.style.height = size + 'px'; }
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#mp-i-' + name);
    svg.appendChild(use);
    return svg;
}

/* -------------------------------- 头像 -------------------------------- */

const GRADIENTS = [
    ['#f7b267', '#f4845f'], ['#7f9cf5', '#5a67d8'], ['#f6ad55', '#dd6b20'],
    ['#68d391', '#2f855a'], ['#f687b3', '#b83280'], ['#76e4f7', '#0987a0'],
    ['#b794f4', '#6b46c1'], ['#fbd38d', '#c05621'], ['#9ae6b4', '#276749'],
    ['#90cdf4', '#2b6cb0'],
];

export function hashOf(text) {
    let hash = 0;
    const str = String(text || '_');
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(hash);
}

export function gradientFor(name) {
    const [a, b] = GRADIENTS[hashOf(name) % GRADIENTS.length];
    return 'linear-gradient(145deg,' + a + ',' + b + ')';
}

export function avatar({ name = '', src = '', size = 44, cls = '', ring = false, link = true } = {}) {
    try {
        const custom = globalThis.__mpAvatarUrl?.(name);
        if (custom) src = custom;
    } catch { /* ignore */ }
    if (!src && name && !String(name).includes('、') && !String(name).includes('群') && globalThis.__mpRealPhotos !== false) {
        src = 'https://picsum.photos/seed/' + encodeURIComponent(String(name)) + '/150/150';
    }
    const el = h('span', { class: 'mp-avatar ' + cls, style: { width: size + 'px', height: size + 'px' } });
    if (ring) el.classList.add('is-ring');
    const ch = String(name || '?').trim().charAt(0).toUpperCase();
    if (src) {
        const img = h('img', { src, alt: '', loading: 'lazy', draggable: 'false' });
        img.addEventListener('error', () => { img.remove(); el.style.background = gradientFor(name); el.textContent = ch; });
        el.appendChild(img);
    } else {
        el.style.background = gradientFor(name);
        el.textContent = ch;
    }
    el.style.fontSize = Math.round(size * 0.38) + 'px';
    if (link && name && !String(name).includes('、') && globalThis.__mpOpenProfile) {
        el.classList.add('is-profile-link');
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.title = '查看 ' + name + ' 的属性';
        el.addEventListener('click', event => {
            // 头像是被包在按钮里的（比如「心动」顶部的人选条、Facebook 故事圈）时，
            // 这一次点击该归按钮自己——选人 / 翻故事，而不是跳去人物卡。
            const host = el.closest('button, a');
            if (host && host !== el) return;
            event.stopPropagation();
            globalThis.__mpOpenProfile(name);
        });
    }
    return el;
}

/* -------------------------------- 时间 -------------------------------- */

const pad = n => String(n).padStart(2, '0');

export function clockText(date = new Date()) {
    return pad(date.getHours()) + ':' + pad(date.getMinutes());
}

export function dayText(ts) {
    const d = new Date(ts);
    const now = new Date();
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(d, now)) return '今天';
    const y = new Date(now.getTime() - 86400000);
    if (same(d, y)) return '昨天';
    if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
}

export function timeText(ts) {
    const d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

export function relativeText(ts) {
    const diff = Date.now() - Number(ts || 0);
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 172800000) return '昨天';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    const d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

export function weekdayText(ts = Date.now()) {
    return '日一二三四五六'[new Date(ts).getDay()];
}

/* ------------------------------ 手机内弹层 ------------------------------ */

let layer = null;
export function toast(text, ms = 1900) {
    try {
        if (globalThis.__mpIslandToast) {
            globalThis.dispatchEvent(new CustomEvent('mp-island-toast', { detail: { text: String(text), ms } }));
            return;
        }
    } catch { /* ignore */ }
    if (!layer) return;
    const el = h('div', { class: 'mp-toast', text: String(text) });
    layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
        el.classList.remove('in');
        setTimeout(() => el.remove(), 260);
    }, ms);
}

/** 底部弹层：返回一个 Promise，点遮罩或关闭按钮 resolve。 */
export function sheet({ title = '', content = null, actions = null, height = 'auto' } = {}) {
    const host = layer || document.body;
    const panel = h('div', { class: 'mp-sheet-panel', style: { maxHeight: height } });
    const head = h('div', { class: 'mp-sheet-head' },
        h('div', { class: 'mp-sheet-title', text: title }),
        h('button', { class: 'mp-sheet-close', type: 'button', 'aria-label': '关闭', onclick: () => close() }, icon('close', '', 18)),
    );
    if (actions) head.appendChild(actions);
    panel.appendChild(head);
    if (content) panel.appendChild(content);

    const mask = h('div', { class: 'mp-sheet-mask' });
    const wrap = h('div', { class: 'mp-sheet' }, mask, panel);
    host.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));

    let resolveFn;
    const done = new Promise(resolve => { resolveFn = resolve; });
    function onKey(e) {
        if (e.key === 'Escape') close();
    }
    function close(value) {
        document.removeEventListener('keydown', onKey);
        wrap.classList.remove('in');
        setTimeout(() => wrap.remove(), 220);
        resolveFn(value);
    }
    mask.addEventListener('click', () => close());
    document.addEventListener('keydown', onKey);
    return { el: panel, close, done };
}

export function confirmSheet(text, { ok = '确定', cancel = '取消', danger = false } = {}) {
    return new Promise(resolve => {
        const body = h('div', { class: 'mp-confirm-body', text });
        const buttons = h('div', { class: 'mp-confirm-actions' },
            h('button', { class: 'mp-btn ghost', type: 'button', onclick: () => { s.close(); resolve(false); }, text: cancel }),
            h('button', { class: 'mp-btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => { s.close(); resolve(true); }, text: ok }),
        );
        const s = sheet({ title: '', content: frag(body, buttons) });
        s.done.then(() => resolve(false));
    });
}

export function setLayer(el) {
    layer = el;
}

export function haptic(ms = 8) {
    try {
        if (globalThis.matchMedia?.('(pointer: coarse)')?.matches) globalThis.navigator?.vibrate?.(ms);
    } catch { /* ignore */ }
}

/** 输入框防抖 */
export function debounce(fn, wait = 200) {
    let timer = 0;
    return function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

export function until(condition, timeout = 15000, step = 120) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        (function tick() {
            let ok = false;
            try { ok = condition(); } catch { ok = false; }
            if (ok) return resolve(true);
            if (Date.now() - start > timeout) return reject(new Error('等待超时'));
            setTimeout(tick, step);
        })();
    });
}