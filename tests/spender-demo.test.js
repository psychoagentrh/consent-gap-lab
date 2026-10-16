import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { approvalExamples, decodeApproval } from '../public/approval.js';

const directory = new URL('../public/demo/', import.meta.url);
const record = JSON.parse(await readFile(new URL('spender-capture.json', directory), 'utf8'));
const html = await readFile(new URL('../public/demo.html', import.meta.url), 'utf8');

test('public spender capture inputs reproduce the bounded bytes and independent expectations', () => {
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.kind, 'synthetic-local-inspector-capture');
  assert.equal(record.inputs.calldata, approvalExamples.bounded);
  assert.equal(record.inputs.claimedAmount, '20');
  assert.equal(record.inputs.decimals, '18');
  assert.equal(record.inputs.expectedSpender, '0x' + '2'.repeat(40));
  assert.equal(record.outputs.decodedSpender, '0x' + '1'.repeat(40));
  const decoded = decodeApproval(record.inputs.calldata);
  assert.equal(decoded.spender, record.outputs.decodedSpender);
  assert.equal(decoded.rawAllowance, '20000000000000000000');
  assert.notEqual(decoded.spender, record.inputs.expectedSpender);
  assert.match(record.sourceRevision, /^[a-f0-9]{40}$/);
  assert.match(record.publicSourceRevision, /^[a-f0-9]{40}$/);
});

test('published unedited spender PNGs match recorded digests, dimensions and dates', async () => {
  assert.deepEqual(record.captures.map(capture => capture.viewportWidth), [1280, 390]);
  for (const capture of record.captures) {
    const bytes = await readFile(new URL(capture.filename, directory));
    assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), capture.sha256);
    assert.equal(bytes.readUInt32BE(16), capture.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), capture.pixelHeight);
    assert.equal(capture.interactionRequests, 0);
    assert.deepEqual(capture.pageErrors, []);
    assert.equal(new Date(capture.observedAt).toISOString(), capture.observedAt);
    assert.ok(html.includes('datetime="' + capture.observedAt + '"'));
    assert.ok(html.includes('width="' + capture.pixelWidth + '" height="' + capture.pixelHeight + '"'));
  }
});

test('demo preserves capture provenance and separates local UI from UiPath observations', () => {
  assert.ok(html.includes(record.sourceRevision));
  assert.ok(html.includes(record.publicSourceRevision));
  assert.ok(html.includes(record.capturedFrom));
  assert.ok(html.includes(record.inputs.expectedSpender));
  assert.ok(html.includes(record.outputs.amountLabel));
  assert.ok(html.includes(record.outputs.spenderLabel));
  assert.match(html, /They do not test this browser UI or authenticate a user's intended address/);
  assert.match(html, /October 15 owner-controlled UiPath observations/);
  assert.match(html, /href="\/spender-evidence.html"/);
  assert.match(html, /Historical captures are not live guarantees or UiPath attestations/);
  assert.match(html, /not checksum, chain, contract, ownership or spender safety/);
});
