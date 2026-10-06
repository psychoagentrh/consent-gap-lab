import { specimen } from './logic.js';
import { validateEvidence, compareFixture } from './evidence-logic.js';
const $ = selector => document.querySelector(selector);
let evidence;
const queryCase = new URL(location.href).searchParams.get('case');
let selected = ['unlimited', 'bounded'].includes(queryCase) ? queryCase : 'unlimited';
let generation = 0;
function choose(id) {
  selected = id;
  const current = ++generation;
  const observation = evidence.observations.find(item => item.input.specimenCase === id);
  const o = observation.outputs;
  document.querySelectorAll('[data-observation]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.observation === id)));
  $('#observation-title').textContent = id === 'unlimited' ? 'A / Unlimited permission' : 'B / Bounded permission';
  $('#observation-link').href = '/evidence.html?case=' + id;
  history.replaceState(null, '', '/evidence.html?case=' + id);
  $('#observed-at').textContent = o.observedAt;
  $('#observed-at').dateTime = o.observedAt;
  $('#scope').textContent = o.scopeExceedsButton ? 'Yes. Unlimited allowance.' : 'No. Exactly 20 TEST in this fixture.';
  $('#verdict').textContent = o.verdict;
  $('#method').textContent = o.method;
  $('#fixture-schema').textContent = o.fixtureSchema;
  $('#observed-digest').textContent = o.payloadDigest;
  $('#current-digest').textContent = 'Calculating locally…';
  $('#digest-status').className = '';
  $('#digest-status').textContent = 'Comparing the local fixture with the historical digest…';
  $('#observation').hidden = false;
  compareFixture(specimen(id), o.payloadDigest).then(result => {
    if (current !== generation) return;
    $('#current-digest').textContent = result.digest;
    $('#digest-status').className = result.matches ? 'match' : 'mismatch';
    $('#digest-status').textContent = result.matches ? 'Match. This fixture has the published payload digest.' : 'Different bytes. This release’s fixture does not match the historical observation. Do not treat that run as a test of these bytes.';
  }).catch(() => {
    if (current !== generation) return;
    $('#current-digest').textContent = 'Unavailable';
    $('#digest-status').className = 'mismatch';
    $('#digest-status').textContent = 'Local hashing unavailable. The historical output is shown, but no fixture match has been established.';
  });
}
async function load() {
  generation++;
  evidence = undefined;
  $('#observation').hidden = true;
  $('#provenance').hidden = true;
  $('#retry').hidden = true;
  $('#load-status').textContent = 'Loading the published observations…';
  document.querySelectorAll('[data-observation]').forEach(button => { button.disabled = true; });
  try {
    const response = await fetch('/owner-observations.json', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Unavailable');
    evidence = validateEvidence(await response.json());
    $('#tested-revision').textContent = evidence.testedWorkspaceRevision;
    $('#source-revision').textContent = evidence.publicSourceRevision;
    $('#source-link').href = `https://github.com/psychoagentrh/consent-gap-lab/blob/${evidence.publicSourceRevision}/uipath/ConsentGapSolution/ConsentGap/Psycho_ConsentGap.flow`;
    $('#provenance-note').textContent = evidence.provenance;
    $('#redaction-note').textContent = evidence.redaction;
    $('#provenance').hidden = false;
    $('#load-status').textContent = '';
    document.querySelectorAll('[data-observation]').forEach(button => { button.disabled = false; });
    choose(selected);
  } catch {
    $('#load-status').textContent = 'The published observation file is unavailable or invalid. No result has been substituted. You can retry or explore the synthetic comparison.';
    $('#retry').hidden = false;
  }
}
document.querySelectorAll('[data-observation]').forEach(button => button.addEventListener('click', () => choose(button.dataset.observation)));
$('#retry').addEventListener('click', load);
load();
