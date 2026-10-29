import { mkdir, writeFile } from 'node:fs/promises';
import { artSvg } from '../src/art.js';

const moods = ['night', 'dusk', 'snow', 'warm', 'cold', 'neon', 'green', 'paper'];
const count = 240;
await mkdir(new URL('../assets/library/', import.meta.url), { recursive: true });
for (let i = 1; i <= count; i++) {
    const seed = 'mirage-library-' + i;
    const svg = artSvg(seed, moods[(i - 1) % moods.length]);
    const file = new URL('../assets/library/art-' + String(i).padStart(3, '0') + '.svg', import.meta.url);
    await writeFile(file, svg, 'utf8');
}
await writeFile(new URL('../assets/library/manifest.json', import.meta.url), JSON.stringify({ count, generated: new Date().toISOString() }, null, 2), 'utf8');
console.log('generated', count, 'images');
