#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { EXECUTION_STATES, isEvidenceFailure } from './result-state.mjs';

const root = process.cwd();
const manifestPath = process.env.CERTIFICATION_MANIFEST || 'certification-run-manifest.json';
const expectedSha = process.env.CERTIFICATION_SHA;
const expectedRunId = process.env.GITHUB_RUN_ID;
const contractVersion = 'MASTER AUTONOMOUS RECOVERY & EXECUTION CONTRACT v5';
if (!expectedSha) throw new Error('CERTIFICATION_SHA is required');
if (!expectedRunId) throw new Error('GITHUB_RUN_ID is required');
if (!fs.existsSync(manifestPath)) throw new Error(`Missing certification manifest: ${manifestPath}`);

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const identity = {
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workflowSha256: sha256('.github/workflows/ci.yml'),
  testPlanSha256: sha256('scripts/ci/test-plan.json'),
  assertionRegistrySha256: sha256('scripts/ci/assertion-registry.json'),
  packageLockSha256: sha256('package-lock.json'),
  runtime: { node: process.version, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim() },
  contractVersion,
  workflowName: process.env.GITHUB_WORKFLOW ?? null,
  eventName: process.env.GITHUB_EVENT_NAME ?? null,
};

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];
const unknowns = [];
const invalidEvidence = [];
const shaMismatches = [];
const unauthorizedSkips = [];
const duplicatePrimaryEvidence = [];
const provenanceStates = [];
const independentRootCauses = new Set();

const addState = (subject, state, detail = null) => {
  if (!EXECUTION_STATES.includes(state)) throw new Error(`Invalid provenance state: ${state}`);
  provenanceStates.push({ subject, state, ...(detail ? { detail } : {}) });
};
const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
};
const evidenceRoot = path.join(root, 'evidence');
const files = walk(evidenceRoot);
const jsonFiles = files.filter((file) => file.endsWith('.json'));
const parsed = new Map();
for (const file of jsonFiles) {
  const location = path.relative(root, file);
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    parsed.set(file, value);
    addState(`evidence:${location}`, 'PASS');
    if (value.evidenceClass === 'PRIMARY_EXECUTION') {
      if (!value.runId || !value.exactSha || !value.executionUnitCount || !Array.isArray(value.units)) invalidEvidence.push(`${location}: incomplete primary execution evidence`);
      if (value.runId !== expectedRunId) shaMismatches.push(`${location}.runId=${value.runId}`);
      if (value.exactSha !== expectedSha) shaMismatches.push(`${location}.exactSha=${value.exactSha}`);
      if (Array.isArray(value.rootCauses)) for (const rc of value.rootCauses) if (rc) independentRootCauses.add(String(rc));
    }
    if (Array.isArray(value.skipped) && value.skipped.length) unauthorizedSkips.push(`${location}.skipped`);
    if (Array.isArray(value.unauthorizedSkips) && value.unauthorizedSkips.length) unauthorizedSkips.push(`${location}.unauthorizedSkips`);
  } catch (error) {
    parsed.set(file, null);
    addState(`evidence:${location}`, 'MALFORMED_EVIDENCE', error.message);
    invalidEvidence.push(`${location}: ${error.message}`);
  }
}

if (!fs.existsSync(evidenceRoot)) {
  addState('evidence-root', 'MISSING_EVIDENCE');
  invalidEvidence.push('evidence directory missing');
}

if (manifest.sha !== expectedSha) shaMismatches.push(`manifest.sha=${manifest.sha}`);
if (manifest.workflow_run_id !== expectedRunId) shaMismatches.push(`manifest.workflow_run_id=${manifest.workflow_run_id}`);
if (identity.sha !== expectedSha) shaMismatches.push(`checkout.sha=${identity.sha}`);

const identityCandidates = [...parsed.entries()].filter(([, value]) => value?.schemaVersion === 2 && value?.evidenceClass === 'PRIMARY_EXECUTION' && typeof value?.packageLockSha256 === 'string');
if (identityCandidates.length !== 1) {
  addState('run-identity', identityCandidates.length ? 'MALFORMED_EVIDENCE' : 'MISSING_EVIDENCE', `identityCount=${identityCandidates.length}`);
  invalidEvidence.push(`run identity count=${identityCandidates.length}; expected=1`);
} else {
  const actual = identityCandidates[0][1];
  const checks = [
    ['sha', actual.sha, expectedSha],
    ['runId', actual.runId, expectedRunId],
    ['workflowName', actual.workflowName, identity.workflowName],
    ['eventName', actual.eventName, identity.eventName],
    ['contractVersion', actual.contractVersion, contractVersion],
    ['workflowSha256', actual.workflowSha256, identity.workflowSha256],
    ['testPlanSha256', actual.testPlanSha256, identity.testPlanSha256],
    ['assertionRegistrySha256', actual.assertionRegistrySha256, identity.assertionRegistrySha256],
    ['packageLockSha256', actual.packageLockSha256, identity.packageLockSha256],
    ['runtime.node', actual.runtime?.node, identity.runtime.node],
    ['runtime.npm', actual.runtime?.npm, identity.runtime.npm],
  ];
  for (const [field, actualValue, expectedValue] of checks) if (actualValue !== expectedValue) shaMismatches.push(`run-identity.${field}=${actualValue}`);
  addState('run-identity', 'PASS');
}

