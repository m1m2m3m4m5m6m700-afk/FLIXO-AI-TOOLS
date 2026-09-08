#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { EXECUTION_STATES, isEvidenceFailure, reduceCheckResults } from './result-state.mjs';

const root = process.cwd();
const manifestPath = process.env.CERTIFICATION_MANIFEST || 'certification-run-manifest.json';
const expectedSha = process.env.CERTIFICATION_SHA;
const expectedRunId = process.env.GITHUB_RUN_ID;
const contractVersion = 'MASTER AUTONOMOUS RECOVERY & EXECUTION CONTRACT v5';
if (!expectedSha) throw new Error('CERTIFICATION_SHA is required');
if (!expectedRunId) throw new Error('GITHUB_RUN_ID is required');
if (!fs.existsSync(manifestPath)) throw new Error(`Missing certification manifest: ${manifestPath}`);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
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
const manifest = readJson(manifestPath);
const failures = [];
const unknowns = [];
const invalidEvidence = [];
const shaMismatches = [];
const unauthorizedSkips = [];
const duplicatePrimaryEvidence = [];
const independentRootCauses = new Set();
const provenanceStates = [];
const addState = (subject, state, detail = null) => {
  if (!EXECUTION_STATES.includes(state)) throw new Error(`Invalid state ${state}`);
  provenanceStates.push({ subject, state, ...(detail ? { detail } : {}) });
};

if (manifest.sha !== expectedSha) shaMismatches.push(`manifest.sha=${manifest.sha}`);
if (manifest.workflow_run_id !== expectedRunId) shaMismatches.push(`manifest.workflow_run_id=${manifest.workflow_run_id}`);
if (identity.sha !== expectedSha) shaMismatches.push(`checkout.sha=${identity.sha}`);

const evidenceRoot = path.join(root, 'evidence');
if (!fs.existsSync(evidenceRoot)) {
  addState('evidence-root', 'MISSING_EVIDENCE');
  invalidEvidence.push('evidence directory missing');
}
const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
};
const evidenceFiles = walk(evidenceRoot).filter((file) => file.endsWith('.json'));
const parsed = new Map();
for (const file of evidenceFiles) {
  const rel = path.relative(root, file);
  try {
    const value = readJson(file);
    parsed.set(file, value);
    addState(`evidence:${rel}`, 'PASS');
    if (Array.isArray(value.skipped) && value.skipped.length) unauthorizedSkips.push(`${rel}.skipped`);
    if (Array.isArray(value.unauthorizedSkips) && value.unauthorizedSkips.length) unauthorizedSkips.push(`${rel}.unauthorizedSkips`);
    if (Array.isArray(value.rootCauses)) for (const rc of value.rootCauses) if (rc) independentRootCauses.add(String(rc));
  } catch (error) {
    parsed.set(file, null);
    addState(`evidence:${rel}`, 'MALFORMED_EVIDENCE', error.message);
    invalidEvidence.push(`${rel}: ${error.message}`);
  }
}

const identityCandidates = [...parsed.values()].filter((value) => value?.schemaVersion === 2 && value?.evidenceClass === 'PRIMARY_EXECUTION' && typeof value?.packageLockSha256 === 'string');
if (identityCandidates.length !== 1) {
  addState('run-identity', identityCandidates.length ? 'MALFORMED_EVIDENCE' : 'MISSING_EVIDENCE', `count=${identityCandidates.length}`);
  invalidEvidence.push(`run identity count=${identityCandidates.length}; expected=1`);
} else {
  const actual = identityCandidates[0];
  const checks = [
    ['sha', actual.sha, expectedSha], ['runId', actual.runId, expectedRunId],
    ['workflowName', actual.workflowName, identity.workflowName], ['eventName', actual.eventName, identity.eventName],
    ['contractVersion', actual.contractVersion, contractVersion], ['workflowSha256', actual.workflowSha256, identity.workflowSha256],
    ['testPlanSha256', actual.testPlanSha256, identity.testPlanSha256], ['assertionRegistrySha256', actual.assertionRegistrySha256, identity.assertionRegistrySha256],
    ['packageLockSha256', actual.packageLockSha256, identity.packageLockSha256], ['runtime.node', actual.runtime?.node, identity.runtime.node],
    ['runtime.npm', actual.runtime?.npm, identity.runtime.npm],
  ];
  for (const [field, actualValue, expectedValue] of checks) if (actualValue !== expectedValue) shaMismatches.push(`run-identity.${field}=${actualValue}`);
  addState('run-identity', 'PASS');
}

