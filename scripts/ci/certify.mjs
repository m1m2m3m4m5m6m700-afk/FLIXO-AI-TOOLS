#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { EXECUTION_STATES, isEvidenceFailure } from './result-state.mjs';

const root = process.cwd();
const manifestPath = process.env.CERTIFICATION_MANIFEST || 'certification-run-manifest.json';
const expectedSha = process.env.CERTIFICATION_SHA;
if (!expectedSha) throw new Error('CERTIFICATION_SHA is required');
if (!fs.existsSync(manifestPath)) throw new Error(`Missing certification manifest: ${manifestPath}`);

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
    if (required) addState(`job:${job}`, 'NOT_EXECUTED', 'job result is absent from the exact-run manifest');
    return required ? 'NOT_EXECUTED' : 'PASS';
  }
  const map = { success: 'PASS', failure: 'FAIL', cancelled: 'CANCELLED', skipped: 'NOT_EXECUTED' };
  const state = map[raw] ?? 'NOT_EXECUTED';
  addState(`job:${job}`, state, `workflow-result=${raw}`);
  return state;
}

if (manifest.sha !== expectedSha) shaMismatches.push(`manifest.sha=${manifest.sha}`);
if (manifest.workflow_run_id !== process.env.GITHUB_RUN_ID) shaMismatches.push(`manifest.workflow_run_id=${manifest.workflow_run_id}`);

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
    if (value.evidenceClass === 'PRIMARY_EXECUTION' && Array.isArray(value.rootCauses)) {
      for (const rc of value.rootCauses) if (typeof rc === 'string' && rc) independentRootCauses.add(rc);
    }
    if ('independentRootCauseCount' in value && !Number.isInteger(value.independentRootCauseCount)) invalidEvidence.push(`${location}.independentRootCauseCount must be an integer`);
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

const fastEvidence = readEvidence(/^browser-fast-(chromium|firefox|webkit)-([12])\.json$/);
const fastExpected = new Set(['chromium:1','chromium:2','firefox:1','firefox:2','webkit:1','webkit:2']);
const fastActual = new Set();
for (const v of fastEvidence) {
  const key = `${v.browser}:${v.shard}`;
  if (!fastExpected.has(key)) unknowns.push(`unexpected FAST evidence ${key}`);
  fastActual.add(key);
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
    const key = `${v.browser}:${v.shard}`;
    if (!deepExpected.has(key)) unknowns.push(`unexpected DEEP evidence ${key}`);
    deepActual.add(key);
    if (v.evidenceClass !== 'PRIMARY_EXECUTION') invalidEvidence.push(`browser-deep:${key} missing PRIMARY_EXECUTION evidenceClass`);
    if (v.mode !== 'DEEP' || v.locales !== 20 || v.status !== 'PASS') failures.push(`invalid DEEP browser evidence ${key}`);
  }
  for (const key of deepExpected) if (!deepActual.has(key)) addState(`evidence:browser-deep:${key}`, 'MISSING_EVIDENCE');
  requireEvidence('browser-deep-count', deepEvidence, 9);
}

const staticBuildEvidence = files.filter((file) => /canonical-result\.json$|report\.json$/i.test(path.basename(file)));
for (const file of staticBuildEvidence) {
  const value = parsedJson.get(file);
  if (!value) continue;
  const location = path.relative(root, file);
  if (value.evidenceClass !== 'PRIMARY_EXECUTION') invalidEvidence.push(`${location} missing PRIMARY_EXECUTION evidenceClass`);
  if (Array.isArray(value.failures) && value.failures.length) failures.push(`${location} has failures`);
  if (Array.isArray(value.unknowns) && value.unknowns.length) unknowns.push(`${location} has unknowns`);
  if (!Array.isArray(value.rootCauses)) invalidEvidence.push(`${location} missing rootCauses array`);
  else if (value.evidenceClass === 'PRIMARY_EXECUTION') for (const rc of value.rootCauses) if (typeof rc === 'string' && rc) independentRootCauses.add(rc);
  if ('independentRootCauseCount' in value && !Number.isInteger(value.independentRootCauseCount)) invalidEvidence.push(`${location} invalid independentRootCauseCount`);
}

if (manifest.required?.matrixFirstUnits !== 66) failures.push(`matrixFirstUnits=${manifest.required?.matrixFirstUnits}`);
if (manifest.required?.fullMatrixLocales !== 20) failures.push(`fullMatrixLocales=${manifest.required?.fullMatrixLocales}`);
if (manifest.required?.browsers !== 3) failures.push(`browsers=${manifest.required?.browsers}`);

const stateCounts = Object.fromEntries(EXECUTION_STATES.map((state) => [state, provenanceStates.filter((entry) => entry.state === state).length));
const provenanceFailure = provenanceStates.some((entry) => isEvidenceFailure(entry.state) || ['FAIL','BLOCKED','CANCELLED','NOT_EXECUTED'].includes(entry.state));
const status = failures.length || unknowns.length || invalidEvidence.length || shaMismatches.length || unauthorizedSkips.length || provenanceFailure ? 'FAIL' : 'PASS';
const result = {
  schema_version: 4,
  authority: 'CANONICAL_CERTIFY_ENGINE',
  status,
  certificationSha: expectedSha,
  zeroFalseGreen: { independentRootCauses: independentRootCauses.size, unknowns: unknowns.length, invalidEvidence: invalidEvidence.length, shaMismatches: shaMismatches.length, unauthorizedSkips: unauthorizedSkips.length },
  coverage: { matrixFirstUnits: 66, fullMatrixLocales: 20, browsers: 3, fastEvidenceFiles: fastEvidence.length, deepEvidenceFiles: deepEvidence.length },
  execution: { requiredJobs: jobStates, provenanceStates, stateCounts },
  lineage: 'Assertion → Execution State → SHA → Environment → Artifact → Result → Root Cause',
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