const primaryFiles = [];
for (const [file, value] of parsed) {
  if (value?.evidenceClass === 'PRIMARY_EXECUTION') primaryFiles.push(path.relative(root, file));
}
const primaryBySemanticKey = new Map();
for (const file of primaryFiles) {
  const value = parsed.get(path.join(root, file));
  const key = `${value.mode ?? 'UNKNOWN'}:${value.browser ?? 'UNKNOWN'}:${value.shard ?? 'UNKNOWN'}`;
  const previous = primaryBySemanticKey.get(key);
  if (previous) duplicatePrimaryEvidence.push(`${previous} <> ${file}`);
  primaryBySemanticKey.set(key, file);
}

const readNamed = (regex) => [...parsed.entries()]
  .filter(([file, value]) => value && regex.test(path.basename(file)))
  .map(([, value]) => value);
const fast = readNamed(/^browser-fast-(chromium|firefox|webkit)-([12])\.json$/);
const deep = readNamed(/^browser-deep-(chromium|firefox|webkit)-([123])\.json$/);
const expectedFastKeys = new Set(['chromium:1','chromium:2','firefox:1','firefox:2','webkit:1','webkit:2']);
const expectedDeepKeys = new Set();
for (const browser of ['chromium','firefox','webkit']) for (const shard of [1,2,3]) expectedDeepKeys.add(`${browser}:${shard}`);

const checkPrimaryLedger = (value, mode) => {
  if (!value || value.evidenceClass !== 'PRIMARY_EXECUTION') return;
  if (value.mode !== mode || value.status !== 'PASS' || value.complete !== true) failures.push(`${mode} ledger ${value.browser}:${value.shard} is not PASS/complete`);
  if (value.runId !== expectedRunId || value.exactSha !== expectedSha) shaMismatches.push(`${mode} ledger identity mismatch ${value.browser}:${value.shard}`);
  if (typeof value.sourceReportSha256 !== 'string' || !/^[0-9a-f]{64}$/iu.test(value.sourceReportSha256)) invalidEvidence.push(`${mode} ledger ${value.browser}:${value.shard} invalid report hash`);
  if (!Number.isInteger(value.executionUnitCount) || value.executionUnitCount !== (value.units ?? []).length) invalidEvidence.push(`${mode} ledger ${value.browser}:${value.shard} execution count mismatch`);
  const ids = new Set();
  for (const unit of value.units ?? []) {
    if (ids.has(unit.executionUnitId)) invalidEvidence.push(`${mode} duplicate executionUnitId=${unit.executionUnitId}`);
    ids.add(unit.executionUnitId);
    if (unit.runId !== expectedRunId) shaMismatches.push(`${mode} unit runId mismatch=${unit.executionUnitId}`);
    if (unit.exactSha !== expectedSha) shaMismatches.push(`${mode} unit exactSha mismatch=${unit.executionUnitId}`);
    if (!unit.spec || !unit.test || !unit.browser || !Number.isInteger(unit.shard)) invalidEvidence.push(`${mode} unit incomplete identity=${unit.executionUnitId}`);
    if (!Array.isArray(unit.attempts) || !unit.attempts.length) invalidEvidence.push(`${mode} unit missing attempts=${unit.executionUnitId}`);
    if (unit.status !== 'PASS') failures.push(`${mode} unit non-PASS=${unit.executionUnitId}`);
    if (mode === 'FAST' && unit.semanticUnitId !== `FAST:${unit.browser}:${unit.spec}`) invalidEvidence.push(`FAST semantic id mismatch=${unit.executionUnitId}`);
    if (mode === 'DEEP' && (!unit.semanticUnitId || !unit.semanticLocale)) invalidEvidence.push(`DEEP semantic identity missing=${unit.executionUnitId}`);
    if (unit.assertionId) {
      const registry = JSON.parse(fs.readFileSync(path.join(root, 'scripts/ci/assertion-registry.json'), 'utf8'));
      const entry = registry.assertions?.[unit.assertionId];
      const implementation = entry?.implementation;
      if (!entry) invalidEvidence.push(`${mode} unknown assertion=${unit.assertionId}`);
      else if (implementation?.kind === 'playwright-test' && (implementation.spec !== unit.spec || implementation.test !== unit.test)) invalidEvidence.push(`${mode} assertion implementation mismatch=${unit.executionUnitId}`);
    } else if (unit.attribution !== 'SURFACE_COVERAGE_ONLY') invalidEvidence.push(`${mode} missing assertion attribution=${unit.executionUnitId}`);
  }
};
for (const value of fast) checkPrimaryLedger(value, 'FAST');
for (const value of deep) checkPrimaryLedger(value, 'DEEP');

