import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const plan = JSON.parse(read('scripts/ci/test-plan.json'));
const registry = JSON.parse(read('scripts/ci/assertion-registry.json'));
const planAssertions = new Map(Object.entries(plan.assertions ?? {}));
const registryAssertions = new Map(Object.entries(registry.assertions ?? {}));
const errors = [];
const ownerToAssertion = new Map();
const referenced = new Map();

for (const [assertionId, entry] of registryAssertions) {
  if (!entry || typeof entry !== 'object') {
    errors.push(`${assertionId}: invalid registry entry`);
    continue;
  }
  if (!entry.owner || !entry.contract || !Array.isArray(entry.coverage) || !Array.isArray(entry.dependencies) || !entry.runtime_scope || !entry.rootCauseClass) errors.push(`${assertionId}: incomplete canonical metadata`);
  const prior = ownerToAssertion.get(entry.owner);
  if (prior && prior !== assertionId) errors.push(`OWNER_COLLISION: ${entry.owner} owns ${prior} and ${assertionId}`);
  ownerToAssertion.set(entry.owner, assertionId);
  for (const dependency of entry.dependencies) if (!registryAssertions.has(dependency)) errors.push(`${assertionId}: unknown dependency ${dependency}`);
}

for (const [gate, gatePlan] of Object.entries(plan.gates ?? {})) {
  for (const check of gatePlan.checks ?? []) {
    for (const assertionId of check.assertions ?? []) {
      if (!registryAssertions.has(assertionId)) errors.push(`${gate}/${check.id}: assertion ${assertionId} missing from canonical registry`);
      const refs = referenced.get(assertionId) ?? [];
      refs.push(check.id);
      referenced.set(assertionId, refs);
      const registryEntry = registryAssertions.get(assertionId);
      if (registryEntry && registryEntry.owner !== check.id) errors.push(`${assertionId}: registry owner ${registryEntry.owner} != plan owner ${check.id}`);
      if (registryEntry && JSON.stringify(registryEntry.coverage.slice().sort()) !== JSON.stringify((check.coverage ?? []).slice().sort())) errors.push(`${assertionId}: coverage mismatch between registry and test-plan`);
    }
  }
}

for (const [assertionId, planEntry] of planAssertions) {
  if (!registryAssertions.has(assertionId)) errors.push(`${assertionId}: declared in test-plan but missing from canonical registry`);
  if (planEntry?.owner && ownerToAssertion.get(planEntry.owner) && ownerToAssertion.get(planEntry.owner) !== assertionId) errors.push(`${assertionId}: owner collision with ${ownerToAssertion.get(planEntry.owner)}`);
}
for (const assertionId of registryAssertions.keys()) {
  const refs = referenced.get(assertionId) ?? [];
  if (refs.length !== 1) errors.push(`${assertionId}: expected exactly one execution owner reference, found ${refs.length}`);
}

const ci = read('.github/workflows/ci.yml');
const matrix = read('.github/workflows/matrix-first.yml');
const fullMatrix = read('.github/workflows/full-matrix-parallel.yml');
const architectureChecks = [
  ['ci has no Matrix First execution barrier', !/matrix-first-barrier|needs:\s*\[[^\]]*matrix-first-barrier/i.test(ci)],
  ['ci has no browser execution inside fast verify', !/playwright\s+test|tests\/.*\.spec\.(?:ts|js)/i.test(read('scripts/ci/fast-verify.mjs'))],
  ['Matrix First owns three browsers', /browser:\s*\[chromium, firefox, webkit\]/.test(matrix)],
  ['Matrix First retains 22 tool specs', (matrix.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []).length === 22],
  ['Full Matrix owns three browsers', /browser:\s*\[chromium, firefox, webkit\]/.test(fullMatrix)],
  ['Full Matrix remains deep-only push/manual', /on:\s*\n\s+push:\s*\n\s+branches:\s*\[main\]\s*\n\s+workflow_dispatch:/s.test(fullMatrix)],
  ['Matrix First uses canonical local test origin', /VITE_TEST_ORIGIN:\s*http:\/\/127\.0\.0\.1:3000/.test(matrix)],
  ['Full Matrix uses canonical local test origin', /VITE_TEST_ORIGIN:\s*http:\/\/127\.0\.0\.1:3000/.test(fullMatrix)],
  ['Ultra is orchestrator-only', /role:\s*'ORCHESTRATOR_ONLY'/.test(read('scripts/ci/ultra-fast.mjs'))],
];
for (const [label, pass] of architectureChecks) if (!pass) errors.push(`ARCHITECTURE: ${label}`);

const result = {
  schema_version: 2,
  status: errors.length ? 'FAIL' : 'PASS',
  assertionCount: registryAssertions.size,
  testPlanAssertionCount: planAssertions.size,
  ownershipRule: registry.ownershipRule,
  architectureChecks: architectureChecks.map(([label, pass]) => ({ label, status: pass ? 'PASS' : 'FAIL' })),
  errors,
};
fs.mkdirSync('diagnostics/assertions', { recursive: true });
fs.writeFileSync('diagnostics/assertions/registry-result.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
