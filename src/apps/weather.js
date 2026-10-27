/**
 * 天气：不联网，跟着日期和最近的剧情走。
 */
import { h, icon, sheet } from '../render.js';
import { getData, saveNow } from '../store.js';
import { storyContext } from '../st.js';
import { buildWeather } from '../weather.js';

export function mountWeather(host, { nav }) {
    const el = h('div', { class: 'mp-weather' });
    const sky = h('div', { class: 'mp-weather__sky' });
    const body = h('div', { class: 'mp-weather__body' });
    el.append(sky, h('div', { class: 'mp-nav' },
        h('button', { class: 'mp-nav__btn', type: 'button', 'aria-label': '返回', onclick: () => nav.home() }, icon('back')),
        h('div', { class: 'mp-nav__title' }, '天气', h('small', { text: 'WEATHER' })),
        h('div', { class: 'mp-nav__spacer' }),
    ), body);
    host.appendChild(el);

    function render() {
        const data = getData();
        const story = storyContext(3, 300).map(s => s.text).join(' ');
        const weather = buildWeather({ city: data.meta.city || '此间', storyText: story });
        el.dataset.w = weather.kind;
        body.innerHTML = '';

        body.appendChild(h('div', { class: 'mp-weather__city', text: weather.city + ' · 今天', onclick: () => renameCity(weather.city) }));
        body.appendChild(h('div', { class: 'mp-weather__temp' }, String(weather.temp), h('sup', { text: '°' })));
        body.appendChild(h('div', { class: 'mp-weather__cond', text: weather.name + '　' + weather.wind + '　湿度 ' + weather.humidity + '%' }));
        body.appendChild(h('div', { class: 'mp-weather__range', text: '最高 ' + weather.high + '°　最低 ' + weather.low + '°　空气 ' + weather.air }));
        body.appendChild(h('div', { class: 'mp-weather__summary', text: weather.summary }));
        body.appendChild(h('button', { type: 'button', class: 'mp-weather__aqi', onclick: () => airDetail(weather) },
            icon('wind'),
            h('span', { text: '空气质量 ' + weather.air }),
            icon('chevron'),
        ));

        // 逐小时
        const hours = h('div', { class: 'mp-hours' });
        for (const hour of weather.hours) {
            hours.appendChild(h('div', { class: 'mp-hour' },
                h('span', { text: String(hour.hour).padStart(2, '0') + ':00' }),
                icon(hour.icon),
                h('b', { text: hour.temp + '°' }),
            ));
        }
        body.appendChild(h('div', { class: 'mp-weather__card' },
            h('div', { class: 'mp-weather__label', text: '未来 12 小时' }),
            hours,
        ));

        // 五天
        const days = h('div', { class: 'mp-days' });
        const span = Math.max(1, ...weather.days.map(d => d.high - d.low));
        for (const day of weather.days) {
            const width = Math.round(((day.high - day.low) / span) * 100);
            days.appendChild(h('div', { class: 'mp-day' },
                h('span', { class: 'mp-day__name', text: day.name }),
                h('span', { class: 'mp-day__icon' }, icon(day.icon)),
                h('span', { class: 'mp-day__bar' }, h('i', { style: { width: Math.max(18, width) + '%' } })),
                h('span', { class: 'mp-day__temp', text: day.low + '° / ' + day.high + '°' }),
            ));
        }
        body.appendChild(h('div', { class: 'mp-weather__card' },
            h('div', { class: 'mp-weather__label', text: '接下来几天' }),
            days,
        ));

        body.appendChild(h('div', { class: 'mp-weather__foot' },
            h('div', { text: '日出 ' + weather.sunrise + ' · 日落 ' + weather.sunset }),
            h('div', { text: weather.hinted ? '今天的天气跟着最近的剧情走' : '同一天打开，天气不会变' }),
        ));
    }

    function airDetail(weather) {
        const seed = (weather.city + new Date().toDateString()).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const pm25 = 12 + (seed % 46);
        const pm10 = 22 + (seed % 60);
        const o3 = 40 + (seed % 70);
        sheet({
            title: '空气质量 · ' + weather.city,
            content: h('div', { class: 'mp-air' },
                h('div', { class: 'mp-air__main' }, h('b', { text: weather.air }), h('span', { text: 'AQI ' + (30 + seed % 90) })),
                h('div', { class: 'mp-air__row' }, h('span', { text: 'PM2.5' }), h('b', { text: pm25 + ' μg/m³' })),
                h('div', { class: 'mp-air__row' }, h('span', { text: 'PM10' }), h('b', { text: pm10 + ' μg/m³' })),
                h('div', { class: 'mp-air__row' }, h('span', { text: '臭氧' }), h('b', { text: o3 + ' μg/m³' })),
                h('div', { class: 'mp-air__hint', text: '数值跟着城市和日期稳定生成，不会每次刷新都变。' }),
            ),
        });
    }

    function renameCity(current) {
        const input = h('input', { class: 'mp-input', type: 'text', value: current, placeholder: '城市或者地点的名字' });
        const s = sheet({
            title: '这是哪里',
            content: h('div', { class: 'mp-field-list' }, input, h('div', { class: 'mp-st-hint', text: '只影响这一部手机上的天气。' })),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '好',
                onclick: () => {
                    const value = input.value.trim() || '此间';
                    const data = getData();
                    data.meta.city = value;
                    data.meta.cityManual = true;
                    saveNow('data');
                    s.close();
                    render();
                },
            }),
        });
        setTimeout(() => input.select(), 200);
    }

    render();
    return { refresh: render };
}