/** 零依赖静态服务器，只给本地预览用。 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 7788;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
};

const server = http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname === '/') pathname = '/preview/index.html';
        const file = normalize(join(ROOT, pathname));
        if (!file.startsWith(ROOT)) { response.writeHead(403).end('forbidden'); return; }
        const info = await stat(file).catch(() => null);
        const target = info?.isDirectory() ? join(file, 'index.html') : file;
        const body = await readFile(target);
        response.writeHead(200, {
            'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store',
        });
        response.end(body);
    } catch {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found');
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('preview: http://127.0.0.1:' + PORT + '/preview/');
});