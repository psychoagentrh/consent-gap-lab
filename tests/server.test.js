import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../server.js';

const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
test.after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;

test('demo and scripts available with protective policy', async () => {
  for (const path of ['/', '/app.js', '/logic.js', '/style.css']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
    assert.ok((await response.text()).length > 10);
  }
});
test('health endpoint and HEAD work', async () => {
  const health = await fetch(base + '/healthz');
  assert.deepEqual(await health.json(), {status: 'ok'});
  const head = await fetch(base + '/', {method: 'HEAD'});
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
test('no visitor-triggered jobs and no accidental file exposure', async () => {
  const post = await fetch(base + '/private/product/runs', {method:'POST'});
  assert.equal(post.status, 405);
  for (const path of ['/server.js', '/package.json', '/missing']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});
