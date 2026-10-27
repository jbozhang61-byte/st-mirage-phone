/**
 * 用本机 Chrome 无头模式截图预览页。
 * 用法：node tools/shot.mjs <url> <out.png> [width] [height] [budget]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const candidates = [
    process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const chrome = candidates.find(path => existsSync(path));
if (!chrome) {
    console.error('找不到 Chrome / Edge');
    process.exit(1);
}

const [url, out = 'shots/out.png', width = '1280', height = '900', budget = '4500'] = process.argv.slice(2);
const target = resolve(out);
mkdirSync(dirname(target), { recursive: true });

const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--window-size=' + width + ',' + height,
    '--screenshot=' + target,
    '--virtual-time-budget=' + budget,
    '--user-data-dir=' + resolve('.chrome-shot/' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
    url,
];

const child = spawn(chrome, args, { stdio: 'inherit' });
child.on('exit', code => {
    console.log('screenshot exit=' + code + ' -> ' + target);
    process.exit(code ?? 0);
});