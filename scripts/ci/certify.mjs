#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { EXECUTION_STATES, isEvidenceFailure } from './result-state.mjs';

const root = process.cwd();
const manifestPath = process.env.CERTIFICATION_MANIFEST || 'certification-run-manifest.json';
const expectedSha = process.env.CERTIFICATION_SHA;
const CONTRACT_VERSION = 'MASTER AUTONOMOUS RECOVERY & EXECUTION CONTRACT v5';
if (!expectedSha) throw new Error('CERTIFICATION_SHA is required');
if (!fs.existsSync(manifestPath)) throw new Error(`Missing certification manifest: ${manifestPath}`);

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const currentIdentity = {
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workflowSha256: sha256('.github/workflows/ci.yml'),
  testPlanSha256: sha256('scripts/ci/test-plan.json'),
  assertionRegistrySha256: sha256('scripts/ci/assertion-registry.json'),
  packageLockSha256: sha256('package-lock.json'),
  runtime: { node: process.version, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim() },
  contractVersion: CONTRACT_VERSION,
  workflowName: process.env.GITHUB_WORKFLOW ?? null,
  eventName: process.env.GITHUB_EVENT_NAME ?? null,
};

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];
const unknowns = [];
const invalidEvidence = [];
const shaMismatches = [];
const unauthorizedSkips = [];
const independentRootCauses = new Set();
const provenanceStates = [];
function addState(subject, state, detail = null) {
  if (!EXECUTION_STATES.includes(state)) throw new Error(`Invalid provenance state: ${state}`);
  provenanceStates.push({ subject, state, ...(detail ? { detail } : {}) });
}
function jobState(job, required = true) {
  const raw = manifest.jobs?.[job];
  if (raw === undefined) {
    if (required) addState(`job:${job}`, 'NOT_EXECUTED', 'job result absent from exact-run manifest');
    return required ? 'NOT_EXECUTED' : 'PASS';
  }
  const map = { success: 'PASS', failure: 'FAIL', cancelled: 'CANCELLED', skipped: 'NOT_EXECUTED' };
  const state = map[raw] ?? 'NOT_EXECUTED';
  addState(`job:${job}`, state, `workflow-result=${raw}`);
  return state;
}

if (manifest.sha !== expectedSha) shaMismatches.push(`manifest.sha=${manifest.sha}`);
if (manifest.workflow_run_id !== process.env.GITHUB_RUN_ID) shaMismatches.push(`manifest.workflow_run_id=${manifest.workflow_run_id}`);
if (currentIdentity.sha !== expectedSha) shaMismatches.push(`checkout.sha=${currentIdentity.sha}`);

const requiredJobs = ['static', 'build', 'browserFast'];
if (process.env.GITHUB_EVENT_NAME !== 'pull_request') requiredJobs.push('browserDeep');
const jobStates = Object.fromEntries(requiredJobs.map((job) => [job, jobState(job, true)]));
for (const [job, state] of Object.entries(jobStates)) if (state === 'FAIL') failures.push(`${job}=failure`);

const evidenceRoot = path.join(root, 'evidence');
if (!fs.existsSync(evidenceRoot)) {
  addState('evidence-root', 'MISSING_EVIDENCE');
  failures.push('evidence directory missing');
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(file));
    else if (entry.isFile()) out.push(file);
  }
  return out;
}
const files = walk(evidenceRoot);
const jsonFiles = files.filter((file) => file.endsWith('.json'));
const parsedJson = new Map();
for (const file of jsonFiles) {
  const location = path.relative(root, file);
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    parsedJson.set(file, value);
    addState(`evidence:${location}`, 'PASS');
    if (typeof value.sha === 'string' && value.sha && value.sha !== expectedSha) shaMismatches.push(`${location}.sha=${value.sha}`);
    if (typeof value.run_id === 'string' && value.run_id && value.run_id !== process.env.GITHUB_RUN_ID) shaMismatches.push(`${location}.run_id=${value.run_id}`);
    if (Array.isArray(value.skipped) && value.skipped.length) unauthorizedSkips.push(`${location}.skipped`);
    if (Array.isArray(value.unauthorizedSkips) && value.unauthorizedSkips.length) unauthorizedSkips.push(`${location}.unauthorizedSkips`);
    if (value.evidenceClass === 'PRIMARY_EXECUTION' && Array.isArray(value.rootCauses)) for (const rc of value.rootCauses) if (typeof rc === 'string' && rc) independentRootCauses.add(rc);
  } catch (error) {
    parsedJson.set(file, null);
    addState(`evidence:${location}`, 'MALFORMED_EVIDENCE', error.message);
    invalidEvidence.push(`${location}: ${error.message}`);
  }
}
function readEvidence(pattern) {
  return [...parsedJson.entries()].filter(([file, value]) => value && pattern.test(path.basename(file))).map(([, value]) => value);
}
function requireEvidence(subject, found, expectedCount) {
  if (found.length !== expectedCount) {
    addState(`evidence:${subject}`, 'MISSING_EVIDENCE', `found=${found.length};expected=${expectedCount}`);
    return false;
  }
  return true;
}

