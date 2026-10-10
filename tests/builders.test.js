import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { specimen } from '../public/logic.js';
import { evaluateSpecimen } from '../uipath/evaluate-specimen.js';

const text = async path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const page = await text('public/build.html');
const guide = await text('BUILDERS.md');
const flow = JSON.parse(await text('uipath/ConsentGapSolution/ConsentGap/Psycho_ConsentGap.flow'));
const manifest = JSON.parse(await text('uipath/workflows.json'));
const httpNode = flow.nodes.find(node => node.type === 'core.action.http.v2');
const script = flow.nodes.find(node => node.type === 'core.action.script');
const end = flow.nodes.find(node => node.type === 'core.control.end');
const fixture = id => {
  const data = specimen(id);
  return { ...data, payloadDigest:createHash('sha256').update(JSON.stringify(data)).digest('hex') };
};
const observe = id => {
  const evaluated = evaluateSpecimen(fixture(id),id);
  const $vars = { evaluateSyntheticPermission1:{output:evaluated} };
  return Object.fromEntries(Object.entries(end.outputs).map(([name,value]) => [name,new Function('$vars','return '+value.source.slice(4))($vars)]));
};

test('builder walkthrough documents the actual four-node Flow and all End output names', () => {
  assert.deepEqual(flow.nodes.map(n => n.type),['core.trigger.manual','core.action.http.v2','core.action.script','core.control.end']);
  assert.equal((page.match(/<details\b/g)||[]).length,flow.nodes.length);
  assert.equal(Object.keys(end.outputs).length,8);
  for(const name of Object.keys(end.outputs)) {
    assert.ok(page.includes('<code>'+name+'</code>'),name+' missing in walkthrough');
    assert.ok(guide.includes('`'+name+'`'),name+' missing in guide');
  }
  assert.equal(httpNode.inputs.timeout,'PT30S');
  assert.equal(httpNode.inputs.retryCount,0);
  assert.ok(page.includes('30-second timeout and zero retries'));
  assert.ok(guide.includes('30-second action timeout and no retries'));
  assert.ok(httpNode.inputs.detail.bodyParameters.url.includes('https://psycho-product.fly.dev/api/specimens/'));
  assert.equal(httpNode.inputs.detail.bodyParameters.method,'GET');
  assert.ok(!guide.includes('specimenUrl'));
});

for(const id of ['unlimited','bounded']) test('builder output table matches embedded Flow script for '+id, () => {
  const result = observe(id);
  const embedded = new Function('$vars',script.inputs.script)({readOwnedSyntheticSpecimen1:{output:{body:fixture(id)}},start:{output:{specimenCase:id}}});
  assert.equal(embedded.verdict,result.verdict);
  assert.equal(result.specimenCaseObserved,id);
  assert.equal(result.scopeExceedsButton,id==='unlimited');
  assert.equal(result.approvalIsSwap,false);
  assert.ok(page.includes('<code>'+result.verdict+'</code>'));
  assert.ok(guide.includes('| `'+id+'` | `'+result.scopeExceedsButton+'` | `'+result.verdict+'` |'));
  assert.equal(result.fixtureSchema,'consent-gap/v1');
  assert.equal(result.method,'HTTP JSON fixture observation, not browser automation');
});

test('documented rejection boundaries are exercised, not substituted results', () => {
  const run = new Function('$vars',script.inputs.script);
  const vars = body => ({readOwnedSyntheticSpecimen1:{output:{body}},start:{output:{specimenCase:'unlimited'}}});
  assert.throws(() => run(vars('{not json')));
  assert.throws(() => run(vars(JSON.stringify(fixture('bounded')))));
  assert.throws(() => run(vars(JSON.stringify({...fixture('unlimited'),payloadDigest:'invalid'}))));
  assert.ok(page.includes('does not independently recompute or authenticate'));
  assert.ok(guide.includes('Does **not** independently recompute or authenticate'));
});

test('guide names safe fixture inputs, historical proof and owner-run boundary', () => {
  for(const id of ['unlimited','bounded']) assert.ok(guide.includes('--inputs \'{"specimenCase":"'+id+'"}\''));
  assert.ok(guide.includes('--validate performs') || guide.includes('`--validate` performs'));
  assert.ok(guide.includes('it does not by itself prove that a process is deployed/runnable'));
  assert.ok(/timeout.*(not.*cancel|does not.*cancel)|not.*cancel.*timeout/is.test(guide));
  assert.ok(page.includes('cannot start a Cloud job'));
  assert.ok(page.includes('Older observations are not live guarantees'));
  assert.equal(manifest.workflows[0].inputs.specimenCase.enum.join(','),'unlimited,bounded');
});

test('walkthrough is discoverable and its same-origin links exist', async () => {
  for(const file of ['public/index.html','public/evidence.html']) assert.ok((await text(file)).includes('href="/build.html"'));
  assert.ok((await text('README.md')).includes('BUILDERS.md'));
  for(const href of [...page.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map(match=>match[1])) {
    const path=href.split(/[?#]/)[0];
    if(path.startsWith('/api/')) assert.ok(['/api/specimens/unlimited','/api/specimens/bounded'].includes(path));
    else assert.ok((await text('public/'+(path==='/'?'index.html':path.slice(1)))).length>0,path);
  }
  assert.ok(!/<script\b/.test(page));
  assert.ok(!/<(?:iframe|form)\b/.test(page));
});