const fastActualKeys = new Set(fast.map((value) => `${value.browser}:${value.shard}`));
for (const key of expectedFastKeys) if (!fastActualKeys.has(key)) addState(`FAST:${key}`, 'MISSING_EVIDENCE');
if (fast.length !== 6) invalidEvidence.push(`FAST primary ledger count=${fast.length}; expected=6`);
const fastSemanticOwners = new Map();
for (const value of fast) for (const unit of value.units ?? []) {
  const key = unit.semanticUnitId;
  const previous = fastSemanticOwners.get(key);
  if (previous && previous !== `${value.browser}:${value.shard}`) invalidEvidence.push(`FAST semantic unit duplicate owner=${key}`);
  fastSemanticOwners.set(key, `${value.browser}:${value.shard}`);
}
if (fastSemanticOwners.size !== 66) invalidEvidence.push(`FAST semantic units=${fastSemanticOwners.size}; expected=66`);

if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
  const deepActualKeys = new Set(deep.map((value) => `${value.browser}:${value.shard}`));
  for (const key of expectedDeepKeys) if (!deepActualKeys.has(key)) addState(`DEEP:${key}`, 'MISSING_EVIDENCE');
  if (deep.length !== 9) invalidEvidence.push(`DEEP primary ledger count=${deep.length}; expected=9`);
  const expectedLocales = JSON.parse(JSON.stringify([...new Set((fs.readFileSync(path.join(root, 'src/lib/i18n/config.ts'), 'utf8').match(/LOCALES\s*=\s*\[([\s\S]*?)\]/u)?.[1] ?? '').matchAll(/['\"]([a-z]{2,3})['\"]/giu)).map((match) => match[1].toLowerCase())])));
  const deepSemanticOwners = new Map();
  const deepLocales = new Set();
  for (const value of deep) for (const unit of value.units ?? []) {
    const key = unit.semanticUnitId;
    const previous = deepSemanticOwners.get(key);
    if (previous && previous !== `${value.browser}:${value.shard}`) invalidEvidence.push(`DEEP semantic unit duplicate owner=${key}`);
    deepSemanticOwners.set(key, `${value.browser}:${value.shard}`);
    if (unit.semanticLocale) deepLocales.add(unit.semanticLocale);
  }
  if (deepSemanticOwners.size !== expectedLocales.length * 3) invalidEvidence.push(`DEEP semantic locale-browser units=${deepSemanticOwners.size}; expected=${expectedLocales.length * 3}`);
  for (const browser of ['chromium','firefox','webkit']) for (const locale of expectedLocales) if (!deepSemanticOwners.has(`DEEP:${browser}:${locale}`)) invalidEvidence.push(`DEEP missing semantic unit=DEEP:${browser}:${locale}`);
  for (const locale of expectedLocales) if (!deepLocales.has(locale)) invalidEvidence.push(`DEEP missing locale=${locale}`);
}

const executionGraphPath = path.join(root, 'diagnostics', 'certification', 'execution-graph.json');
if (!fs.existsSync(executionGraphPath)) {
  invalidEvidence.push('execution-graph.json missing');
  addState('execution-graph', 'MISSING_EVIDENCE');
} else {
  try {
    const graph = JSON.parse(fs.readFileSync(executionGraphPath, 'utf8'));
    if (graph.status !== 'PASS') failures.push(`execution graph status=${graph.status}`);
    if (graph.exactSha !== expectedSha) shaMismatches.push(`execution graph SHA=${graph.exactSha}`);
    if (graph.runId !== expectedRunId) shaMismatches.push(`execution graph run=${graph.runId}`);
    if (graph.fast?.observedSemanticUnits !== 66) failures.push(`execution graph FAST=${graph.fast?.observedSemanticUnits}`);
    if (process.env.GITHUB_EVENT_NAME !== 'pull_request' && graph.deep?.semanticLocaleBrowserUnits !== expectedDeepCountPlaceholder) failures.push(`execution graph DEEP semantic units=${graph.deep?.semanticLocaleBrowserUnits}`);
  } catch (error) {
    invalidEvidence.push(`execution-graph.json invalid: ${error.message}`);
  }
}

const staticEvidence = [...parsed.entries()].find(([file, value]) => value && path.basename(file) === 'static.json')?.[1] ?? null;
const buildEvidence = [...parsed.entries()].find(([file, value]) => value && path.basename(file) === 'build.json')?.[1] ?? null;
for (const [label, value] of [['static', staticEvidence], ['build', buildEvidence]]) {
  if (!value) { invalidEvidence.push(`${label}.json missing`); continue; }
  if (value.evidenceClass !== 'PRIMARY_EXECUTION' || value.status !== 'PASS') failures.push(`${label} evidence not PASS`);
  if (value.sha !== expectedSha) shaMismatches.push(`${label}.sha=${value.sha}`);
  if (Array.isArray(value.rootCauses)) for (const rc of value.rootCauses) if (rc) independentRootCauses.add(String(rc));
}

const requiredJobs = ['static', 'build', 'browserFast'];
if (process.env.GITHUB_EVENT_NAME !== 'pull_request') requiredJobs.push('browserDeep');
const jobStates = {};
for (const job of requiredJobs) {
  const raw = manifest.jobs?.[job];
  if (raw === undefined) { jobStates[job] = 'NOT_EXECUTED'; addState(`job:${job}`, 'NOT_EXECUTED'); }
  else {
    const state = { success: 'PASS', failure: 'FAIL', cancelled: 'CANCELLED', skipped: 'NOT_EXECUTED' }[raw] ?? 'NOT_EXECUTED';
    jobStates[job] = state;
    addState(`job:${job}`, state, `workflow-result=${raw}`);
    if (state !== 'PASS') failures.push(`${job}=${state}`);
  }
}

for (const rc of independentRootCauses) if (rc) failures.push(`unresolved root cause evidence=${rc}`);
if (duplicatePrimaryEvidence.length) invalidEvidence.push(...duplicatePrimaryEvidence.map((value) => `DUPLICATE_PRIMARY_EVIDENCE=${value}`));

const stateCounts = Object.fromEntries(EXECUTION_STATES.map((state) => [state, provenanceStates.filter((entry) => entry.state === state).length]));
const provenanceFailure = provenanceStates.some((entry) => isEvidenceFailure(entry.state) || ['FAIL','BLOCKED','CANCELLED','NOT_EXECUTED'].includes(entry.state));
const status = failures.length || unknowns.length || invalidEvidence.length || shaMismatches.length || unauthorizedSkips.length || provenanceFailure ? 'FAIL' : 'PASS';
const result = {
  schema_version: 8,
  authority: 'CANONICAL_CERTIFY_ENGINE',
  evidenceClass: 'PRIMARY_EXECUTION',
  status,
  certificationSha: expectedSha,
  runId: expectedRunId,
  identity: { expected: identity, verified: identityCandidates.length === 1 },
  zeroFalseGreen: {
    independentRootCauses: independentRootCauses.size,
    unknowns: unknowns.length,
    invalidEvidence: invalidEvidence.length,
    shaMismatches: shaMismatches.length,
    unauthorizedSkips: unauthorizedSkips.length,
    duplicatePrimaryEvidence: duplicatePrimaryEvidence.length,
  },
  conservation: {
    fast: { planned: 66, executed: fastSemanticOwners.size, evidenced: fastSemanticOwners.size, certified: status === 'PASS' ? 66 : 0 },
    deep: { plannedSemanticLocaleBrowser: process.env.GITHUB_EVENT_NAME === 'pull_request' ? 0 : undefined, executedSemanticLocaleBrowser: process.env.GITHUB_EVENT_NAME === 'pull_request' ? 0 : deep.length, evidencedSemanticLocaleBrowser: process.env.GITHUB_EVENT_NAME === 'pull_request' ? 0 : deep.length },
  },
  execution: { jobs: jobStates, stateCounts, fastLedgers: fast.length, deepLedgers: deep.length },
  lineage: 'Registry → Test Plan → Execution Unit → Raw Result → Primary Evidence → Identity → Canonical Reducer → Certification',
  failures,
  unknowns,
  invalidEvidence,
  shaMismatches,
  unauthorizedSkips,
};
fs.mkdirSync(path.join(root, 'diagnostics', 'certification'), { recursive: true });
fs.writeFileSync(path.join(root, 'diagnostics', 'certification', 'global-evidence.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (status !== 'PASS') process.exit(1);
