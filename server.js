import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { specimen } from './public/logic.js';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
export function app(req, res) {
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch {
    res.writeHead(400, { 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : 'Bad request');
    return;
  }
  if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type':'application/json' }); res.end(JSON.stringify({ status:'ok' })); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  if (url.pathname.startsWith('/api/specimens/')) {
    const id = url.pathname.slice('/api/specimens/'.length);
    if (!['unlimited','bounded'].includes(id)) { res.writeHead(404); res.end('Unknown specimen'); return; }
    const payload = specimen(id);
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const body = JSON.stringify({ ...payload, payloadDigest:digest });
    res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body); return;
  }
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const target = path.resolve(root, name);
  if (!target.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
  const policy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; object-src 'none'" + (name === 'inspect.html' ? "; connect-src 'none'; frame-src 'none'" : '');
  readFile(target).then(data => { res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'public, max-age=60', 'Referrer-Policy':'no-referrer', 'Content-Security-Policy':policy }); if (req.method === 'HEAD') res.end(); else res.end(data); }).catch(() => { res.writeHead(404); res.end('Not found'); });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) http.createServer(app).listen(Number(process.env.PORT || 8080), '0.0.0.0');
