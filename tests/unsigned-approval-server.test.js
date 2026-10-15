import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { app } from '../server.js';
import { unsignedApprovalFixture } from '../uipath/unsigned-approval-fixture.js';
import { evaluateUnsignedApproval } from '../uipath/evaluate-unsigned-approval.js';

const server = http.createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
test.after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}`;
for(const id of ['maximum','bounded','spender-match','spender-mismatch']) {
  test(`read-only ${id} unsigned fixture has reproducible digest and decodable bytes`, async () => {
    const response = await fetch(base + '/api/unsigned-approvals/' + id);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const expected = unsignedApprovalFixture(id);
    const body = await response.json();
    assert.deepEqual(body, { ...expected, payloadDigest:createHash('sha256').update(JSON.stringify(expected)).digest('hex') });
    assert.equal(evaluateUnsignedApproval(body, id).comparison, id === 'maximum' ? 'larger' : 'equal');
    const head = await fetch(base + '/api/unsigned-approvals/' + id, {method:'HEAD'});
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    for (const method of ['POST','PUT','DELETE']) assert.equal((await fetch(base + '/api/unsigned-approvals/' + id, {method})).status, 405);
  });
}
test('invalid case, extra data and attempted jobs do not dispatch or break the server', async () => {
  for (const path of ['/api/unsigned-approvals/unknown','/api/unsigned-approvals/maximum/extra','/api/unsigned-approvals/maximum?url=https://example.com','/api/unsigned-approvals/bounded?calldata=private']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /private|example\.com/);
  }
  assert.equal((await fetch(base + '/private/product/runs', {method:'POST'})).status, 405);
  assert.deepEqual(await (await fetch(base + '/healthz')).json(), {status:'ok'});
  assert.equal((await fetch(base + '/api/unsigned-approvals/maximum')).status, 200);
});
