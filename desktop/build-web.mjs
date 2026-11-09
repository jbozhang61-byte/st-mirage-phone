/**
 * 把手机 UI 需要的静态资源复制到 desktop/www，
 * 让打包后的 exe 自带一份网页，不依赖源码目录。
 */
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const out = join(here, 'www');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of ['preview', 'src', 'css']) {
  const from = join(repo, name);
  if (!existsSync(from)) continue;
  await cp(from, join(out, name), { recursive: true });
}
console.log('已复制到 desktop/www');
