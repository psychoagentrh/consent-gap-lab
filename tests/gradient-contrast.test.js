import assert from 'node:assert/strict';
import test from 'node:test';
import { parseColor, luminance, contrastFloor, gradeHeroText } from './gradient-contrast.mjs';

const backdrop = [18, 26, 25];
const stop = [51, 75, 57];
function snapshot() {
  const common = { opacity: '1', filter: 'none', backdropFilter: 'none', textShadow: 'none',
    mixBlendMode: 'normal', backgroundBlendMode: 'normal', stroke: '0px',
    backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none' };
  return { target: 'p.dek', color: 'rgb(192, 200, 183)', chain: [
    { ...common },
    { ...common, isIntro: true, backgroundImage: 'radial-gradient(circle at 90% 0px, rgb(51, 75, 57) 0px, rgba(0, 0, 0, 0) 36%)' },
    { ...common, isRoot: true, backgroundColor: 'rgb(18, 26, 25)' }
  ] };
}

test('luminance endpoints and 21:1 reference contrast', () => {
  assert.equal(luminance([0, 0, 0]), 0);
  assert.equal(luminance([255, 255, 255]), 1);
  assert.equal(contrastFloor([255, 255, 255], [0, 0, 0], [0, 0, 0]).ratio, 21);
});
test('sRGB transfer function uses the linear branch for low channels', () => {
  assert.ok(Math.abs(luminance([10, 10, 10]) - 10 / 255 / 12.92) < 1e-12);
  assert.ok(luminance([11, 11, 11]) > luminance([10, 10, 10]));
});
test('current muted hero text passes the strict 4.5:1 floor', () => {
  const grade = gradeHeroText(snapshot());
  assert.ok(grade.pass);
  assert.deepEqual(grade.backgroundMinimum, backdrop);
  assert.deepEqual(grade.backgroundMaximum, stop);
  assert.ok(grade.ratio >= 4.5);
});
test('foreground matching a gradient stop cannot pass', () => {
  const value = snapshot();
  value.color = 'rgb(51, 75, 57)';
  assert.equal(gradeHeroText(value).ratio, 1);
  assert.equal(gradeHeroText(value).pass, false);
});
test('foreground luminance inside the gradient bounds has a floor of 1', () => {
  assert.equal(contrastFloor([35, 40, 38], backdrop, stop).ratio, 1);
});
test('dark text is bounded against the darker end of a light gradient', () => {
  assert.equal(contrastFloor([0, 0, 0], [255, 255, 255], [220, 220, 220]).ratio,
    (luminance([220, 220, 220]) + 0.05) / 0.05);
});
test('all sampled fade positions stay above the conservative bound', () => {
  // Also test a stop whose channels cross the backdrop; independent per-channel
  // extrema are conservative even when no actual pixel reaches those extrema.
  for (const otherStop of [stop, [10, 80, 20]]) {
    const foreground = [192, 200, 183];
    const floor = contrastFloor(foreground, backdrop, otherStop).ratio;
    for (let step = 0; step <= 100; step++) {
      const alpha = step / 100;
      const pixel = backdrop.map((channel, index) => channel * (1 - alpha) + otherStop[index] * alpha);
      const ratio = (luminance(foreground) + 0.05) / (luminance(pixel) + 0.05);
      assert.ok(ratio >= floor - 1e-12);
    }
  }
});
test('unsupported color spaces and out-of-range colors fail closed', () => {
  for (const color of ['color(display-p3 1 1 1)', '#ffffff', 'rgb(256, 0, 0)', 'rgba(0, 0, 0, 2)']) {
    assert.throws(() => parseColor(color));
  }
});
test('new gradient structure or opaque end stop cannot silently pass', () => {
  for (const gradient of [
    'radial-gradient(circle, rgb(51, 75, 57), rgb(18, 26, 25))',
    'radial-gradient(circle at 90% 0px, rgb(51, 75, 57) 0px, rgb(0, 0, 0) 36%)'
  ]) {
    const value = snapshot();
    value.chain[1].backgroundImage = gradient;
    assert.throws(() => gradeHeroText(value));
  }
});
test('effects, translucent text, extra backdrops and missing roots fail closed', () => {
  const mutations = [
    value => { value.color = 'rgba(192, 200, 183, 0.5)'; },
    value => { value.chain[0].opacity = '0.5'; },
    value => { value.chain[0].filter = 'blur(1px)'; },
    value => { value.chain[0].textShadow = 'rgb(0, 0, 0) 1px 1px'; },
    value => { value.chain[0].mixBlendMode = 'multiply'; },
    value => { value.chain[0].backgroundColor = 'rgb(0, 0, 0)'; },
    value => { value.chain[0].backgroundImage = 'url(example.png)'; },
    value => { value.chain.at(-1).backgroundColor = 'rgba(18, 26, 25, 0.5)'; },
    value => { value.chain.pop(); }
  ];
  for (const mutate of mutations) {
    const value = snapshot();
    mutate(value);
    assert.throws(() => gradeHeroText(value));
  }
});
