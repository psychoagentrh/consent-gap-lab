import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../server.js';
import { createHash } from 'node:crypto';
import { specimen } from '../public/logic.js';

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
test('read-only specimens have deterministic digests and bounded case selection', async () => {
  for (const id of ['unlimited', 'bounded']) {
    const response = await fetch(base + '/api/specimens/' + id);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const expected = specimen(id);
    assert.deepEqual(await response.json(), { ...expected, payloadDigest:createHash('sha256').update(JSON.stringify(expected)).digest('hex') });
    const head = await fetch(base + '/api/specimens/' + id, { method:'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await fetch(base + '/api/specimens/' + id, { method:'POST' })).status, 405);
  }
  for (const id of ['unknown', 'https://example.com', 'unlimited/extra']) {
    assert.equal((await fetch(base + '/api/specimens/' + id)).status, 404);
  }
});
test('no visitor-triggered jobs and no accidental file exposure', async () => {
  const post = await fetch(base + '/private/product/runs', {method:'POST'});
  assert.equal(post.status, 405);
  for (const path of ['/server.js', '/package.json', '/missing']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});
