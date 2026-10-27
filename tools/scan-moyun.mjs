import { readFileSync } from 'node:fs';
const s = readFileSync('shots/moyun-index.js', 'utf8');
for (const key of ['pinch','gesture','scalePhone','phoneScale','resize','pointerdown','touchstart','touchmove','dragPhone','translate3d','setPointerCapture','clientX']) {
  let idx = -1, count = 0;
  while ((idx = s.indexOf(key, idx + 1)) >= 0 && count < 4) {
    console.log('--- ' + key + ' @' + idx + ' ---');
    console.log(s.slice(Math.max(0, idx - 180), idx + 260).replace(/\s+/g, ' '));
    count++;
  }
}
