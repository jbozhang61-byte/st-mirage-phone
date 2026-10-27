/** 静态检查：所有 import 的具名导出是否真的存在。 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function walk(dir, out = []) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
        if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
        const full = resolve(dir, item.name);
        if (item.isDirectory()) await walk(full, out);
        else if (extname(item.name) === '.js') out.push(full);
    }
    return out;
}

function exportsOf(code) {
    const names = new Set();
    for (const match of code.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) names.add(match[1]);
    for (const match of code.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) names.add(match[1]);
    for (const match of code.matchAll(/export\s*\{([^}]+)\}/g)) {
        for (const part of match[1].split(',')) {
            const name = part.trim().split(/\s+as\s+/).pop().replace(/^type\s+/, '').trim();
            if (name) names.add(name);
        }
    }
    return names;
}

const files = await walk(root);
const cache = new Map();
let problems = 0;

for (const file of files) {
    const code = await readFile(file, 'utf8');
    for (const match of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
        const spec = match[2];
        if (!spec.startsWith('.')) continue;
        const target = resolve(dirname(file), spec);
        let targetCode = cache.get(target);
        if (targetCode === undefined) {
            try { targetCode = await readFile(target, 'utf8'); } catch { targetCode = null; }
            cache.set(target, targetCode);
        }
        if (!targetCode) {
            console.log('MISSING FILE', file, '->', spec);
            problems++;
            continue;
        }
        const available = exportsOf(targetCode);
        for (const part of match[1].split(',')) {
            const name = part.trim().split(/\s+as\s+/)[0].trim();
            if (!name) continue;
            if (!available.has(name)) {
                console.log('MISSING EXPORT', name, 'in', spec, 'from', file);
                problems++;
            }
        }
    }
}
console.log(problems ? 'problems: ' + problems : 'all imports resolve');