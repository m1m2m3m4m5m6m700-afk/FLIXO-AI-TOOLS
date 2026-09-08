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
const jsonFiles = files.filter(file => file.endsWith('.json'));
for (const file of jsonFiles) {
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    invalidEvidence.push(`${path.relative(root, file)}: ${error.message}`);
    continue;
  }
  const visit = (item, location) => {
    if (!item || typeof item !== 'object') return;
    for (const key of ['sha', 'head_sha', 'expected_sha', 'expectedSha', 'actualHeadSha']) {
      if (typeof item[key] === 'string' && item[key] && item[key] !== expectedSha) shaMismatches.push(`${location}.${key}=${item[key]}`);
    }
    for (const key of ['skipped', 'unauthorizedSkips']) {
      if (Array.isArray(item[key]) && item[key].length) unauthorizedSkips.push(`${location}.${key}=${JSON.stringify(item[key])}`);
    }
    for (const [key, child] of Object.entries(item)) if (child && typeof child === 'object') visit(child, `${location}.${key}`);
  };
  visit(value, path.relative(root, file));
}

const reportFiles = jsonFiles.filter(file => /(?:canonical-result|report|static|build)\.json$/i.test(file));
let independentRootCauses = 0;
let derivedFailures = 0;
for (const file of reportFiles) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    independentRootCauses += Number(value.independentRootCauseCount ?? value.rootCauses?.length ?? 0);
    derivedFailures += Number(value.derivedFailureCount ?? 0);
    if (Array.isArray(value.failures) && value.failures.length) failures.push(`${path.relative(root, file)} has failures`);
    if (Array.isArray(value.unknowns) && value.unknowns.length) unknowns.push(`${path.relative(root, file)} has unknowns`);
  } catch {}
}

const browserEvidence = files.filter(file => /flixo-browser-(fast|deep)-/.test(file));
if (!browserEvidence.some(file => file.includes('flixo-browser-fast-'))) unknowns.push('FAST browser evidence missing');
if (process.env.GITHUB_EVENT_NAME !== 'pull_request' && !browserEvidence.some(file => file.includes('flixo-browser-deep-'))) unknowns.push('DEEP browser evidence missing');

const required = manifest.required ?? {};
if (required.matrixFirstUnits !== 66) failures.push(`matrixFirstUnits=${required.matrixFirstUnits}`);
if (required.fullMatrixLocales !== 20) failures.push(`fullMatrixLocales=${required.fullMatrixLocales}`);
if (required.browsers !== 3) failures.push(`browsers=${required.browsers}`);

const status = failures.length || unknowns.length || invalidEvidence.length || shaMismatches.length || unauthorizedSkips.length || independentRootCauses !== 0 ? 'FAIL' : 'PASS';
const result = {
  schema_version: 2,
  authority: 'CANONICAL_CERTIFY_ENGINE',
  status,
  certificationSha: expectedSha,
  zeroFalseGreen: { independentRootCauses, unknowns: unknowns.length, invalidEvidence: invalidEvidence.length, shaMismatches: shaMismatches.length, unauthorizedSkips: unauthorizedSkips.length },
  coverage: { matrixFirstUnits: 66, fullMatrixLocales: 20, browsers: 3 },
  lineage: 'Assertion → Execution → SHA → Environment → Artifact → Result → Root Cause',
  failures,
  unknowns,
  invalidEvidence,
  shaMismatches,
  unauthorizedSkips,
  derivedFailures,
};
fs.mkdirSync(path.join(root, 'diagnostics', 'certification'), { recursive: true });
fs.writeFileSync(path.join(root, 'diagnostics', 'certification', 'global-evidence.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (status !== 'PASS') process.exit(1);
