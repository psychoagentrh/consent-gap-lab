import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { app } from '../server.js';
import { UNSIGNED_APPROVAL_OUTPUTS } from '../uipath/unsigned-approval-contract.js';
import { unsignedApprovalFixture } from '../uipath/unsigned-approval-fixture.js';
import { evaluateUnsignedApproval } from '../uipath/evaluate-unsigned-approval.js';
const text = path => readFile(new URL('../'+path,import.meta.url),'utf8');
const artifact = await text('public/spender-owner-observations.json');
const evidence = JSON.parse(artifact);
const page = await text('public/spender-evidence.html');
const cases = ['spender-match','spender-mismatch'];

test('spender publication is bounded and excludes private receipt fields', () => {
  assert.deepEqual(Object.keys(evidence).sort(),['schema','workflow','packageVersion','testedWorkspaceRevision','publicSourceRevision','provenance','redaction','observations'].sort());
  assert.equal(evidence.schema,'consent-gap/spender-owner-observations-v1');
  assert.equal(evidence.workflow,'unsigned-approval-observation');
  assert.equal(evidence.packageVersion,'1.1.1');
  assert.equal(evidence.testedWorkspaceRevision,'e2c6632c06561f184778821b3c9d01fb27909818');
  assert.equal(evidence.publicSourceRevision,'055dc58b184778d3553846f4030d3a8f48262c6d');
  assert.match(evidence.provenance,/unsigned, redacted publication/);
  assert.match(evidence.provenance,/not an independently verifiable UiPath attestation/);
  assert.deepEqual(evidence.observations.map(item=>item.input.approvalCase),cases);
  for (const row of evidence.observations) {
    assert.deepEqual(Object.keys(row).sort(),['input','outputs']);
    assert.deepEqual(Object.keys(row.input),['approvalCase']);
    assert.deepEqual(Object.keys(row.outputs).sort(),[...UNSIGNED_APPROVAL_OUTPUTS].sort());
    assert.equal(row.outputs.approvalCaseObserved,row.input.approvalCase);
  }
  for (const published of [artifact,page]) assert.doesNotMatch(published,/https?:\/\/[^"\s<>]*(?:uipath\.com|orchestrator)|Bearer\s|\/workspace\/|3d6fca13-d49c|c9836afa-7ced|unsigned-spender-(?:match|mismatch)-e2c6632c|"(?:operation_id|job_key|tenant_id|organization_id|credentials|raw_trace)"/i);
});

test('spender recorded outputs reproduce exact fixture bytes, with independent amount/address results', () => {
  const times = ['2026-10-15T18:43:34.676Z','2026-10-15T18:49:28.601Z'];
  for (const [index,{input,outputs}] of evidence.observations.entries()) {
    const fixture=unsignedApprovalFixture(input.approvalCase);
    const payloadDigest=createHash('sha256').update(JSON.stringify(fixture)).digest('hex');
    const local=evaluateUnsignedApproval({...fixture,payloadDigest},input.approvalCase);
    assert.equal(outputs.observedAt,times[index]);
    for (const key of UNSIGNED_APPROVAL_OUTPUTS) if (key!=='observedAt') assert.deepEqual(outputs[key],local[key],key);
    assert.equal(outputs.comparison,'equal');
    assert.equal(outputs.scopeExceedsButton,false);
    assert.equal(outputs.rawAllowance,'20000000000000000000');
    assert.equal(outputs.spenderComparison,index===0?'equal':'different');
    assert.match(outputs.method,/not browser automation or a signed transaction/);
  }
});

test('October 12 evidence and the verified Flow remain unchanged rather than being retroactively upgraded', async () => {
  const pinned = {
    'public/unsigned-owner-observations.json':'cfc4119187c6b98e5570e076d64c949e169714a8786d1fefc11eb23fe3686eaa',
    'public/unsigned-evidence.html':'be5fce3e9bc25563c4aa09d7441fd3698ddc9d049404b3144c3a7b59f8b199b5',
    'uipath/ConsentGapSolution/Psycho_UnsignedApproval/Psycho_UnsignedApproval.flow':'2e44b7c0b464ac2a013fa07d53bd065e332319a2d6de19017de997609b413763'
  };
  for(const [path,hash] of Object.entries(pinned)) assert.equal(createHash('sha256').update(await text(path)).digest('hex'),hash,path);
});

test('new static evidence supplies native share/read controls and does not overclaim browser, intent or safety proof', () => {
  assert.doesNotMatch(page,/<script\b|<form\b|<iframe\b/i);
  assert.ok(page.includes('href="/demo.html#spender-mismatch"'));
  assert.ok(page.includes('href="/spender-owner-observations.json"'));
  for(const revision of [evidence.testedWorkspaceRevision,evidence.publicSourceRevision]) assert.ok(page.includes(revision));
  for(const {input,outputs} of evidence.observations) {
    assert.ok(page.includes(`<details id="${input.approvalCase}" open>`));
    assert.ok(page.includes(`href="/spender-evidence.html#${input.approvalCase}"`));
    assert.ok(page.includes(`datetime="${outputs.observedAt}"`));
    for(const value of [outputs.spender,outputs.expectedSpender,outputs.payloadDigest,outputs.rawAllowance]) assert.ok(page.includes(value));
  }
  for(const boundary of ['not an independently verifiable UiPath attestation','Visitor-triggered UiPath Cloud runs remain disabled','not live guarantees','Address equality is not a safety verdict','supplied synthetic expectation','not browser automation or a signed transaction','Supplied expectations do not establish ownership','20 SYN']) assert.ok(page.includes(boundary),boundary);
});

test('home, demo and reproduction guides discover spender proof without broadening the October 12 evidence', async () => {
  for(const path of ['public/index.html','public/build.html','public/demo.html','README.md','BUILDERS.md','UNSIGNED-APPROVAL.md','PRODUCT.md','DESIGN.md']) {
    assert.ok((await text(path)).includes('spender-evidence.html'),path);
  }
  assert.doesNotMatch(await text('UNSIGNED-APPROVAL.md'),/spender-aware Cloud proof is pending/);
});

test('new publication is read-only, keeps CSP and does not add a job endpoint', async () => {
  const server=http.createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    for(const path of ['/spender-evidence.html','/spender-owner-observations.json']) {
      const response=await fetch(base+path);
      assert.equal(response.status,200);
      assert.match(response.headers.get('content-security-policy'),/form-action 'none'/);
      assert.equal(await response.text(),path.endsWith('.json')?artifact:page);
      const head=await fetch(base+path,{method:'HEAD'});
      assert.equal(head.status,200); assert.equal(await head.text(),'');
      assert.equal((await fetch(base+path,{method:'POST',body:'no-job'})).status,405);
    }
    assert.equal((await fetch(base+'/api/runs')).status,404);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
