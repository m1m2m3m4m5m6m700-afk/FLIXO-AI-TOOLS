import fs from 'node:fs';
import path from 'node:path';

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const plan = JSON.parse(read('scripts/ci/test-plan.json'));
const registry = JSON.parse(read('scripts/ci/assertion-registry.json'));
const packageJson = JSON.parse(read('package.json'));
const planAssertions = new Map(Object.entries(plan.assertions ?? {}));
const registryAssertions = new Map(Object.entries(registry.assertions ?? {}));
const errors = [];
const ownerToAssertion = new Map();
const referenced = new Map();
const executionOwners = new Map();

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

const visitState = new Map([...registryAssertions.keys()].map((id) => [id, 0]));
const visit = (id, stack = []) => {
  const state = visitState.get(id);
  if (state === 1) {
    const start = stack.indexOf(id);
    errors.push(`DEPENDENCY_CYCLE: ${[...stack.slice(start), id].join(' -> ')}`);
    return;
  }
  if (state === 2) return;
  visitState.set(id, 1);
  for (const dependency of registryAssertions.get(id)?.dependencies ?? []) {
    if (registryAssertions.has(dependency)) visit(dependency, [...stack, id]);
  }
  visitState.set(id, 2);
};
for (const id of registryAssertions.keys()) visit(id);

for (const [gate, gatePlan] of Object.entries(plan.gates ?? {})) {
  for (const check of gatePlan.checks ?? []) {
    const assertions = check.assertions ?? [];
    if (assertions.length !== 1) errors.push(`${gate}/${check.id}: expected exactly one assertion owner, found ${assertions.length}`);
    for (const assertionId of assertions) {
      if (!registryAssertions.has(assertionId)) errors.push(`${gate}/${check.id}: assertion ${assertionId} missing from canonical registry`);
      const refs = referenced.get(assertionId) ?? [];
      refs.push(check.id);
      referenced.set(assertionId, refs);
      const registryEntry = registryAssertions.get(assertionId);
      if (registryEntry && registryEntry.owner !== check.id) errors.push(`${assertionId}: registry owner ${registryEntry.owner} != plan owner ${check.id}`);
      if (registryEntry && JSON.stringify(registryEntry.coverage.slice().sort()) !== JSON.stringify((check.coverage ?? []).slice().sort())) errors.push(`${assertionId}: coverage mismatch between registry and test-plan`);
    }
    executionOwners.set(check.id, check);
    if (check.command === 'npm' && check.args?.[0] === 'run') {
      const script = check.args?.[1];
      if (!script || !Object.hasOwn(packageJson.scripts ?? {}, script)) errors.push(`${gate}/${check.id}: missing npm script ${script ?? '<missing>'}`);
    }
    if (check.command === 'node') {
      const fileArg = [...(check.args ?? [])].reverse().find((arg) => typeof arg === 'string' && !arg.startsWith('-') && arg.endsWith(('.mjs', '.js', '.ts')));
      if (fileArg && !fs.existsSync(path.resolve(fileArg))) errors.push(`${gate}/${check.id}: executable path does not exist: ${fileArg}`);
    }
  }
}

for (const [assertionId] of planAssertions) {
  if (!registryAssertions.has(assertionId)) errors.push(`${assertionId}: declared in test-plan but missing from canonical registry`);
}
for (const assertionId of registryAssertions.keys()) {
  const refs = referenced.get(assertionId) ?? [];
  if (refs.length !== 1) errors.push(`${assertionId}: expected exactly one execution owner reference, found ${refs.length}`);
}

const executableSignatures = new Map();
for (const [owner, check] of executionOwners) {
  const signature = JSON.stringify([check.command, ...(check.args ?? [])]);
  const prior = executableSignatures.get(signature);
  if (prior && prior !== owner) errors.push(`EXECUTION_DUPLICATE: ${prior} and ${owner} execute identical command signatures`);
  executableSignatures.set(signature, owner);
}

const ci = read('.github/workflows/ci.yml');
const fastVerify = read('scripts/ci/fast-verify.mjs');
const architectureChecks = [
  ['single automatic workflow owns canonical testing', /name:\s*FLIXO Test System/.test(ci)],
  ['ci exposes the static engine', /\n\s+static:\s*\n/.test(ci)],
  ['ci exposes the build engine', /\n\s+build:\s*\n/.test(ci)],
  ['ci exposes the FAST browser engine', /\n\s+browser-fast:\s*\n/.test(ci)],
  ['ci exposes the DEEP browser engine', /\n\s+browser-deep:\s*\n/.test(ci)],
  ['FAST browser coverage retains three browsers', /browser:\s*\[chromium, firefox, webkit\]/.test(ci)],
  ['FAST browser coverage retains 22 canonical tools', (ci.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []).length === 22],
  ['DEEP browser coverage retains 20-locale runtime owner', /tests\/localization-runtime\.spec\.ts/.test(ci)],
  ['DEEP browser coverage retains three browsers', (ci.match(/browser:\s*\[chromium, firefox, webkit\]/g) ?? []).length >= 2],
  ['DEEP execution is release/main only', /browser-deep:[\s\S]{0,500}?github\.event_name\s*!==\s*'pull_request'/.test(ci)],
  ['build artifact is fingerprinted', /flixo-head-sha\.txt/.test(ci) && /flixo-package-lock\.sha256/.test(ci)],
  ['Browser consumes build artifact', /download-artifact@v6[\s\S]{0,300}?flixo-build-/.test(ci)],
  ['Fast Verify does not execute browser tests', !/playwright\s+test|tests\/.*\.spec\.(?:ts|js)/i.test(fastVerify)],
  ['Ultra is orchestrator-only', /role:\s*'ORCHESTRATOR_ONLY'/.test(read('scripts/ci/ultra-fast.mjs'))],
];
for (const [label, pass] of architectureChecks) if (!pass) errors.push(`ARCHITECTURE: ${label}`);

const result = {
  schema_version: 4,
  status: errors.length ? 'FAIL' : 'PASS',
  assertionCount: registryAssertions.size,
  testPlanAssertionCount: planAssertions.size,
  executionOwnerCount: executionOwners.size,
  ownershipRule: registry.ownershipRule,
  architecture: {
    engines: ['static', 'build', 'browser-fast', 'browser-deep', 'certify'],
    browserFast: { tools: 22, browsers: 3, units: 66 },
    browserDeep: { locales: 20, browsers: 3 },
    certification: 'single certify job, fail-closed',
  },
  architectureChecks: architectureChecks.map(([label, pass]) => ({ label, status: pass ? 'PASS' : 'FAIL' })),
  errors,
};
fs.mkdirSync('diagnostics/assertions', { recursive: true });
fs.writeFileSync('diagnostics/assertions/registry-result.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
