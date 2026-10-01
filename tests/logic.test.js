import test from 'node:test';
import assert from 'node:assert/strict';
import { cases, chooseCase, reveal } from '../public/logic.js';

test('both fixtures have the same visible CTA but different permission scopes', () => {
  assert.equal(cases.unlimited.button, cases.bounded.button);
  assert.match(cases.unlimited.scope, /Unlimited/);
  assert.match(cases.bounded.scope, /20 TEST/);
});
test('predictions resolve for both cases, without asserting a swap occurred', () => {
  assert.equal(reveal('unlimited', 'future').correct, true);
  assert.equal(reveal('unlimited', 'one').correct, false);
  assert.equal(reveal('bounded', 'one').correct, true);
  assert.equal(reveal('bounded', 'future').correct, false);
  assert.equal(reveal('bounded', 'unsure').correct, false);
  assert.match(reveal('bounded', 'one').caveat, /not a completed swap/);
});
test('unknown share-link case safely defaults, bad choice is rejected', () => {
  assert.equal(chooseCase('unknown'), 'unlimited');
  assert.equal(reveal('unknown', 'future').correct, true);
  assert.equal(reveal('unknown', 'one').correct, false);
  assert.equal(reveal('unknown', 'future').scope, cases.unlimited.scope);
  assert.throws(() => reveal('unlimited', 'wallet'), RangeError);
});
