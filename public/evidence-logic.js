const outputs = ['approvalIsSwap', 'fixtureSchema', 'method', 'observedAt', 'payloadDigest', 'scopeExceedsButton', 'specimenCaseObserved', 'verdict'];
const hex40 = /^[a-f0-9]{40}$/;
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}
export function validateEvidence(data) {
  const fail = () => { throw new Error('The published observation file is unavailable or invalid. No result has been substituted.'); };
  if (!exactKeys(data, ['schema', 'workflow', 'testedWorkspaceRevision', 'publicSourceRevision', 'provenance', 'redaction', 'observations']) ||
      data.schema !== 'consent-gap/owner-observations-v1' || data.workflow !== 'consent-observation' ||
      typeof data.testedWorkspaceRevision !== 'string' || !hex40.test(data.testedWorkspaceRevision) ||
      typeof data.publicSourceRevision !== 'string' || !hex40.test(data.publicSourceRevision) ||
      typeof data.provenance !== 'string' || !data.provenance.trim() || typeof data.redaction !== 'string' || !data.redaction.trim() ||
      !Array.isArray(data.observations) || data.observations.length !== 2) fail();
  const seen = new Set();
  for (const observation of data.observations) {
    if (!exactKeys(observation, ['input', 'outputs']) || !exactKeys(observation.input, ['specimenCase']) || !exactKeys(observation.outputs, outputs)) fail();
    const id = observation.input.specimenCase;
    const o = observation.outputs;
    if (!['unlimited', 'bounded'].includes(id) || seen.has(id) || o.specimenCaseObserved !== id ||
        o.fixtureSchema !== 'consent-gap/v1' || o.method !== 'HTTP JSON fixture observation, not browser automation' ||
        o.approvalIsSwap !== false || o.scopeExceedsButton !== (id === 'unlimited') ||
        o.verdict !== (id === 'unlimited' ? 'Button != permission' : 'Approval != swap') ||
        typeof o.payloadDigest !== 'string' || !/^[a-f0-9]{64}$/.test(o.payloadDigest) ||
        typeof o.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(o.observedAt) ||
        !Number.isFinite(Date.parse(o.observedAt)) || new Date(o.observedAt).toISOString() !== o.observedAt) fail();
    seen.add(id);
  }
  return data;
}
export async function fixtureDigest(fixture) {
  const bytes = new TextEncoder().encode(JSON.stringify(fixture));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function compareFixture(fixture, observedDigest) {
  const digest = await fixtureDigest(fixture);
  return { digest, matches: digest === observedDigest };
}
