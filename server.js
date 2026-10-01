import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
export function app(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type':'application/json' }); res.end(JSON.stringify({ status:'ok' })); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const target = path.resolve(root, name);
  if (!target.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
  readFile(target).then(data => { res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'public, max-age=60', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'" }); if (req.method === 'HEAD') res.end(); else res.end(data); }).catch(() => { res.writeHead(404); res.end('Not found'); });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) http.createServer(app).listen(Number(process.env.PORT || 8080), '0.0.0.0');
