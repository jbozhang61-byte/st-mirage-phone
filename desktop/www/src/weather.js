/**
 * 天气：不联网，按日期 + 城市稳定生成，并优先呼应最近的剧情。
 * 同一天反复打开看到的是同一份天气。
 */

const CONDITIONS = {
    clear: { name: '晴', night: '晴夜', icon: 'sun', nightIcon: 'moon' },
    cloud: { name: '多云', night: '多云', icon: 'cloud', nightIcon: 'cloud' },
    rain: { name: '小雨', night: '夜雨', icon: 'rain', nightIcon: 'rain' },
    snow: { name: '小雪', night: '夜雪', icon: 'cloud', nightIcon: 'cloud' },
    storm: { name: '雷雨', night: '雷雨', icon: 'rain', nightIcon: 'rain' },
};

function hash(text) {
    let value = 2166136261;
    const str = String(text || '');
    for (let i = 0; i < str.length; i++) {
        value ^= str.charCodeAt(i);
        value = Math.imul(value, 16777619);
    }
    return value >>> 0;
}

function rng(seed) {
    let a = seed >>> 0;
    return function next() {
        a += 0x6D2B79F5;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function dayKey(date) {
    const d = new Date(date);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function seasonBase(month) {
    // 北半球：一月最冷，七月最热
    return 14 - 13 * Math.cos(((month - 1) / 12) * Math.PI * 2);
}

export function detectFromStory(text) {
    const s = String(text || '');
    if (!s) return '';
    if (/雷|暴雨|大雨|台风/.test(s)) return 'storm';
    if (/雪|霜|冰/.test(s)) return 'snow';
    if (/雨|淋湿|撑伞|雨伞/.test(s)) return 'rain';
    if (/晴|阳光|烈日|晒|太阳/.test(s)) return 'clear';
    if (/阴|云|雾|霾/.test(s)) return 'cloud';
    return '';
}

function pickCondition(rand, month, hinted) {
    if (hinted) return hinted;
    const r = rand();
    if (month <= 1 || month >= 12) return r < 0.34 ? 'cloud' : r < 0.55 ? 'snow' : r < 0.86 ? 'clear' : 'rain';
    if (month >= 6 && month <= 8) return r < 0.5 ? 'clear' : r < 0.74 ? 'cloud' : r < 0.92 ? 'rain' : 'storm';
    if (month >= 3 && month <= 5) return r < 0.42 ? 'cloud' : r < 0.68 ? 'clear' : r < 0.94 ? 'rain' : 'storm';
    return r < 0.4 ? 'clear' : r < 0.66 ? 'cloud' : r < 0.92 ? 'rain' : 'storm';
}

export function buildWeather({ city = '此间', date = new Date(), storyText = '' } = {}) {
    const now = new Date(date);
    const seed = hash(city + '|' + dayKey(now));
    const rand = rng(seed);
    const month = now.getMonth() + 1;
    const base = seasonBase(month);
    const hinted = detectFromStory(storyText);
    const kind = pickCondition(rand, month, hinted);
    const cond = CONDITIONS[kind];
    const high = Math.round(base + 5 + rand() * 3);
    const low = Math.round(base - 6 - rand() * 2);
    const hour = now.getHours();
    const isNight = hour >= 19 || hour < 6;
    const phase = (hour - 14) / 24 * Math.PI * 2;
    const temp = Math.round((high + low) / 2 + Math.cos(phase) * (high - low) / 2);

    const hours = [];
    for (let i = 0; i < 12; i++) {
        const h = (hour + i) % 24;
        const p = (h - 14) / 24 * Math.PI * 2;
        const t = Math.round((high + low) / 2 + Math.cos(p) * (high - low) / 2 + (rng(seed + i * 17)() - 0.5) * 1.6);
        const night = h >= 19 || h < 6;
        hours.push({ hour: h, temp: t, icon: night ? cond.nightIcon : cond.icon, night });
    }

    const days = [];
    const names = ['今天', '明天', '后天', '大后天', '第五天'];
    for (let i = 0; i < 5; i++) {
        const d = new Date(now.getTime() + i * 86400000);
        const r = rng(hash(city + '|' + dayKey(d)));
        const k = i === 0 ? kind : pickCondition(r, d.getMonth() + 1, '');
        const b = seasonBase(d.getMonth() + 1);
        const hi = Math.round(b + 5 + r() * 3);
        const lo = Math.round(b - 6 - r() * 2);
        days.push({
            name: i === 0 ? '今天' : i === 1 ? '明天' : i === 2 ? '后天' : (d.getMonth() + 1) + '/' + d.getDate(),
            kind: k,
            icon: CONDITIONS[k].icon,
            high: hi,
            low: lo,
        });
    }

    const sunrise = 6.5 - Math.cos(((month - 1) / 12) * Math.PI * 2) * 1.4;
    const sunset = 18.2 + Math.cos(((month - 1) / 12) * Math.PI * 2) * 1.6;
    const fmt = value => {
        const hh = Math.floor(value);
        const mm = Math.round((value - hh) * 60);
        return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    };

    return {
        city,
        temp,
        high,
        low,
        kind,
        name: isNight ? cond.night : cond.name,
        icon: isNight ? cond.nightIcon : cond.icon,
        night: isNight,
        hinted: !!hinted,
        hours,
        days,
        sunrise: fmt(sunrise),
        sunset: fmt(sunset),
        wind: ['无风', '微风', '轻风', '和风', '风起'][Math.floor(rand() * 5)],
        humidity: 42 + Math.round(rand() * 40),
        air: ['优', '良', '良', '轻度污染'][Math.floor(rand() * 4)],
        summary: summarize(kind, temp),
    };
}

function summarize(kind, temp) {
    if (kind === 'storm') return '雷声从远处滚过来，雨点砸在窗上。';
    if (kind === 'rain') return '细雨落在玻璃上，把灯光晕开了。';
    if (kind === 'snow') return '雪落得很轻，路上没有人。';
    if (kind === 'cloud') return '云压得有些低，天色是灰蓝的。';
    return temp > 26 ? '阳光很好，影子被拉得很短。' : '天色清亮，适合出门走一走。';
}

/** 主屏上用的一行小字。 */
export function weatherLine(weather) {
    return weather.temp + '° ' + weather.name + ' · ' + weather.wind;
}