const identities = [...parsedJson.entries()].filter(([, value]) => value?.schemaVersion === 2 && value?.evidenceClass === 'PRIMARY_EXECUTION' && typeof value?.packageLockSha256 === 'string');
if (identities.length !== 1) {
  addState('run-identity', identities.length ? 'MALFORMED_EVIDENCE' : 'MISSING_EVIDENCE', `identityCount=${identities.length}`);
  invalidEvidence.push(`run identity count=${identities.length}, expected exactly 1 schemaVersion=2 identity`);
} else {
  const identity = identities[0][1];
  const checks = [
    ['sha', identity.sha, expectedSha],
    ['runId', identity.runId, process.env.GITHUB_RUN_ID],
    ['workflowName', identity.workflowName, currentIdentity.workflowName],
    ['eventName', identity.eventName, currentIdentity.eventName],
    ['contractVersion', identity.contractVersion, CONTRACT_VERSION],
    ['workflowSha256', identity.workflowSha256, currentIdentity.workflowSha256],
    ['testPlanSha256', identity.testPlanSha256, currentIdentity.testPlanSha256],
    ['assertionRegistrySha256', identity.assertionRegistrySha256, currentIdentity.assertionRegistrySha256],
    ['packageLockSha256', identity.packageLockSha256, currentIdentity.packageLockSha256],
    ['runtime.node', identity.runtime?.node, currentIdentity.runtime.node],
    ['runtime.npm', identity.runtime?.npm, currentIdentity.runtime.npm],
  ];
  for (const [field, actual, expected] of checks) if (actual !== expected) shaMismatches.push(`run-identity.${field}=${actual}`);
  addState('run-identity', 'PASS');
}

const fastEvidence = readEvidence(/^browser-fast-(chromium|firefox|webkit)-([12])\.json$/);
const fastExpected = new Set(['chromium:1','chromium:2','firefox:1','firefox:2','webkit:1','webkit:2']);
const fastActual = new Set();
for (const v of fastEvidence) {
  const key = `${v.browser}:${v.shard}`; fastActual.add(key);
  if (!fastExpected.has(key)) unknowns.push(`unexpected FAST evidence ${key}`);
  if (v.evidenceClass !== 'PRIMARY_EXECUTION') invalidEvidence.push(`browser-fast:${key} missing PRIMARY_EXECUTION evidenceClass`);
  if (v.mode !== 'FAST' || v.toolSpecs !== 22 || v.status !== 'PASS') failures.push(`invalid FAST browser evidence ${key}`);
}
for (const key of fastExpected) if (!fastActual.has(key)) addState(`evidence:browser-fast:${key}`, 'MISSING_EVIDENCE');
requireEvidence('browser-fast-count', fastEvidence, 6);

