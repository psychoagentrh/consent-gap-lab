#!/usr/bin/env node
// Regenerate only the embedded contract, decoder, evaluator and typed outputs.
// No login, credentials, network, job dispatch or manual copy/paste is involved.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { APPROVAL_CASES, UNSIGNED_APPROVAL_OUTPUTS } from './unsigned-approval-contract.js';

const flowUrl = new URL('./ConsentGapSolution/Psycho_UnsignedApproval/Psycho_UnsignedApproval.flow', import.meta.url);
const stripModule = text => text.replace(/^import .*;\n/gm, '').replace(/^export /gm, '').trim();
export function buildUnsignedFlow() {
  const flow = JSON.parse(fs.readFileSync(flowUrl, 'utf8'));
  const http = flow.nodes.find(node => typeof node.inputs?.detail?.bodyParameters?.url === 'string');
  const script = flow.nodes.find(node => typeof node.inputs?.script === 'string');
  const end = flow.nodes.at(-1);
  if (!http || !script || end.type !== 'core.control.end') throw new Error('Unexpected Flow structure');
  const decoderSource = fs.readFileSync(new URL('../public/approval.js', import.meta.url), 'utf8');
  const marker = '// Invented teaching address, not a recommendation or a verified contract.';
  if (!decoderSource.includes(marker)) throw new Error('Canonical decoder teaching-example marker is missing');
  const contract = stripModule(fs.readFileSync(new URL('./unsigned-approval-contract.js', import.meta.url), 'utf8'));
  // The pinned Script SDK rejects undeclared Error subclass properties. Only the
  // UI field-routing assignment is omitted; validation and comparison stay canonical.
  const decoder = stripModule(decoderSource.split(marker)[0]).replace('this.field = field;', '');
  const evaluator = stripModule(fs.readFileSync(new URL('./evaluate-unsigned-approval.js', import.meta.url), 'utf8'));
  const base = 'https://psycho-product.fly.dev/api/unsigned-approvals/';
  http.display.label = 'Fetch one enumerated owned unsigned fixture';
  http.inputs.detail.bodyParameters.url = `=js:${APPROVAL_CASES.map(id => `$vars.start.output.approvalCase === ${JSON.stringify(id)} ? ${JSON.stringify(base + id)} : `).join('')}${JSON.stringify(base + 'invalid')}`;
  script.display.label = 'Decode approval and compare amount and supplied spender';
  // SDK 1.202.1 derives types from TypeScript quick-info text, which truncates
  // a long object with 14 verbose keys. Short internal slots keep all 14 fields
  // strictly inferred. Public typed End names stay descriptive and unchanged.
  script.inputs.script = `${contract}\n\n${decoder}\n\n${evaluator}\n\nconst observation = evaluateUnsignedApproval($vars[${JSON.stringify(http.id)}].output.body, $vars.start.output.approvalCase);\nreturn {\n${UNSIGNED_APPROVAL_OUTPUTS.map((key,index) => `  f${index}: observation.${key}`).join(',\n')}\n};`;
  const outputKey = `$vars.${script.id}.output`;
  end.outputs = Object.fromEntries(UNSIGNED_APPROVAL_OUTPUTS.map((key,index) => [key, {source:`=js:${outputKey}.f${index}`} ]));
  flow.variables.globals = [
    ...flow.variables.globals.filter(variable => variable.direction !== 'out'),
    ...UNSIGNED_APPROVAL_OUTPUTS.map(key => ({
      id:key, direction:'out', type:['scopeExceedsButton', 'approvalIsSwap'].includes(key) ? 'boolean' : 'string'
    }))
  ];
  return flow;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const expected = `${JSON.stringify(buildUnsignedFlow(), null, 2)}\n`;
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(flowUrl, 'utf8') !== expected) throw new Error('Embedded Flow is stale. Run node uipath/build-unsigned-flow.mjs');
    console.log('Unsigned approval Flow matches canonical contract, decoder and evaluator.');
  } else {
    fs.writeFileSync(flowUrl, expected);
    console.log('Regenerated unsigned approval Flow from canonical sources.');
  }
}
