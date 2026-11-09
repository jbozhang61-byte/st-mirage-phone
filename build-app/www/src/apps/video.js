/** 视频播放页：整页打开，带播放进度、弹幕和评论区。 */
import { h, icon, toast } from '../render.js';
import { artFor } from '../art.js';
import { cachedImage, generateImage, imageConfig } from '../imagegen.js';
import { moodOf } from './feed-common.js';
import { setOneShot } from '../st.js';
import { createComments } from './comments.js';

export function openVideo(item, options = {}) {
    const app = options.app || '视频';
    const key = String(item.id || item.title || item.text || '').slice(0, 80);
    const cover = cachedImage(key) || artFor(key + (item.title || ''), moodOf(item));
    const duration = item.duration || '03:20';
    const totalSeconds = parseDuration(duration);
    let played = 0;
    let timer = 0;
    const screen = document.querySelector('.mp-screen');
    if (!screen) return;
    const chip = screen.querySelector('.mp-backchip');
    if (chip) chip.style.display = 'none';
    const close = () => {
        clearInterval(timer);
        page.classList.add('is-closing');
        setTimeout(() => { page.remove(); if (chip) chip.style.display = ''; }, 220);
    };

    const bar = h('i', { style: { width: '0%' } });
    const timeLabel = h('span', { class: 'mp-vid__time', text: '00:00 / ' + duration });
    const stage = h('div', { class: 'mp-vid__stage', style: { backgroundImage: cover } }, h('span', { class: 'mp-vid__badge', text: app }));
    let coverSeed = 0;
    function offlineCover() {
        coverSeed += 1;
        stage.style.backgroundImage = artFor(key + (item.title || '') + '#offline' + coverSeed, moodOf(item));
    }
    async function aiCover() {
        if (!imageConfig().enabled) { toast('先在设置里启用 AI 配图并填接口'); return; }
        toast('正在生成封面…');
        try {
            const url = await generateImage((item.title || item.text || '') + '，电影感画面，不要文字');
            stage.style.backgroundImage = 'url("' + url + '")';
            toast('封面已生成');
        } catch (error) { toast(String(error?.message || '生成失败'), 3200); }
    }
    const play = h('button', { type: 'button', class: 'mp-vid__play', 'aria-label': '播放' }, icon('play', '', 26));
    stage.appendChild(play);
    if (String(app).includes('哔哩')) {
        const lines = ['前方高能', '这个镜头绝了', '泪目', '来了来了', '这里bgm是什么', '第一次看到这个角度', '收藏了'];
        for (let i = 0; i < 8; i++) {
            stage.appendChild(h('span', { class: 'mp-vid__dan', text: lines[i % lines.length], style: { top: (10 + i * 9) + '%', animationDelay: (i * 0.7) + 's' } }));
        }
    }
    const comments = createComments(item, app);
    const input = h('input', { class: 'mp-cm__input', type: 'text', placeholder: '写评论…' });
    const page = h('div', { class: 'mp-vid-page' },
        h('div', { class: 'mp-vid-page__bar' },
            h('button', { type: 'button', class: 'mp-vid-page__back', onclick: close }, icon('back')),
            h('div', { class: 'mp-vid-page__title', text: item.title || '视频' }),
        ),
        h('div', { class: 'mp-vid-page__scroll' },
            stage,
            h('div', { class: 'mp-vid__meta' }, h('div', { class: 'mp-vid__title', text: item.title || item.text || '无标题' }), h('div', { class: 'mp-vid__sub', text: (item.author ? '@' + item.author + ' · ' : '') + (item.views ? item.views + ' 次播放' : app) })),
            h('div', { class: 'mp-vid__controls' }, h('button', { type: 'button', class: 'mp-vid__play small', onclick: start }, icon('play', '', 16)), h('div', { class: 'mp-vid__progress' }, bar), timeLabel),
            h('div', { class: 'mp-vid__acts' },
                h('button', { type: 'button', class: 'mp-vid__act', onclick: () => toast('已点赞') }, icon('heart'), '点赞'),
                h('button', { type: 'button', class: 'mp-vid__act', onclick: () => comments.refresh() }, icon('refresh'), '换评论'),
                h('button', { type: 'button', class: 'mp-vid__act', onclick: offlineCover }, icon('image'), '换一张'),
                h('button', { type: 'button', class: 'mp-vid__act', onclick: aiCover }, icon('sparkle'), 'AI 封面'),
                h('button', { type: 'button', class: 'mp-vid__act', onclick: () => { setOneShot('【我在' + app + '上看到一个视频】\n' + (item.title || item.text || '')); toast('已带进正文'); } }, icon('send'), '带进正文'),
            ),
            comments.el,
        ),
        h('div', { class: 'mp-soc-page__composer' }, input, h('button', {
            type: 'button', class: 'mp-cm__send',
            onclick: () => { const text = input.value.trim(); if (!text) return; comments.add(text); input.value = ''; toast('已评论'); },
        }, '发送')),
    );
    screen.appendChild(page);

    const tick = () => {
        if (!document.contains(page)) { clearInterval(timer); return; }
        played += 1;
        const pct = Math.min(100, (played / Math.max(1, totalSeconds)) * 100);
        bar.style.width = pct + '%';
        timeLabel.textContent = clock(played) + ' / ' + duration;
        if (pct >= 100) clearInterval(timer);
    };
    function start(event) {
        event?.stopPropagation?.();
        clearInterval(timer);
        if (played >= totalSeconds) played = 0;
        timer = setInterval(tick, 1000);
    }
    play.addEventListener('click', start);
    stage.addEventListener('click', start);
    return { close };
}

function parseDuration(text) {
    const parts = String(text || '3:20').split(':').map(Number);
    if (parts.length === 2) return Math.max(1, parts[0] * 60 + parts[1]);
    return 200;
}

function clock(seconds) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return mm + ':' + ss;
}