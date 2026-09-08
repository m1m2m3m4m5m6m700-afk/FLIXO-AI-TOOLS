import fs from 'node:fs';

const plan = JSON.parse(fs.readFileSync('scripts/ci/test-plan.json', 'utf8'));
const registry = JSON.parse(fs.readFileSync('scripts/ci/assertion-registry.json', 'utf8'));

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
  if (!entry.owner || !entry.contract || !Array.isArray(entry.coverage) || !Array.isArray(entry.dependencies) || !entry.runtime_scope || !entry.rootCauseClass) {
    errors.push(`${assertionId}: incomplete canonical metadata`);
  }
  if (registryAssertions.has(assertionId)) {
    const prior = ownerToAssertion.get(entry.owner);
    if (prior && prior !== assertionId) errors.push(`OWNER_COLLISION: ${entry.owner} owns ${prior} and ${assertionId}`);
    ownerToAssertion.set(entry.owner, assertionId);
  }
  for (const dependency of entry.dependencies) {
    if (!registryAssertions.has(dependency)) errors.push(`${assertionId}: unknown dependency ${dependency}`);
  }
}

for (const [gate, gatePlan] of Object.entries(plan.gates ?? {})) {
  for (const check of gatePlan.checks ?? []) {
    const assertions = check.assertions ?? [];
    for (const assertionId of assertions) {
      if (!registryAssertions.has(assertionId)) errors.push(`${gate}/${check.id}: assertion ${assertionId} missing from canonical registry`);
      const refs = referenced.get(assertionId) ?? [];
      refs.push(check.id);
      referenced.set(assertionId, refs);
      const registryEntry = registryAssertions.get(assertionId);
      if (registryEntry && registryEntry.owner !== check.id) errors.push(`${assertionId}: registry owner ${registryEntry.owner} != plan owner ${check.id}`);
      if (registryEntry && JSON.stringify(registryEntry.coverage.slice().sort()) !== JSON.stringify((check.coverage ?? []).slice().sort())) {
        errors.push(`${assertionId}: coverage mismatch between registry and test-plan`);
      }
    }
  }
}

for (const [assertionId, planEntry] of planAssertions) {
  if (!registryAssertions.has(assertionId)) errors.push(`${assertionId}: declared in test-plan but missing from canonical registry`);
  if (planEntry?.owner && ownerToAssertion.get(planEntry.owner) && ownerToAssertion.get(planEntry.owner) !== assertionId) {
    errors.push(`${assertionId}: owner collision with ${ownerToAssertion.get(planEntry.owner)}`);
  }
}

for (const assertionId of registryAssertions.keys()) {
  const refs = referenced.get(assertionId) ?? [];
  if (refs.length !== 1) errors.push(`${assertionId}: expected exactly one execution owner reference, found ${refs.length}`);
}

const duplicateOwners = [...ownerToAssertion.entries()].filter(([owner, assertionId]) => {
  return [...registryAssertions.entries()].some(([otherId, other]) => other.owner === owner && otherId !== assertionId);
});
if (duplicateOwners.length) errors.push(`duplicate owners: ${duplicateOwners.map(([owner]) => owner).join(', ')}`);

const result = {
  schema_version: 1,
  status: errors.length ? 'FAIL' : 'PASS',
  assertionCount: registryAssertions.size,
  testPlanAssertionCount: planAssertions.size,
  ownershipRule: registry.ownershipRule,
  errors,
};

fs.mkdirSync('diagnostics/assertions', { recursive: true });
fs.writeFileSync('diagnostics/assertions/registry-result.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
