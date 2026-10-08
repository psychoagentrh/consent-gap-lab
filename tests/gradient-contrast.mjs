import assert from 'node:assert/strict';

// WCAG relative luminance: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
// This supports only our single-color-to-transparent hero gradient over an opaque
// root. Premultiplied alpha keeps the visible gradient color constant while fading.
// Each composited sRGB channel therefore stays between the root and opaque stop.
// Luminance is monotone in each channel; the nearest luminance bound gives a
// conservative contrast floor, independent of text position or gradient geometry.
export function parseColor(value) {
  const match = /^rgba?\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)(?:, (\d+(?:\.\d+)?))?\)$/.exec(value);
  assert.ok(match, `Unsupported computed color: ${value}`);
  const channels = match.slice(1, 4).map(Number);
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  assert.ok(channels.every(channel => channel >= 0 && channel <= 255) && alpha >= 0 && alpha <= 1, 'Color outside supported range');
  return { channels, alpha };
}
export function luminance(channels) {
  assert.ok(channels.length === 3 && channels.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 255), 'Invalid RGB channels');
  const linear = channels.map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
export function contrastFloor(foreground, backdrop, stop) {
  const minimum = backdrop.map((channel, index) => Math.min(channel, stop[index]));
  const maximum = backdrop.map((channel, index) => Math.max(channel, stop[index]));
  const low = luminance(minimum);
  const high = luminance(maximum);
  const text = luminance(foreground);
  // If text luminance falls inside the background interval, no contrast floor
  // above 1 can be guaranteed. Do not pretend sampled endpoints prove a pass.
  const ratio = text > high ? (text + 0.05) / (high + 0.05)
    : text < low ? (low + 0.05) / (text + 0.05) : 1;
  return { ratio, backgroundMinimum: minimum, backgroundMaximum: maximum };
}
export function gradeHeroText(snapshot) {
  const foreground = parseColor(snapshot.color);
  assert.equal(foreground.alpha, 1, 'Translucent text needs a different contrast model');
  const root = snapshot.chain.at(-1);
  assert.ok(root?.isRoot, 'Missing opaque root backdrop');
  const backdrop = parseColor(root.backgroundColor);
  assert.equal(backdrop.alpha, 1, 'Root backdrop must be opaque');
  let stop;
  for (const node of snapshot.chain) {
    assert.equal(node.opacity, '1', 'Opacity needs a different contrast model');
    for (const key of ['filter', 'backdropFilter', 'textShadow']) assert.equal(node[key], 'none', `Unsupported ${key}`);
    for (const key of ['mixBlendMode', 'backgroundBlendMode']) assert.equal(node[key], 'normal', `Unsupported ${key}`);
    assert.equal(node.stroke, '0px', 'Text stroke needs a different contrast model');
    if (!node.isRoot) assert.equal(parseColor(node.backgroundColor).alpha, 0, 'Unexpected text backdrop');
    if (node.isIntro) {
      assert.equal(stop, undefined, 'Multiple hero gradients');
      const match = /^radial-gradient\(circle at 90% 0px, (rgba?\([^)]+\)) 0px, (rgba?\([^)]+\)) 36%\)$/.exec(node.backgroundImage);
      assert.ok(match, `Unsupported hero gradient: ${node.backgroundImage}`);
      stop = parseColor(match[1]);
      assert.equal(stop.alpha, 1, 'First gradient stop must be opaque');
      assert.equal(parseColor(match[2]).alpha, 0, 'Second gradient stop must be transparent');
    } else {
      assert.equal(node.backgroundImage, 'none', 'Unexpected background image');
    }
  }
  assert.ok(stop, 'Missing supported hero gradient');
  const bound = contrastFloor(foreground.channels, backdrop.channels, stop.channels);
  // Keep full precision for acceptance. All text, even large headings, uses 4.5:1.
  return { target: snapshot.target, foreground: foreground.channels, ...bound, required: 4.5, pass: bound.ratio >= 4.5 };
}
export async function reviewHeroGradient(page) {
  const snapshots = await page.locator('.intro').evaluateAll(intros => intros.flatMap(intro => [intro, ...intro.querySelectorAll('*')]
    .filter(element => [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0)
    .map(element => {
      const chain = [];
      for (let node = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        chain.push({ isRoot: node === document.documentElement, isIntro: node === intro,
          backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage,
          opacity: style.opacity, filter: style.filter, backdropFilter: style.backdropFilter,
          mixBlendMode: style.mixBlendMode, backgroundBlendMode: style.backgroundBlendMode,
          textShadow: style.textShadow, stroke: style.webkitTextStrokeWidth });
      }
      return { target: `${element.tagName.toLowerCase()}${element.className ? '.' + element.className.trim().split(/\s+/).join('.') : ''}`,
        color: getComputedStyle(element).color, chain };
    })));
  return snapshots.map(snapshot => {
    const grade = gradeHeroText(snapshot);
    assert.ok(grade.pass, `Contrast below 4.5:1 at ${grade.target}: ${grade.ratio}`);
    return grade;
  });
}
