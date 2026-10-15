import test from 'node:test';
import assert from 'node:assert/strict';
import {cp, mkdtemp, mkdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {unsignedApprovalFixture, APPROVAL_CASES} from '../uipath/unsigned-approval-fixture.js';

const root = fileURLToPath(new URL('../', import.meta.url));

// Models this project's Docker COPY inputs, not Docker, Alpine, or image execution.
// The production server has no npm runtime dependencies.
async function stageRuntime(stage) {
  const dockerfile = await readFile(path.join(root, 'Dockerfile'), 'utf8');
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
  for (const line of dockerfile.split('\n').filter(line => line.startsWith('COPY '))) {
    const args = line.split(/\s+/).slice(1).filter(arg => !arg.startsWith('--'));
    const destination = args.pop();
    assert.ok(destination && !destination.startsWith('/'), 'COPY destination must stay relative');
    for (const source of args) {
      assert.ok(!source.includes('..') && !source.startsWith('/'), 'bounded COPY source');
      const target = path.resolve(stage, destination.endsWith('/') ? path.join(destination, path.basename(source)) : destination);
      assert.ok(target.startsWith(stage + path.sep), 'COPY target stays inside staged runtime');
      await mkdir(path.dirname(target), {recursive:true});
      await cp(path.join(root, source), target, {recursive:true});
    }
  }
}

function startRuntime(stage) {
  const code = "import http from 'node:http'; import {app} from './server.js'; const server=http.createServer(app); server.listen(0,'127.0.0.1',()=>console.log('READY:'+server.address().port));";
  const child = spawn(process.execPath, ['--input-type=module', '--eval', code], {cwd:stage, env:{...process.env, NODE_ENV:'production'}});
  const ready = new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Staged runtime readiness timed out')); }, 10000);
    child.stdout.on('data', data => {
      stdout += data;
      const match = stdout.match(/READY:(\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); if (!stdout.includes('READY:')) reject(new Error(`Staged runtime exited ${code}: ${stderr}`)); });
  });
  return {child, ready};
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  await exited;
}

test('Docker COPY runtime boots, serves four unsigned fixtures, and detects omitted contract', async () => {
  const stage = await mkdtemp(path.join(tmpdir(), 'consent-gap-runtime-'));
  let runtime;
  try {
    await stageRuntime(stage);
    runtime = startRuntime(stage);
    const base = await runtime.ready;
    const health = await fetch(`${base}/healthz`, {signal:AbortSignal.timeout(5000)});
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {status:'ok'});
    for (const name of APPROVAL_CASES) {
      const response = await fetch(`${base}/api/unsigned-approvals/${name}`, {signal:AbortSignal.timeout(5000)});
      assert.equal(response.status, 200, name);
      const expected = unsignedApprovalFixture(name);
      const payloadDigest = createHash('sha256').update(JSON.stringify(expected)).digest('hex');
      assert.deepEqual(await response.json(), {...expected, payloadDigest}, name);
    }
    assert.equal((await fetch(base, {signal:AbortSignal.timeout(5000)})).status, 200);
    await stop(runtime.child);
    runtime = undefined;
    await rm(path.join(stage, 'uipath/unsigned-approval-contract.js'));
    runtime = startRuntime(stage);
    await assert.rejects(runtime.ready, /ERR_MODULE_NOT_FOUND[\s\S]*unsigned-approval-contract|unsigned-approval-contract[\s\S]*ERR_MODULE_NOT_FOUND/);
  } finally {
    if (runtime) await stop(runtime.child);
    await rm(stage, {recursive:true, force:true});
  }
});