const primaryExecutionEntries = [...parsed.entries()].filter(([, value]) => value?.evidenceClass === 'PRIMARY_EXECUTION' && value?.mode && value?.browser && Number.isInteger(value?.shard));
const byExecutionKey = new Map();
for (const [file, value] of primaryExecutionEntries) {
  const rel = path.relative(root, file);
  const key = `${value.mode}:${value.browser}:${value.shard}`;
  if (byExecutionKey.has(key)) duplicatePrimaryEvidence.push(`${byExecutionKey.get(key)} <> ${rel}`);
  byExecutionKey.set(key, rel);
}

const fast = primaryExecutionEntries.filter(([, value]) => value.mode === 'FAST').map(([, value]) => value);
const deep = primaryExecutionEntries.filter(([, value]) => value.mode === 'DEEP').map(([, value]) => value);
const expectedFastKeys = new Set(['chromium:1','chromium:2','firefox:1','firefox:2','webkit:1','webkit:2']);
const expectedDeepKeys = new Set();
for (const browser of ['chromium','firefox','webkit']) for (const shard of [1,2,3]) expectedDeepKeys.add(`${browser}:${shard}`);
const fastKeys = new Set(fast.map((value) => `${value.browser}:${value.shard}`));
if (fast.length !== 6) invalidEvidence.push(`FAST primary ledgers=${fast.length}; expected=6`);
for (const key of expectedFastKeys) if (!fastKeys.has(key)) addState(`FAST:${key}`, 'MISSING_EVIDENCE');
if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
  const deepKeys = new Set(deep.map((value) => `${value.browser}:${value.shard}`));
  if (deep.length !== 9) invalidEvidence.push(`DEEP primary ledgers=${deep.length}; expected=9`);
  for (const key of expectedDeepKeys) if (!deepKeys.has(key)) addState(`DEEP:${key}`, 'MISSING_EVIDENCE');
}

const checkLedger = (value, mode) => {
  const rel = `${mode}:${value.browser}:${value.shard}`;
  if (value.evidenceClass !== 'PRIMARY_EXECUTION') invalidEvidence.push(`${rel}: wrong evidenceClass`);
  if (value.status !== 'PASS' || value.complete !== true) failures.push(`${rel}: ledger is not PASS/complete`);
  if (value.runId !== expectedRunId || value.exactSha !== expectedSha) shaMismatches.push(`${rel}: ledger identity mismatch`);
  if (!/^[0-9a-f]{64}$/iu.test(String(value.sourceReportSha256 ?? ''))) invalidEvidence.push(`${rel}: invalid sourceReportSha256`);
  if (value.executionUnitCount !== (value.units ?? []).length) invalidEvidence.push(`${rel}: executionUnitCount mismatch`);
  for (const unit of value.units ?? []) {
    if (unit.runId !== expectedRunId) shaMismatches.push(`${rel}: unit ${unit.executionUnitId} wrong runId`);
    if (unit.exactSha !== expectedSha) shaMismatches.push(`${rel}: unit ${unit.executionUnitId} wrong SHA`);
    if (!unit.spec || !unit.test || !unit.browser || !Number.isInteger(unit.shard)) invalidEvidence.push(`${rel}: incomplete unit ${unit.executionUnitId}`);
    if (!Array.isArray(unit.attempts) || unit.attempts.length < 1) invalidEvidence.push(`${rel}: unit ${unit.executionUnitId} missing attempts`);
    if (unit.status !== 'PASS') failures.push(`${rel}: unit ${unit.executionUnitId}=${unit.status}`);
    if (mode === 'FAST' && unit.semanticUnitId !== `FAST:${unit.browser}:${unit.spec}`) invalidEvidence.push(`${rel}: invalid FAST semanticUnitId`);
    if (mode === 'DEEP' && (!unit.semanticUnitId || !unit.semanticLocale)) invalidEvidence.push(`${rel}: invalid DEEP semantic identity`);
    if (unit.assertionId && unit.attribution !== 'CANONICAL_IMPLEMENTATION_MATCH') invalidEvidence.push(`${rel}: assertion attribution mismatch`);
    if (!unit.assertionId && unit.attribution !== 'SURFACE_COVERAGE_ONLY') invalidEvidence.push(`${rel}: missing assertion attribution`);
  }
};
for (const value of fast) checkLedger(value, 'FAST');
for (const value of deep) checkLedger(value, 'DEEP');

