import { cases, chooseCase, reveal, comparePermissions } from './logic.js';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
let selected = chooseCase(params.get('case'));

function text(selector, value) { $(selector).textContent = value; }
function hideComparison() {
  $('#comparison').hidden = true;
  $('#open-comparison').setAttribute('aria-expanded', 'false');
}
function render() {
  const c = cases[selected];
  text('#case-title', c.title);
  text('#action', c.action);
  text('#button-label', c.button);
  $('#result').hidden = true;
  $('#choices').hidden = false;
  hideComparison();
  document.querySelectorAll('[data-case]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.case === selected));
  });
}
function copyButton(label, getUrl) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getUrl());
      button.textContent = 'Copied ✓';
    } catch {
      button.textContent = 'Copy unavailable. Use address bar.';
    }
  });
  return button;
}
function showComparison(updateUrl = true, moveFocus = true) {
  const cards = $('#comparison-cards');
  cards.replaceChildren();
  for (const permission of comparePermissions()) {
    const card = document.createElement('article');
    const title = document.createElement('h3');
    title.textContent = permission.title;
    const details = document.createElement('dl');
    for (const row of permission.rows) {
      const term = document.createElement('dt');
      term.textContent = row.label;
      const value = document.createElement('dd');
      value.textContent = row.value;
      if (row.different) value.className = 'scope-difference';
      details.append(term, value);
    }
    card.append(title, details);
    cards.append(card);
  }
  const actions = $('#comparison-actions');
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'plain';
  reset.textContent = 'Back to a fresh prediction';
  reset.addEventListener('click', () => {
    history.replaceState(null, '', '?case=' + selected);
    render();
    $('#open-comparison').focus();
  });
  actions.replaceChildren(copyButton('Copy comparison link ↗', () => {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('view', 'compare');
    url.hash = 'comparison';
    return url.href;
  }), reset);
  $('#comparison').hidden = false;
  $('#open-comparison').setAttribute('aria-expanded', 'true');
  if (updateUrl) history.replaceState(null, '', '?view=compare#comparison');
  if (moveFocus) $('#comparison-title').focus();
}
function answer(choice, updateUrl = true, moveFocus = true) {
  const r = reveal(selected, choice);
  $('#choices').hidden = true;
  const box = $('#result');
  box.replaceChildren();
  const title = document.createElement('h3');
  title.tabIndex = -1;
  title.textContent = r.correct ? 'Correct guess. Still check the request.' : choice === 'unsure' ? 'Good instinct. Inspect the request.' : 'Surprise. Read the permission.';
  const fact = document.createElement('p');
  const factLabel = document.createElement('strong');
  factLabel.textContent = 'What the button implies: ';
  fact.append(factLabel, document.createTextNode(r.expectation));
  const actual = document.createElement('p');
  const actualLabel = document.createElement('strong');
  actualLabel.textContent = 'What this fixture requests: ';
  actual.append(actualLabel, document.createTextNode(r.scope));
  const why = document.createElement('p');
  why.textContent = r.note + ' ' + r.aftermath;
  const caution = document.createElement('p');
  caution.className = 'caution';
  caution.textContent = 'The button alone cannot tell you the allowance. ' + r.safety + ' ' + r.caveat;
  const badge = document.createElement('div');
  badge.className = 'verdict';
  badge.textContent = r.gap;
  const share = copyButton('Copy result link ↗', () => {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('case', selected);
    url.searchParams.set('answer', choice);
    return url.href;
  });
  const compare = document.createElement('button');
  compare.type = 'button';
  compare.textContent = 'Compare both permissions';
  compare.addEventListener('click', () => showComparison());
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'plain';
  retry.textContent = 'Try another prediction';
  retry.addEventListener('click', () => {
    history.replaceState(null, '', '?case=' + selected);
    render();
    $('[data-choice="future"]').focus();
  });
  box.append(title, badge, fact, actual, why, caution, share, compare, retry);
  box.hidden = false;
  if (updateUrl) history.replaceState(null, '', '?case=' + selected + '&answer=' + choice);
  if (moveFocus) title.focus();
}

document.querySelectorAll('[data-case]').forEach(button => button.addEventListener('click', () => {
  selected = button.dataset.case;
  history.replaceState(null, '', '?case=' + selected);
  render();
}));
document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => answer(button.dataset.choice)));
$('#open-comparison').addEventListener('click', () => showComparison());
render();
if (params.get('view') === 'compare') showComparison(false, false);
else if (['one', 'future', 'unsure'].includes(params.get('answer'))) answer(params.get('answer'), false, false);
