#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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

if (manifest.sha !== expectedSha) shaMismatches.push(`manifest.sha=${manifest.sha}`);
if (manifest.workflow_run_id !== process.env.GITHUB_RUN_ID) shaMismatches.push(`manifest.workflow_run_id=${manifest.workflow_run_id}`);

const requiredJobs = ['static', 'build', 'browserFast'];
if (process.env.GITHUB_EVENT_NAME !== 'pull_request') requiredJobs.push('browserDeep');
for (const job of requiredJobs) {
  if (!(job in (manifest.jobs ?? {}))) unknowns.push(`missing job result: ${job}`);
  else if (manifest.jobs[job] !== 'success') failures.push(`${job}=${manifest.jobs[job]}`);
}

const evidenceRoot = path.join(root, 'evidence');
if (!fs.existsSync(evidenceRoot)) failures.push('evidence directory missing');

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

for (const file of jsonFiles) {
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { invalidEvidence.push(`${path.relative(root, file)}: ${error.message}`); continue; }
  const location = path.relative(root, file);
  if (typeof value.sha === 'string' && value.sha && value.sha !== expectedSha) shaMismatches.push(`${location}.sha=${value.sha}`);
  if (typeof value.run_id === 'string' && value.run_id && value.run_id !== process.env.GITHUB_RUN_ID) shaMismatches.push(`${location}.run_id=${value.run_id}`);
  if (Array.isArray(value.skipped) && value.skipped.length) unauthorizedSkips.push(`${location}.skipped`);
  if (Array.isArray(value.unauthorizedSkips) && value.unauthorizedSkips.length) unauthorizedSkips.push(`${location}.unauthorizedSkips`);

  const declared = Array.isArray(value.rootCauses) ? value.rootCauses : null;
  if (declared) for (const rc of declared) if (typeof rc === 'string' && rc) independentRootCauses.add(rc);
  if ('independentRootCauseCount' in value && !Number.isInteger(value.independentRootCauseCount)) {
    invalidEvidence.push(`${location}.independentRootCauseCount must be an integer`);
  }
}

function readEvidence(pattern) {
  return jsonFiles.filter((file) => pattern.test(path.basename(file))).map((file) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  }).filter(Boolean);
}

const fastEvidence = readEvidence(/^browser-fast-(chromium|firefox|webkit)-([12])\.json$/);
const fastExpected = new Set(['chromium:1','chromium:2','firefox:1','firefox:2','webkit:1','webkit:2']);
const fastActual = new Set(fastEvidence.map((v) => `${v.browser}:${v.shard}`));
for (const key of fastExpected) if (!fastActual.has(key)) unknowns.push(`missing FAST evidence ${key}`);
if (fastEvidence.some((v) => v.mode !== 'FAST' || v.toolSpecs !== 22 || v.status !== 'PASS')) failures.push('invalid FAST browser evidence');

const deepEvidence = readEvidence(/^browser-deep-(chromium|firefox|webkit)-([123])\.json$/);
if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
  const deepExpected = new Set();
  for (const browser of ['chromium','firefox','webkit']) for (const shard of [1,2,3]) deepExpected.add(`${browser}:${shard}`);
  const deepActual = new Set(deepEvidence.map((v) => `${v.browser}:${v.shard}`));
  for (const key of deepExpected) if (!deepActual.has(key)) unknowns.push(`missing DEEP evidence ${key}`);
  if (deepEvidence.some((v) => v.mode !== 'DEEP' || v.locales !== 20 || v.status !== 'PASS')) failures.push('invalid DEEP browser evidence');
}

const staticBuildEvidence = files.filter((file) => /canonical-result\.json$|report\.json$/i.test(path.basename(file)));
for (const file of staticBuildEvidence) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(value.failures) && value.failures.length) failures.push(`${path.relative(root, file)} has failures`);
    if (Array.isArray(value.unknowns) && value.unknowns.length) unknowns.push(`${path.relative(root, file)} has unknowns`);
    if (!Array.isArray(value.rootCauses)) {
      invalidEvidence.push(`${path.relative(root, file)} missing rootCauses array`);
    } else {
      for (const rc of value.rootCauses) if (typeof rc === 'string' && rc) independentRootCauses.add(rc);
    }
    if ('independentRootCauseCount' in value && !Number.isInteger(value.independentRootCauseCount)) invalidEvidence.push(`${path.relative(root, file)} invalid independentRootCauseCount`);
  } catch (error) {
    invalidEvidence.push(`${path.relative(root, file)}: ${error.message}`);
  }
}

if (fastEvidence.length !== 6) unknowns.push(`FAST evidence count=${fastEvidence.length}, expected 6`);
if (process.env.GITHUB_EVENT_NAME !== 'pull_request' && deepEvidence.length !== 9) unknowns.push(`DEEP evidence count=${deepEvidence.length}, expected 9`);
if (manifest.required?.matrixFirstUnits !== 66) failures.push(`matrixFirstUnits=${manifest.required?.matrixFirstUnits}`);
if (manifest.required?.fullMatrixLocales !== 20) failures.push(`fullMatrixLocales=${manifest.required?.fullMatrixLocales}`);
if (manifest.required?.browsers !== 3) failures.push(`browsers=${manifest.required?.browsers}`);

const status = failures.length || unknowns.length || invalidEvidence.length || shaMismatches.length || unauthorizedSkips.length ? 'FAIL' : 'PASS';
const result = {
  schema_version: 3,
  authority: 'CANONICAL_CERTIFY_ENGINE',
  status,
  certificationSha: expectedSha,
  zeroFalseGreen: { independentRootCauses: independentRootCauses.size, unknowns: unknowns.length, invalidEvidence: invalidEvidence.length, shaMismatches: shaMismatches.length, unauthorizedSkips: unauthorizedSkips.length },
  coverage: { matrixFirstUnits: 66, fullMatrixLocales: 20, browsers: 3, fastEvidenceFiles: fastEvidence.length, deepEvidenceFiles: deepEvidence.length },
  lineage: 'Assertion → Execution → SHA → Environment → Artifact → Result → Root Cause',
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
