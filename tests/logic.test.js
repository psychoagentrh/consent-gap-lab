import test from 'node:test';
import assert from 'node:assert/strict';
import { cases, chooseCase, reveal, comparePermissions, specimen } from '../public/logic.js';

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

test('local comparison uses both specimen permissions and distinguishes amount from swap execution', () => {
  const comparison = comparePermissions();
  assert.deepEqual(comparison.map(c => c.id), ['unlimited', 'bounded']);
  for (const card of comparison) {
    assert.equal(card.rows.length, 5);
    assert.equal(card.rows[0].value, specimen(card.id).button);
    assert.equal(card.rows[2].value, cases[card.id].scope);
    assert.equal(card.rows[2].different, true);
    assert.equal(card.rows[4].value, 'No. Approval is a separate permission.');
    assert.equal(card.rows[4].different, false);
  }
  assert.match(comparison[0].rows[3].value, /^Yes/);
  assert.match(comparison[1].rows[3].value, /caps spending at 20 TEST/);
  comparison[0].rows[0].value = 'tampered by caller';
  assert.equal(comparePermissions()[0].rows[0].value, specimen('unlimited').button);
});
