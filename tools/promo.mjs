import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const graph = readFileSync(new URL('./promo.filter', import.meta.url), 'utf8').replace(/\r?\n/g, '').trim();
const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-t', '16', '-i',
    'gradients=s=1080x1920:c0=0x080410:c1=0x2a1245:c2=0x07202b:x0=180:y0=0:x1=900:y1=1920:d=16',
    '-i', 'shots/p-home.png',
    '-i', 'shots/m2-chat.png',
    '-i', 'shots/p-ig.png',
    '-i', 'shots/p-map.png',
    '-filter_complex', graph,
    '-map', '[out]', '-r', '30',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19',
    '-movflags', '+faststart', 'docs/promo.mp4',
];
const child = spawn('ffmpeg', args, { stdio: 'inherit' });
child.on('exit', code => { console.log('ffmpeg exit', code); process.exit(code ?? 1); });
