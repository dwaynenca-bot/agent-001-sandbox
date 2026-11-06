import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, sep, extname} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'};
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(root, '.' + (name === '/' ? '/index.html' : name));
      const relative = path.slice(root.length).split(sep);
      if (!path.startsWith(root) || relative.some(part => part.startsWith('.')) || !(path === resolve(root, 'index.html') || path.startsWith(resolve(root, 'src') + sep))) { res.writeHead(404).end(); return; }
      const body = await readFile(path);
      res.writeHead(200, {'Content-Type': `${types[extname(path)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store'});
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404).end(); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer();
  server.listen(4173, '127.0.0.1', () => console.log('Local foundation: http://127.0.0.1:4173'));
}
