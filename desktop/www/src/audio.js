/**
 * 手机里的程序化音乐：不加载外部音频，用 WebAudio 现场合成一段循环。
 * 每首歌按标题生成固定的调性、速度与和弦，听起来像同一首曲子。
 */

function hash(text) {
    let h = 2166136261;
    const str = String(text || 'mirage');
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function parseDuration(text) {
    const match = String(text || '').match(/(\d+):(\d+)/);
    if (!match) return 204;
    return Number(match[1]) * 60 + Number(match[2]);
}

export function createMusicPlayer({ onTick } = {}) {
    let ac = null;
    let master = null;
    let timer = 0;
    let tickTimer = 0;
    let step = 0;
    let nextTime = 0;
    let startedAt = 0;
    let elapsed = 0;
    let playing = false;
    let track = null;
    let seed = 1;
    let bpm = 88;
    let root = 48;
    let duration = 204;

    function ensure() {
        if (!ac) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return false;
            ac = new Ctx();
            master = ac.createGain();
            master.gain.value = 0.72;
            const comp = ac.createDynamicsCompressor();
            comp.threshold.value = -18;
            comp.ratio.value = 3;
            master.connect(comp).connect(ac.destination);
        }
        if (ac.state === 'suspended') ac.resume();
        return true;
    }

    function trackParams(next) {
        const h = hash(next?.title || next?.artist || 'mirage');
        seed = h;
        bpm = 72 + (h % 46);
        root = 45 + (h % 10);
        duration = parseDuration(next?.time);
        const prog = [
            [0, 3, 7],
            [8, 12, 15],
            [5, 8, 12],
            [7, 10, 14],
        ];
        return prog[(Math.floor(h / 7) % 4)];
    }

    let progression = [[0, 3, 7]];

    function tone(freq, when, dur, gain, type = 'sine', cutoff = 0) {
        if (!ac) return;
        const osc = ac.createOscillator();
        const env = ac.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0.0001, when);
        env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        let node = osc;
        if (cutoff) {
            const filter = ac.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = cutoff;
            node.connect(filter);
            node = filter;
        }
        node.connect(env).connect(master);
        osc.start(when);
        osc.stop(when + dur + 0.05);
    }

    function kick(when, gain = 0.11) {
        if (!ac) return;
        const osc = ac.createOscillator();
        const env = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, when);
        osc.frequency.exponentialRampToValueAtTime(44, when + 0.16);
        env.gain.setValueAtTime(gain, when);
        env.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
        osc.connect(env).connect(master);
        osc.start(when);
        osc.stop(when + 0.26);
    }

    function hat(when) {
        if (!ac) return;
        const length = Math.floor(ac.sampleRate * 0.04);
        const buffer = ac.createBuffer(1, length, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        const src = ac.createBufferSource();
        src.buffer = buffer;
        const filter = ac.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 6000;
        const env = ac.createGain();
        env.gain.value = 0.018;
        src.connect(filter).connect(env).connect(master);
        src.start(when);
    }

    function schedule() {
        if (!ac || !playing) return;
        const stepDur = 60 / bpm / 2;
        while (nextTime < ac.currentTime + 0.3) {
            const bar = Math.floor(step / 8) % progression.length;
            const chord = progression[bar];
            const i = step % 8;

            if (i === 0) {
                for (const interval of chord) {
                    tone(midiToFreq(root + 12 + interval), nextTime, stepDur * 7.4, 0.022, 'triangle', 900);
                }
            }
            if (i === 0 || i === 4) tone(midiToFreq(root - 12 + chord[0]), nextTime, stepDur * 3.4, 0.065, 'sine');
            if (i % 2 === 0) {
                const note = chord[(step / 2) % chord.length | 0];
                tone(midiToFreq(root + 24 + note), nextTime, stepDur * 1.1, 0.03, 'triangle', 2400);
            }
            if (i === 0 || i === 4) kick(nextTime, 0.1);
            if (i === 6) kick(nextTime, 0.05);
            if (i % 2 === 1) hat(nextTime);
            step += 1;
            nextTime += stepDur;
        }
    }

    function emit() {
        onTick?.({ elapsed, duration, playing, track });
    }

    function startClock() {
        clearInterval(timer);
        timer = setInterval(schedule, 120);
        clearInterval(tickTimer);
        tickTimer = setInterval(() => {
            if (!playing) return;
            elapsed = Math.min(duration, elapsed + 0.25);
            if (elapsed >= duration) { elapsed = 0; stopSources(); restartFromZero(); return; }
            emit();
        }, 250);
    }

    function stopSources() {
        clearInterval(timer);
        clearInterval(tickTimer);
        timer = 0;
        tickTimer = 0;
        step = 0;
    }

    function restartFromZero() {
        if (!playing) return;
        startedAt = ac.currentTime;
        nextTime = ac.currentTime + 0.05;
        schedule();
        startClock();
    }

    function play(next) {
        if (!ensure()) return false;
        if (next && (next.title !== track?.title || next.artist !== track?.artist)) {
            track = next;
            progression = trackParams(next);
            elapsed = 0;
            step = 0;
            nextTime = ac.currentTime + 0.06;
            startedAt = ac.currentTime;
        } else if (!track) {
            track = next || { title: '雪停之后', artist: '旧城电台' };
            progression = trackParams(track);
            elapsed = 0;
            step = 0;
            nextTime = ac.currentTime + 0.06;
            startedAt = ac.currentTime;
        } else {
            const stepDur = 60 / bpm / 2;
            step = Math.floor(elapsed / stepDur);
            nextTime = ac.currentTime + 0.06;
        }
        playing = true;
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setTargetAtTime(0.72, ac.currentTime, 0.05);
        schedule();
        startClock();
        emit();
        return true;
    }

    function pause() {
        if (!ac) return;
        playing = false;
        clearInterval(timer);
        clearInterval(tickTimer);
        timer = 0;
        tickTimer = 0;
        master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.08);
        setTimeout(() => { if (!playing && ac?.state === 'running') ac.suspend(); }, 260);
        emit();
    }

    function toggle(next) {
        if (playing) pause();
        else play(next || track);
    }

    function setVolume(value) {
        if (!master || !ac) return;
        master.gain.setTargetAtTime(Math.max(0.0001, Math.min(1, value)), ac.currentTime, 0.05);
    }

    function destroy() {
        playing = false;
        clearInterval(timer);
        clearInterval(tickTimer);
        try { ac?.close(); } catch { /* ignore */ }
        ac = null;
        master = null;
    }

    return {
        play, pause, toggle, destroy, setVolume,
        get playing() { return playing; },
        get track() { return track; },
    };
}
