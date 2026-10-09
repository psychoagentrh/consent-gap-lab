import test from 'node:test';
import assert from 'node:assert/strict';
import { examplePath, exampleURL, readExampleLink, invalidExampleMessage } from '../public/inspector-link.js';

test('example link is a fixed canonical name, with no request fields', () => {
  assert.equal(exampleURL, 'https://lab.psychoagent.com/inspect.html?example=maximum-vs-20');
  assert.deepEqual([...new URL(exampleURL).searchParams], [['example', 'maximum-vs-20']]);
  assert.equal(readExampleLink(exampleURL), 'maximum');
  assert.equal(readExampleLink('https://psycho-product.fly.dev' + examplePath), 'maximum');
});
test('bare inspector loads no preset', () => {
  assert.equal(readExampleLink('https://lab.psychoagent.com/inspect.html'), null);
});
test('unknown, duplicate, extra and fragment data are refused without echo', () => {
  for (const suffix of ['?example=unknown', '?example=', '?example=maximum', '?example=maximum-vs-20&example=maximum-vs-20', '?example=maximum-vs-20&amount=99', '?spender=synthetic-private', '?example=maximum-vs-20#synthetic-private', '#synthetic-private', '?EXAMPLE=maximum-vs-20', '?example=maximum-vs-20%00']) {
    assert.throws(() => readExampleLink('https://lab.psychoagent.com/inspect.html' + suffix), error => error.message === invalidExampleMessage);
  }
});
test('example name can be URL-encoded but never interpreted as arbitrary data', () => {
  assert.equal(readExampleLink('https://lab.psychoagent.com/inspect.html?example=maximum%2Dvs%2D20'), 'maximum');
  assert.throws(() => readExampleLink('https://lab.psychoagent.com/inspect.html?example=%3Cscript%3E'), error => error.message === invalidExampleMessage);
});