const deepEvidence = readEvidence(/^browser-deep-(chromium|firefox|webkit)-([123])\.json$/);
if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
  const deepExpected = new Set();
  for (const browser of ['chromium','firefox','webkit']) for (const shard of [1,2,3]) deepExpected.add(`${browser}:${shard}`);
  const deepActual = new Set();
  for (const v of deepEvidence) {
    const key = `${v.browser}:${v.shard}`; deepActual.add(key);
    if (!deepExpected.has(key)) unknowns.push(`unexpected DEEP evidence ${key}`);
    if (v.evidenceClass !== 'PRIMARY_EXECUTION') invalidEvidence.push(`browser-deep:${key} missing PRIMARY_EXECUTION evidenceClass`);
    if (v.mode !== 'DEEP' || v.locales !== 20 || v.status !== 'PASS') failures.push(`invalid DEEP browser evidence ${key}`);
  }
  for (const key of deepExpected) if (!deepActual.has(key)) addState(`evidence:browser-deep:${key}`, 'MISSING_EVIDENCE');
  requireEvidence('browser-deep-count', deepEvidence, 9);
}

const staticEvidence = [...parsedJson.entries()].find(([file, value]) => value && path.basename(file) === 'static.json')?.[1] ?? null;
const buildEvidence = [...parsedJson.entries()].find(([file, value]) => value && path.basename(file) === 'build.json')?.[1] ?? null;
if (!staticEvidence || staticEvidence.evidenceClass !== 'PRIMARY_EXECUTION' || staticEvidence.status !== 'PASS') failures.push('static gate evidence is not PASS');
if (!buildEvidence || buildEvidence.evidenceClass !== 'PRIMARY_EXECUTION' || buildEvidence.status !== 'PASS') failures.push('build gate evidence is not PASS');
for (const [name, value] of [['static', staticEvidence], ['build', buildEvidence]]) {
  if (!value) continue;
  if (value.sha !== expectedSha) shaMismatches.push(`${name}.sha=${value.sha}`);
  if (value.testPlanSha256 && value.testPlanSha256 !== currentIdentity.testPlanSha256) shaMismatches.push(`${name}.testPlanSha256=${value.testPlanSha256}`);
  if (value.assertionRegistrySha256 && value.assertionRegistrySha256 !== currentIdentity.assertionRegistrySha256) shaMismatches.push(`${name}.assertionRegistrySha256=${value.assertionRegistrySha256}`);
  if (Array.isArray(value.rootCauses)) for (const rc of value.rootCauses) if (typeof rc === 'string' && rc) independentRootCauses.add(rc);
}

if (manifest.required?.matrixFirstUnits !== 66) failures.push(`matrixFirstUnits=${manifest.required?.matrixFirstUnits}`);
if (manifest.required?.fullMatrixLocales !== 20) failures.push(`fullMatrixLocales=${manifest.required?.fullMatrixLocales}`);
if (manifest.required?.browsers !== 3) failures.push(`browsers=${manifest.required?.browsers}`);

const stateCounts = Object.fromEntries(EXECUTION_STATES.map((state) => [state, provenanceStates.filter((entry) => entry.state === state).length]));
const provenanceFailure = provenanceStates.some((entry) => isEvidenceFailure(entry.state) || ['FAIL','BLOCKED','CANCELLED','NOT_EXECUTED'].includes(entry.state));
const status = failures.length || unknowns.length || invalidEvidence.length || shaMismatches.length || unauthorizedSkips.length || provenanceFailure ? 'FAIL' : 'PASS';
const result = {
  schema_version: 6,
  authority: 'CANONICAL_CERTIFY_ENGINE',
  evidenceClass: 'PRIMARY_EXECUTION',
  status,
  certificationSha: expectedSha,
  identity: { schemaVersion: 2, expected: currentIdentity, verified: identities.length === 1 },
  zeroFalseGreen: { independentRootCauses: independentRootCauses.size, unknowns: unknowns.length, invalidEvidence: invalidEvidence.length, shaMismatches: shaMismatches.length, unauthorizedSkips: unauthorizedSkips.length },
  coverage: { matrixFirstUnits: 66, fullMatrixLocales: 20, browsers: 3, fastEvidenceFiles: fastEvidence.length, deepEvidenceFiles: deepEvidence.length },
  execution: { requiredJobs: jobStates, provenanceStates, stateCounts },
  lineage: 'Assertion → Execution State → SHA → Identity → Environment → Artifact → Result → Root Cause',
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
