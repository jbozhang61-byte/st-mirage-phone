/**
 * 地图：地球 / 平面 / 地名搜索，选交通工具出门。
 * 不是导航，是让「去一个地方」这件事真的发生。
 */
import { h, icon, sheet, toast } from '../render.js';
import { getData, saveNow } from '../store.js';
import { PLACES, TRANSPORTS, haversine, etaText, nearestPlace, worldDots, BORDERS, COUNTRIES } from '../places.js';
import { setOneShot } from '../st.js';

export function mountMaps(host, { nav }) {
    let view = 'globe';
    let dest = null;
    let transport = 'train';
    let rot = 0;
    let drag = null;
    let query = '';

    const origin = nearestPlace(getData().meta?.city || '此间');

    const el = h('div', { class: 'mp-map' });
    const body = h('div', { class: 'mp-map__body' });
    const head = h('div', { class: 'mp-map__head' },
        h('div', { class: 'mp-map__brand', text: '地图' }),
        h('div', { class: 'mp-map__toggle' },
            toggleButton('globe', '地球'), toggleButton('flat', '平面'),
        ),
    );
    el.append(head, body);
    host.appendChild(el);

    function toggleButton(id, label) {
        return h('button', { type: 'button', class: 'mp-map__tab' + (view === id ? ' on' : ''), text: label, onclick: () => { view = id; render(); } });
    }

    function render() {
        [...head.querySelectorAll('.mp-map__tab')].forEach(button => {
            button.classList.toggle('on', button.textContent === (view === 'globe' ? '地球' : '平面'));
        });
        body.innerHTML = '';

        // 搜索
        const search = h('div', { class: 'mp-map__search' }, icon('search'),
            h('input', {
                type: 'text', placeholder: '输入地名，或者拖一拖地球', value: query,
                oninput: event => { query = event.target.value.trim(); renderSearch(); },
            }),
        );
        body.appendChild(search);
        const results = h('div', { class: 'mp-map__results' });
        body.appendChild(results);
        renderSearch();

        // 视图
        body.appendChild(view === 'globe' ? globeView() : flatView());

        // 出行
        body.appendChild(routeCard());
    }

    function renderSearch() {
        const results = body.querySelector('.mp-map__results');
        if (!results) return;
        results.innerHTML = '';
        if (!query) return;
        const list = PLACES.filter(place => place.name.includes(query) || place.region.includes(query)).slice(0, 5);
        for (const place of list) {
            results.appendChild(h('button', {
                type: 'button', class: 'mp-map__result',
                onclick: () => { dest = place; query = place.name; render(); },
            },
                icon('location'),
                h('span', { text: place.name }),
                h('span', { class: 'mp-map__result-region', text: place.region }),
            ));
        }
        if (!list.length) results.appendChild(h('div', { class: 'mp-map__noresult', text: '地图上还没有这个地方' }));
    }

    /* ------------------------------ 地球 ------------------------------ */

    function globeView() {
        const wrap = h('div', { class: 'mp-map__globe-wrap' });
        const globe = h('div', { class: 'mp-map__globe' });
        const canvas = document.createElement('canvas');
        canvas.width = 560; canvas.height = 560;
        canvas.className = 'mp-map__canvas';
        globe.appendChild(canvas);
        const markers = h('div', { class: 'mp-map__markers' });
        globe.appendChild(markers);
        const dots = worldDots(2.5);
        const ctx2d = canvas.getContext('2d');

        const apply = () => {
            ctx2d.clearRect(0, 0, 560, 560);
            const cx = 280, cy = 280, R = 244;
            const oceangrad = ctx2d.createRadialGradient(cx - 80, cy - 90, 20, cx, cy, R);
            oceangrad.addColorStop(0, '#5d94ad');
            oceangrad.addColorStop(.45, '#2b5570');
            oceangrad.addColorStop(.8, '#142c40');
            oceangrad.addColorStop(1, '#081420');
            ctx2d.beginPath();
            ctx2d.arc(cx, cy, R, 0, Math.PI * 2);
            ctx2d.fillStyle = oceangrad;
            ctx2d.fill();
            ctx2d.save();
            ctx2d.beginPath();
            ctx2d.arc(cx, cy, R, 0, Math.PI * 2);
            ctx2d.clip();
            // 经纬网
            ctx2d.strokeStyle = 'rgba(180,230,255,.10)';
            ctx2d.lineWidth = 1;
            for (let lon = -90; lon <= 90; lon += 15) {
                const rx = Math.abs(Math.cos((lon * Math.PI) / 180)) * R;
                ctx2d.beginPath();
                ctx2d.ellipse(cx, cy, rx, R, 0, 0, Math.PI * 2);
                ctx2d.stroke();
            }
            for (let lat = -75; lat <= 75; lat += 15) {
                const y = cy - Math.sin((lat * Math.PI) / 180) * R;
                const rx = Math.cos((lat * Math.PI) / 180) * R;
                ctx2d.beginPath();
                ctx2d.moveTo(cx - rx, y);
                ctx2d.lineTo(cx + rx, y);
                ctx2d.stroke();
            }
            // 大陆点阵
            for (const dot of dots) {
                const lon = ((dot.lon + rot) * Math.PI) / 180;
                const lat = (dot.lat * Math.PI) / 180;
                const z = Math.cos(lat) * Math.cos(lon);
                if (z <= 0.02) continue;
                const x = cx + Math.cos(lat) * Math.sin(lon) * R;
                const y = cy - Math.sin(lat) * R;
                ctx2d.fillStyle = 'rgba(150,220,190,' + (0.22 + z * 0.66).toFixed(2) + ')';
                ctx2d.fillRect(x - 1.15, y - 1.15, 2.3, 2.3);
            }
            drawRoute(ctx2d);
            // 夜面
            const night = ctx2d.createLinearGradient(cx + 40, cy, cx + R, cy);
            night.addColorStop(0, 'rgba(2,8,14,0)');
            night.addColorStop(1, 'rgba(2,8,14,.42)');
            ctx2d.fillStyle = night;
            ctx2d.fillRect(cx - R, cy - R, R * 2, R * 2);
            ctx2d.restore();
            // 边缘光
            ctx2d.beginPath();
            ctx2d.arc(cx, cy, R, 0, Math.PI * 2);
            ctx2d.strokeStyle = 'rgba(180,230,255,.32)';
            ctx2d.lineWidth = 3;
            ctx2d.stroke();

            markers.innerHTML = '';
            for (const place of PLACES) {
                const point = project(place, rot);
                if (!point.visible) continue;
                markers.appendChild(h('span', {
                    class: 'mp-map__dot' + (dest?.name === place.name ? ' on' : '') + (place.name === origin.name ? ' home' : ''),
                    style: { left: (point.x / 280 * 100) + '%', top: (point.y / 280 * 100) + '%' },
                    title: place.name,
                    onclick: () => { dest = place; render(); },
                }));
                if (['东京', '伦敦', '纽约', '巴黎', '北京', '上海', '悉尼', '开罗', '里约', '莫斯科', '新加坡', '迪拜'].includes(place.name)) {
                    markers.appendChild(h('span', {
                        class: 'mp-map__citylabel',
                        style: { left: (point.x / 280 * 100) + '%', top: (point.y / 280 * 100 + 1.6) + '%' },
                        text: place.name,
                    }));
                }
            }
        };

        const drawRoute = (ctx2d2) => {
            if (!dest) return;
            const a = projectCanvas(origin, rot);
            const b = projectCanvas(dest, rot);
            if (!a || !b) return;
            ctx2d2.save();
            ctx2d2.strokeStyle = 'rgba(255,160,120,.9)';
            ctx2d2.lineWidth = 2.4;
            ctx2d2.setLineDash([7, 6]);
            ctx2d2.beginPath();
            ctx2d2.moveTo(a.x, a.y);
            const cx = (a.x + b.x) / 2;
            const cy = Math.min(a.y, b.y) - 50;
            ctx2d2.quadraticCurveTo(cx, cy, b.x, b.y);
            ctx2d2.stroke();
            ctx2d2.restore();
        };

        const projectCanvas = (place, rotation) => {
            const lon = ((place.lng + rotation) * Math.PI) / 180;
            const lat = (place.lat * Math.PI) / 180;
            const z = Math.cos(lat) * Math.cos(lon);
            if (z <= 0.02) return null;
            return { x: 280 + Math.cos(lat) * Math.sin(lon) * 244, y: 280 - Math.sin(lat) * 244, z };
        };

        const onMove = event => {
            if (!drag) return;
            rot = drag.base + (event.clientX - drag.x) * 0.55;
            apply();
        };
        const onUp = () => {
            drag = null;
            globe.classList.remove('dragging');
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        const onDown = event => {
            drag = { x: event.clientX, base: rot };
            globe.setPointerCapture?.(event.pointerId);
            globe.classList.add('dragging');
            window.addEventListener('pointermove', onMove, { passive: true });
            window.addEventListener('pointerup', onUp, { passive: true });
        };
        globe.addEventListener('pointerdown', onDown);
        queueMicrotask(apply);
        wrap.appendChild(globe);
        wrap.appendChild(h('div', { class: 'mp-map__hint', text: '左右拖动地球 · 点一个点看路线' }));
        return wrap;
    }

    function project(place, rotation) {
        const lon = ((place.lng + rotation) * Math.PI) / 180;
        const lat = (place.lat * Math.PI) / 180;
        const visible = Math.cos(lon) > 0.05;
        const x = 150 + Math.sin(lon) * 122 * Math.cos(lat);
        const y = 150 - Math.sin(lat) * 122;
        return { x, y, visible };
    }

    /* ------------------------------ 平面 ------------------------------ */

    function flatView() {
        const wrap = h('div', { class: 'mp-map__flat-wrap' });
        const flat = h('div', { class: 'mp-map__flat' });
        const markers = h('div', { class: 'mp-map__markers' });
        for (const place of PLACES) {
            const x = ((place.lng + 180) / 360) * 100;
            const y = ((90 - place.lat) / 180) * 100;
            markers.appendChild(h('span', {
                class: 'mp-map__dot' + (dest?.name === place.name ? ' on' : '') + (place.name === origin.name ? ' home' : ''),
                style: { left: x + '%', top: y + '%' },
                title: place.name,
                onclick: () => { dest = place; render(); },
            }));
        }
        const dots = worldDots(3);
        const svgDots = dots.map(dot => {
            const x = ((dot.lon + 180) / 360) * 360;
            const y = ((90 - dot.lat) / 180) * 180;
            return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="1.1" fill="rgba(150,220,190,.6)"/>';
        }).join('');
        const borders = BORDERS.map(line => line.map((point, index) => (index ? 'L' : 'M') + (((point[0] + 180) / 360) * 360).toFixed(1) + ' ' + (((90 - point[1]) / 180) * 180).toFixed(1)).join(' ')).map(path => '<path d="' + path + '" fill="none" stroke="rgba(180,230,255,.22)" stroke-width=".6" stroke-dasharray="2 2"/>').join('');
        const labels = COUNTRIES.map(country => '<text x="' + (((country.lon + 180) / 360) * 360).toFixed(1) + '" y="' + (((90 - country.lat) / 180) * 180).toFixed(1) + '" font-size="7" fill="rgba(210,240,255,.5)" text-anchor="middle">' + country.name + '</text>').join('');
        flat.insertAdjacentHTML('beforeend', '<svg class="mp-map__flatsvg" viewBox="0 0 360 180" preserveAspectRatio="none">' + svgDots + borders + labels + '</svg>');
        flat.appendChild(markers);
        wrap.appendChild(flat);
        wrap.appendChild(h('div', { class: 'mp-map__hint', text: '一张不太准确、但够用的世界地图' }));
        return wrap;
    }

    /* ------------------------------ 路线 ------------------------------ */

    function routeCard() {
        const target = dest || null;
        const km = target ? haversine(origin, target) : 0;
        const vehicle = TRANSPORTS.find(item => item.id === transport) || TRANSPORTS[2];
        const eta = target ? etaText(km, vehicle) : '—';
        const data = getData();
        const visited = data.maps?.visited || [];

        const card = h('div', { class: 'mp-map__route' },
            h('div', { class: 'mp-map__route-row' },
                h('div', { class: 'mp-map__from' }, h('span', { class: 'mp-map__pin' }), h('span', { text: origin.name })),
                icon('chevron'),
                h('div', { class: 'mp-map__to' }, icon('location'), h('span', { text: target ? target.name : '选一个地方' })),
            ),
            h('div', { class: 'mp-map__vehicles' }, TRANSPORTS.map(item => h('button', {
                type: 'button', class: 'mp-map__vehicle' + (transport === item.id ? ' on' : ''),
                text: item.name,
                onclick: () => { transport = item.id; render(); },
            }))),
            target ? h('div', { class: 'mp-map__stats' },
                h('span', { text: '直线 ' + Math.round(km) + ' km' }),
                h('span', { text: eta }),
                h('span', { text: vehicle.cost ? '约 ¥' + Math.round(vehicle.cost * Math.max(1, km / 800)) : '免费' }),
            ) : h('div', { class: 'mp-map__stats', text: '在地图上点一个地方，或者搜一个地名' }),
            h('div', { class: 'mp-map__actions' },
                h('button', { type: 'button', class: 'mp-map__random', onclick: () => { dest = PLACES[Math.floor(Math.random() * PLACES.length)]; query = dest.name; render(); } }, icon('dice'), '随便走走'),
                h('button', { type: 'button', class: 'mp-map__go', disabled: !target, onclick: () => travel(target, vehicle) }, icon('send'), '出发'),
            ),
            visited.length ? h('div', { class: 'mp-map__stamps' },
                h('span', { class: 'mp-map__stamps-label', text: '去过' }),
                ...visited.slice(-6).map(name => h('span', { class: 'mp-map__stamp', text: name })),
            ) : null,
        );
        return card;
    }

    function travel(target, vehicle) {
        const action = '我坐' + vehicle.name + '去了' + target.name + '。';
        const detail = vehicle.id === 'plane'
            ? '飞机落地的时候，天已经黑了。手机信号重新连上，第一个弹出来的是你的消息。'
            : vehicle.id === 'ship'
                ? '船开得很慢，海面像一块没有边的铁。风把头发吹乱，我靠在栏杆上，想起你说过想来看海。'
                : vehicle.id === 'train'
                    ? '车窗外的东西一段一段往后退。车厢很安静，我在玻璃上看见自己的影子。'
                    : '路不远，但我走了很久。到的时候，鞋底沾了一点泥。';

        const data = getData();
        data.maps = data.maps || { visited: [], last: '' };
        data.maps.visited = [...new Set([...(data.maps.visited || []), target.name])].slice(-20);
        data.maps.last = target.name;
        data.meta.city = target.name;
        data.meta.cityManual = true;
        saveNow('data');

        const s = sheet({
            title: '抵达 · ' + target.name,
            content: h('div', { class: 'mp-map__scene' },
                h('div', { class: 'mp-map__scene-lead', text: action }),
                h('div', { text: detail }),
            ),
            actions: h('button', {
                class: 'mp-btn primary small', type: 'button', text: '带进正文',
                onclick: () => {
                    setOneShot('【我去了' + target.name + '】\n' + action + detail);
                    toast('已放进下一次正文');
                    s.close();
                },
            }),
        });
        render();
    }

    render();
    return { refresh: render };
}