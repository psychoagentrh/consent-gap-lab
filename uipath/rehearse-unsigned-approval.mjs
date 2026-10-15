#!/usr/bin/env node
// Credential-free rehearsal, not a UiPath job. Execute the exact embedded
// script against the owned fixture service; emit only bounded redacted outputs.
import fs from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { app } from '../server.js';
import { APPROVAL_CASES } from './unsigned-approval-contract.js';

const flow = JSON.parse(fs.readFileSync(new URL('./ConsentGapSolution/Psycho_UnsignedApproval/Psycho_UnsignedApproval.flow', import.meta.url), 'utf8'));
const script = flow.nodes.find(node => typeof node.inputs?.script === 'string');
const http = flow.nodes.find(node => typeof node.inputs?.detail?.bodyParameters?.url === 'string');
assert.ok(script && http, 'Flow must contain both HTTP and Script activities');
const execute = new Function('$vars', script.inputs.script);
const server = createServer(app).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const results = [];
  for (const approvalCase of APPROVAL_CASES) {
    const response = await fetch(`${base}/api/unsigned-approvals/${approvalCase}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    const { payloadDigest, ...payload } = body;
    assert.equal(payloadDigest, createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
    const scriptOutput = execute({ start:{ output:{ approvalCase } }, [http.id]:{ output:{ body:JSON.stringify(body) } } });
    const output = Object.fromEntries(Object.entries(flow.nodes.at(-1).outputs).map(([name,mapping]) => [name,new Function('$vars','return ' + mapping.source.slice(4))({[script.id]:{output:scriptOutput}})]));
    assert.equal(output.comparison, approvalCase === 'maximum' ? 'larger' : 'equal');
    assert.equal(output.scopeExceedsButton, approvalCase === 'maximum');
    assert.equal(output.approvalIsSwap, false);
    assert.equal(output.spenderComparison, approvalCase === 'spender-match' ? 'equal' : approvalCase === 'spender-mismatch' ? 'different' : 'not-provided');
    assert.equal(output.expectedSpender, body.expectedSpender || '');
    assert.equal(output.payloadDigest, payloadDigest);
    assert.deepEqual(Object.keys(output), Object.keys(flow.nodes.at(-1).outputs));
    results.push(output);
  }
  console.log(JSON.stringify({ method:'Credential-free local HTTP and embedded-script rehearsal, not a UiPath Cloud run', results }, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
}
