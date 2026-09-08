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
  if (!entry || typeof entry !== 'object') { errors.push(`${assertionId}: invalid registry entry`); continue; }
  if (!entry.owner || !entry.contract || !Array.isArray(entry.coverage) || !Array.isArray(entry.dependencies) || !entry.runtime_scope || !entry.rootCauseClass) errors.push(`${assertionId}: incomplete canonical metadata`);
  const prior = ownerToAssertion.get(entry.owner);
  if (prior && prior !== assertionId) errors.push(`OWNER_COLLISION: ${entry.owner} owns ${prior} and ${assertionId}`);
  ownerToAssertion.set(entry.owner, assertionId);
  for (const dependency of entry.dependencies) if (!registryAssertions.has(dependency)) errors.push(`${assertionId}: unknown dependency ${dependency}`);
}

const state = new Map([...registryAssertions.keys()].map((id) => [id, 0]));
const visit = (id, stack = []) => {
  if (state.get(id) === 1) { const start = stack.indexOf(id); errors.push(`DEPENDENCY_CYCLE: ${[...stack.slice(start), id].join(' -> ')}`); return; }
  if (state.get(id) === 2) return;
  state.set(id, 1);
  for (const dep of registryAssertions.get(id)?.dependencies ?? []) if (registryAssertions.has(dep)) visit(dep, [...stack, id]);
  state.set(id, 2);
};
for (const id of registryAssertions.keys()) visit(id);

for (const [gate, gatePlan] of Object.entries(plan.gates ?? {})) {
  for (const check of gatePlan.checks ?? []) {
    const assertions = check.assertions ?? [];
    if (assertions.length !== 1) errors.push(`${gate}/${check.id}: expected exactly one assertion owner, found ${assertions.length}`);
    for (const assertionId of assertions) {
      if (!registryAssertions.has(assertionId)) errors.push(`${gate}/${check.id}: assertion ${assertionId} missing from canonical registry`);
      const refs = referenced.get(assertionId) ?? [];
      refs.push(check.id); referenced.set(assertionId, refs);
      const entry = registryAssertions.get(assertionId);
      if (entry && entry.owner !== check.id) errors.push(`${assertionId}: registry owner ${entry.owner} != plan owner ${check.id}`);
      if (entry && JSON.stringify([...entry.coverage].sort()) !== JSON.stringify([...(check.coverage ?? [])].sort())) errors.push(`${assertionId}: coverage mismatch`);
    }
    executionOwners.set(check.id, check);
    if (check.command === 'npm' && check.args?.[0] === 'run' && !Object.hasOwn(packageJson.scripts ?? {}, check.args?.[1])) errors.push(`${gate}/${check.id}: missing npm script ${check.args?.[1] ?? '<missing>'}`);
    if (check.command === 'node') {
      const fileArg = [...(check.args ?? [])].reverse().find((arg) => typeof arg === 'string' && !arg.startsWith('-') && /\.(?:mjs|js|ts)$/.test(arg));
      if (fileArg && !fs.existsSync(path.resolve(fileArg))) errors.push(`${gate}/${check.id}: missing executable ${fileArg}`);
    }
  }
}

for (const assertionId of planAssertions.keys()) if (!registryAssertions.has(assertionId)) errors.push(`${assertionId}: declared in test-plan but missing from registry`);
for (const assertionId of registryAssertions.keys()) if ((referenced.get(assertionId) ?? []).length !== 1) errors.push(`${assertionId}: expected one execution owner reference`);

const executableSignatures = new Map();
for (const [owner, check] of executionOwners) {
  const signature = JSON.stringify([check.command, ...(check.args ?? [])]);
  const prior = executableSignatures.get(signature);
  if (prior && prior !== owner) errors.push(`EXECUTION_DUPLICATE: ${prior} and ${owner}`);
  executableSignatures.set(signature, owner);
}

const ci = read('.github/workflows/ci.yml');
const architectureChecks = [
  ['single canonical workflow', /name:\s*FLIXO Test System/.test(ci)],
  ['single static+build engine', /\n\s{2}verify:\s*\n/.test(ci)],
  ['FAST browser engine', /\n\s{2}browser_fast:\s*\n/.test(ci)],
  ['DEEP browser engine', /\n\s{2}browser_deep:\s*\n/.test(ci)],
  ['single certify gate', /\n\s{2}certify:\s*\n/.test(ci)],
  ['three browsers', /browser:\s*\[chromium, firefox, webkit\]/.test(ci)],
  ['22 FAST tool specs', (ci.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? []).length === 22],
  ['DEEP localization runtime', /tests\/localization-runtime\.spec\.ts/.test(ci)],
  ['immutable artifact', /flixo-head-sha\.txt/.test(ci) && /flixo-package-lock\.sha256/.test(ci)],
];
for (const [label, pass] of architectureChecks) if (!pass) errors.push(`ARCHITECTURE: ${label}`);

const result = {
  schema_version: 5,
  status: errors.length ? 'FAIL' : 'PASS',
  assertionCount: registryAssertions.size,
  testPlanAssertionCount: planAssertions.size,
  executionOwnerCount: executionOwners.size,
  architecture: { engines: ['static+build', 'browser-fast', 'browser-deep', 'certify'], browserFast: { tools: 22, browsers: 3, units: 66 }, browserDeep: { locales: 20, browsers: 3 } },
  architectureChecks: architectureChecks.map(([label, pass]) => ({ label, status: pass ? 'PASS' : 'FAIL' })),
  errors,
};
fs.mkdirSync('diagnostics/assertions', { recursive: true });
fs.writeFileSync('diagnostics/assertions/registry-result.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