const expectedLocales = [...new Set([...((fs.readFileSync(path.join(root, 'src/lib/i18n/config.ts'), 'utf8').match(/LOCALES\s*=\s*\[([\s\S]*?)\]/u)?.[1] ?? '').matchAll(/['\"]([a-z]{2,3})['\"]/giu)].map((match) => match[1].toLowerCase())))];
const buildSemanticResults = (values, mode) => {
  const map = new Map();
  for (const value of values) for (const unit of value.units ?? []) {
    const key = mode === 'FAST' ? unit.semanticUnitId : unit.semanticUnitId;
    if (!key) continue;
    const prior = map.get(key);
    const state = unit.status === 'PASS' ? 'PASS' : unit.status;
    if (!prior || prior === 'PASS') map.set(key, state);
  }
  return map;
};
const fastSemantic = buildSemanticResults(fast, 'FAST');
const deepSemantic = buildSemanticResults(deep, 'DEEP');
if (fastSemantic.size !== 66) invalidEvidence.push(`FAST semantic conservation=${fastSemantic.size}; expected=66`);
for (const browser of ['chromium','firefox','webkit']) for (const spec of [
  'tests/image-compressor.spec.ts','tests/background-remover.spec.ts','tests/image-upscaler.spec.ts','tests/image-converter.spec.ts','tests/ai-image-generator.spec.ts','tests/object-remover.spec.ts','tests/watermark-remover.spec.ts','tests/image-cropper.spec.ts','tests/image-to-svg.spec.ts','tests/image-ocr.spec.ts','tests/photo-colorizer.spec.ts','tests/background-blur.spec.ts','tests/passport-photo-maker.spec.ts','tests/watermark-adder.spec.ts','tests/meme-generator.spec.ts','tests/collage-maker.spec.ts','tests/image-effects.spec.ts','tests/exif-cleaner.spec.ts','tests/svg-optimizer.spec.ts','tests/mockup-generator.spec.ts','tests/seed.spec.ts','tests/pix.spec.ts'
]) if (!fastSemantic.has(`FAST:${browser}:${spec}`)) invalidEvidence.push(`FAST missing semantic unit FAST:${browser}:${spec}`);

if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
  if (deepSemantic.size !== expectedLocales.length * 3) invalidEvidence.push(`DEEP semantic locale-browser conservation=${deepSemantic.size}; expected=${expectedLocales.length * 3}`);
  for (const browser of ['chromium','firefox','webkit']) for (const locale of expectedLocales) if (!deepSemantic.has(`DEEP:${browser}:${locale}`)) invalidEvidence.push(`DEEP missing semantic unit DEEP:${browser}:${locale}`);
}

const graphPath = path.join(root, 'diagnostics', 'certification', 'execution-graph.json');
if (!fs.existsSync(graphPath)) {
  addState('execution-graph', 'MISSING_EVIDENCE');
  invalidEvidence.push('execution-graph.json missing');
} else {
  try {
    const graph = readJson(graphPath);
    if (graph.status !== 'PASS') failures.push(`execution-graph.status=${graph.status}`);
    if (graph.exactSha !== expectedSha) shaMismatches.push(`execution-graph.exactSha=${graph.exactSha}`);
    if (graph.runId !== expectedRunId) shaMismatches.push(`execution-graph.runId=${graph.runId}`);
    if (graph.fast?.observedSemanticUnits !== 66) invalidEvidence.push(`execution-graph FAST=${graph.fast?.observedSemanticUnits}`);
    if (process.env.GITHUB_EVENT_NAME !== 'pull_request' && graph.deep?.semanticLocaleBrowserUnits !== expectedLocales.length * 3) invalidEvidence.push(`execution-graph DEEP=${graph.deep?.semanticLocaleBrowserUnits}`);
  } catch (error) {
    invalidEvidence.push(`execution-graph invalid: ${error.message}`);
  }
}

const staticEvidence = [...parsed.entries()].find(([file, value]) => value && path.basename(file) === 'static.json')?.[1] ?? null;
const buildEvidence = [...parsed.entries()].find(([file, value]) => value && path.basename(file) === 'build.json')?.[1] ?? null;
for (const [label, value] of [['static', staticEvidence], ['build', buildEvidence]]) {
  if (!value) { invalidEvidence.push(`${label}.json missing`); continue; }
  if (value.evidenceClass !== 'PRIMARY_EXECUTION' || value.status !== 'PASS') failures.push(`${label} evidence not PASS`);
  if (value.sha !== expectedSha) shaMismatches.push(`${label}.sha=${value.sha}`);
}

const semanticChecks = [
  ...fastSemantic.entries(),
  ...(process.env.GITHUB_EVENT_NAME === 'pull_request' ? [] : deepSemantic.entries()),
  ['STATIC_GATE', staticEvidence?.status === 'PASS' ? 'PASS' : 'FAIL'],
  ['BUILD_GATE', buildEvidence?.status === 'PASS' ? 'PASS' : 'FAIL'],
].map(([id, status]) => ({ id, status }));
const reduced = reduceCheckResults(semanticChecks, semanticChecks.length);
if (!reduced.decision) failures.push(`canonical reducer decision=${reduced.status}; expected=${reduced.expected}; executed=${reduced.executed}`);

for (const rc of independentRootCauses) failures.push(`unresolved root cause evidence=${rc}`);
if (duplicatePrimaryEvidence.length) invalidEvidence.push(...duplicatePrimaryEvidence.map((value) => `DUPLICATE_PRIMARY_EVIDENCE=${value}`));

const stateCounts = Object.fromEntries(EXECUTION_STATES.map((state) => [state, provenanceStates.filter((entry) => entry.state === state).length]));
const provenanceFailure = provenanceStates.some((entry) => isEvidenceFailure(entry.state) || ['FAIL','BLOCKED','CANCELLED','NOT_EXECUTED'].includes(entry.state));
const status = failures.length || unknowns.length || invalidEvidence.length || shaMismatches.length || unauthorizedSkips.length || provenanceFailure || !reduced.decision ? 'FAIL' : 'PASS';
const result = {
  schema_version: 9,
  authority: 'CANONICAL_CERTIFY_ENGINE',
  evidenceClass: 'PRIMARY_EXECUTION',
  status,
  certificationSha: expectedSha,
  runId: expectedRunId,
  identity: { expected: identity, verified: identityCandidates.length === 1 },
  reducer: reduced,
  conservation: {
    fast: { plannedSemanticUnits: 66, executedSemanticUnits: fastSemantic.size, evidencedSemanticUnits: fastSemantic.size, certifiedSemanticUnits: status === 'PASS' ? 66 : 0 },
    deep: process.env.GITHUB_EVENT_NAME === 'pull_request' ? null : { plannedSemanticLocaleBrowserUnits: expectedLocales.length * 3, executedSemanticLocaleBrowserUnits: deepSemantic.size, evidencedSemanticLocaleBrowserUnits: deepSemantic.size, certifiedSemanticLocaleBrowserUnits: status === 'PASS' ? expectedLocales.length * 3 : 0 },
  },
  execution: { fastLedgers: fast.length, deepLedgers: deep.length, stateCounts },
  zeroFalseGreen: {
    independentRootCauses: independentRootCauses.size,
    unknowns: unknowns.length,
    invalidEvidence: invalidEvidence.length,
    shaMismatches: shaMismatches.length,
    unauthorizedSkips: unauthorizedSkips.length,
    duplicatePrimaryEvidence: duplicatePrimaryEvidence.length,
    missingRequiredExecution: provenanceStates.filter((entry) => entry.state === 'NOT_EXECUTED' || entry.state === 'MISSING_EVIDENCE').length,
  },
  lineage: 'Registry → Test Plan → Exact Test → Runtime → Execution Unit → Primary Evidence → Identity → Canonical Reducer → Certification',
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
