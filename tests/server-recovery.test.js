import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Isolate the process: an uncaught request-handler exception must fail the test,
// not terminate the test runner. Raw paths bypass fetch's URL normalization.
const fixture = `
  import http from 'node:http';
  import { app } from './server.js';
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1', () => console.log(server.address().port));
`;
async function startServer(t) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', fixture], {
    cwd: new URL('../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8192); });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
  });
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => finish(new Error('Isolated server startup timed out')), 5000);
    const onError = error => finish(error);
    const onExit = code => finish(new Error(`Isolated server exited before readiness (${code}): ${stderr}`));
    const onData = chunk => {
      output += chunk;
      if (!output.includes('\n')) return;
      const value = Number(output.trim());
      finish(Number.isInteger(value) && value > 0 ? null : new Error('Invalid readiness port'), value);
    };
    function finish(error, value) {
      clearTimeout(timer);
      child.off('error', onError);
      child.off('exit', onExit);
      child.stdout.off('data', onData);
      if (error) reject(error); else resolve(value);
    }
    child.once('error', onError);
    child.once('exit', onExit);
    child.stdout.on('data', onData);
  });
  return { child, port, stderr: () => stderr };
}
function rawRequest(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname:'127.0.0.1', port, path, method, agent:false }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status:response.statusCode, headers:response.headers, body:Buffer.concat(chunks).toString() }));
    });
    request.on('error', reject);
    request.setTimeout(3000, () => request.destroy(new Error('Raw request timed out')));
    request.end();
  });
}

test('malformed raw request targets return 400 and preserve server availability', { timeout:15000 }, async t => {
  const { child, port, stderr } = await startServer(t);
  assert.equal((await rawRequest(port, '/healthz')).status, 200);
  for (const path of ['//[', '//[::1', 'http://[']) {
    let invalid;
    try { invalid = await rawRequest(port, path); }
    catch (error) { assert.fail(`Malformed request disconnected instead of returning 400: ${error.message}\n${stderr()}`); }
    assert.equal(invalid.status, 400, path);
    assert.equal(invalid.body, 'Bad request');
    assert.equal(invalid.headers['cache-control'], 'no-store');
    assert.equal(invalid.headers['content-type'], 'text/plain; charset=utf-8');
    assert.equal(invalid.headers['x-content-type-options'], 'nosniff');
    assert.doesNotMatch(invalid.body, /ERR_INVALID_URL|server\.js|TypeError/);
    assert.equal(child.exitCode, null, 'server process remains alive');
    const health = await rawRequest(port, '/healthz');
    assert.equal(health.status, 200);
    assert.deepEqual(JSON.parse(health.body), { status:'ok' });
    const inspector = await rawRequest(port, '/inspect.html');
    assert.equal(inspector.status, 200);
    assert.match(inspector.headers['content-security-policy'], /connect-src 'none'/);
    const specimen = await rawRequest(port, '/api/specimens/bounded');
    assert.equal(specimen.status, 200);
    assert.equal(JSON.parse(specimen.body).case, 'bounded');
  }
  const head = await rawRequest(port, '//[', 'HEAD');
  assert.equal(head.status, 400);
  assert.equal(head.body, '');
  assert.equal((await rawRequest(port, '/healthz')).status, 200);
  assert.equal(stderr(), '', 'no unhandled request-parser exceptions');
});
