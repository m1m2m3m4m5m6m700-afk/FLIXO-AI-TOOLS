#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sha = process.env.CERTIFICATION_SHA;
const manifestPath = process.env.CERTIFICATION_MANIFEST || 'certification-run-manifest.json';
if (!sha) throw new Error('CERTIFICATION_SHA is required');
if (!fs.existsSync(manifestPath)) throw new Error(`Missing certification manifest: ${manifestPath}`);

const registry = JSON.parse(fs.readFileSync(path.join(root, 'scripts/ci/assertion-registry.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(root, 'scripts/ci/test-plan.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];
const unknowns = [];
const invalidEvidence = [];
const shaMismatches = [];
const unauthorizedSkips = [];
const independentRootCauses = new Set();

if (manifest.sha !== sha) shaMismatches.push(`manifest SHA mismatch: ${manifest.sha} != ${sha}`);

const requiredRuns = {
  CI: { requiredJobs: ['CI — Canonical Impact Verification', 'G3 / Canonical Build', 'G3 / Contracts', 'G3 / Browser', 'G3 / Aggregator', 'Canonical Verification Gate'] },
  'Matrix First Gate': { requiredJobs: ['Matrix First Certification'], matrixPrefix: 'E2E —', matrixCount: 6 },
  'Full Matrix Parallel': { requiredJobs: ['Full Matrix Parallel Certification'], matrixPrefix: 'Full Matrix —', matrixCount: 9 },
};

function jobSucceeded(job, context) {
  const status = String(job.conclusion ?? job.status ?? '').toLowerCase();
  if (status !== 'success') failures.push(`${context}: job ${job.name ?? '<unnamed>'} is ${status || 'unknown'}`);
}

for (const [key, requirement] of Object.entries(requiredRuns)) {
  const run = manifest.workflows?.[key];
  if (!run) {
    failures.push(`missing required workflow run: ${key}`);
    continue;
  }
  if (run.head_sha !== sha) shaMismatches.push(`${key}: ${run.head_sha} != ${sha}`);
  if (run.conclusion !== 'success') failures.push(`${key}: workflow conclusion=${run.conclusion}`);
  const jobs = run.jobs ?? [];
  for (const requiredJob of requirement.requiredJobs) {
    const job = jobs.find((entry) => entry.name === requiredJob);
    if (!job) { unknowns.push(`${key}: missing required job ${requiredJob}`); continue; }
    jobSucceeded(job, key);
  }
  if (requirement.matrixCount) {
    const matrixJobs = jobs.filter((entry) => String(entry.name ?? '').startsWith(requirement.matrixPrefix));
    if (matrixJobs.length !== requirement.matrixCount) failures.push(`${key}: expected ${requirement.matrixCount} matrix jobs, found ${matrixJobs.length}`);
    for (const job of matrixJobs) jobSucceeded(job, key);
  }
  if (!run.artifacts_dir || !fs.existsSync(run.artifacts_dir)) unknowns.push(`${key}: evidence artifact directory missing`);
}

function walkJsonFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

const evidenceRoots = Object.values(manifest.workflows ?? {}).map((run) => run.artifacts_dir).filter(Boolean);
const allEvidenceFiles = evidenceRoots.flatMap(walkJsonFiles);
for (const file of allEvidenceFiles) {
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { invalidEvidence.push(`${file}: invalid JSON (${String(error?.message ?? error)})`); continue; }
  const collect = (item, location = file) => {
    if (!item || typeof item !== 'object') return;
    for (const key of ['sha', 'head_sha', 'expected_sha', 'expectedSha', 'actualHeadSha']) {
      if (typeof item[key] === 'string' && item[key] && item[key] !== sha) shaMismatches.push(`${location}:${key}=${item[key]} != ${sha}`);
    }
    if (item.status === 'FAIL' && item.rootCauseId) independentRootCauses.add(item.rootCauseId);
    if (item.status === 'FAIL' && Array.isArray(item.rootCauses)) for (const rc of item.rootCauses) if (rc) independentRootCauses.add(typeof rc === 'string' ? rc : rc.id ?? JSON.stringify(rc));
    if (Array.isArray(item.rootCauseGroups)) for (const group of item.rootCauseGroups) if (group?.rootCauseId || group?.id) independentRootCauses.add(group.rootCauseId ?? group.id);
    if (Array.isArray(item.skipped) && item.skipped.length) unauthorizedSkips.push(`${location}: skipped=${JSON.stringify(item.skipped)}`);
    for (const [key, child] of Object.entries(item)) if (child && typeof child === 'object') collect(child, `${location}:${key}`);
  };
  collect(value);
}

const fastResultCandidates = allEvidenceFiles.filter((file) => file.endsWith('fast-ci-result.json'));
if (!fastResultCandidates.length) unknowns.push('fast CI result evidence is missing');
else {
  const fast = JSON.parse(fs.readFileSync(fastResultCandidates[0], 'utf8'));
  if (fast.sha !== sha) shaMismatches.push(`fast-ci-result.sha=${fast.sha}`);
  if (fast.status !== 'PASS') failures.push(`fast-ci-result.status=${fast.status}`);
  if ((fast.skipped ?? []).length) unauthorizedSkips.push(`fast-ci-result.skipped=${JSON.stringify(fast.skipped)}`);
}

const g3Candidates = allEvidenceFiles.filter((file) => file.endsWith('aggregator.json'));
if (!g3Candidates.length) unknowns.push('G3 aggregator evidence is missing');
else {
  const g3 = JSON.parse(fs.readFileSync(g3Candidates[0], 'utf8'));
  if (g3.sha && g3.sha !== sha) shaMismatches.push(`G3 aggregator sha=${g3.sha}`);
  if (g3.status !== 'PASS' || g3.authoritative !== true) failures.push(`G3 aggregator is not authoritative PASS: status=${g3.status} authoritative=${g3.authoritative}`);
  if ((g3.independentRootCauseCount ?? 0) !== 0) failures.push(`G3 reports independentRootCauseCount=${g3.independentRootCauseCount}`);
  if ((g3.missingEvidence ?? []).length) invalidEvidence.push(`G3 missing evidence: ${JSON.stringify(g3.missingEvidence)}`);
}

const registryAssertions = new Set(Object.keys(registry.assertions ?? {}));
const planAssertionIds = new Set(Object.values(plan.gates ?? {}).flatMap((gate) => gate.checks ?? []).flatMap((check) => check.assertions ?? []));
for (const assertionId of registryAssertions) if (!planAssertionIds.has(assertionId)) unknowns.push(`registry assertion not represented in plan: ${assertionId}`);

for (const source of plan.sourceDependencyGraph ? Object.entries(plan.sourceDependencyGraph) : []) if (!source[0]) unknowns.push('invalid source dependency graph entry');
for (const id of ['ASSERT-BROWSER-CHROMIUM-001','ASSERT-BROWSER-FIREFOX-001','ASSERT-BROWSER-WEBKIT-001']) if (!registryAssertions.has(id)) unknowns.push(`missing browser assertion ${id}`);

const result = {
  schema_version: 2,
  authority: 'GLOBAL_EVIDENCE_AUTHORITY',
  certificationSha: sha,
  status: failures.length || unknowns.length || invalidEvidence.length || shaMismatches.length || unauthorizedSkips.length || independentRootCauses.size ? 'FAIL' : 'PASS',
  zeroFalseGreen: {
    independentRootCauses: independentRootCauses.size,
    unknowns: unknowns.length,
    invalidEvidence: invalidEvidence.length,
    shaMismatches: shaMismatches.length,
    unauthorizedSkips: unauthorizedSkips.length,
  },
  requiredMatrix: { matrixFirstUnits: 66, fullMatrixLocales: 20, fullMatrixBrowsers: 3 },
  lineage: 'Assertion → Execution → SHA → Environment → Artifact → Result → Root Cause',
  registryAssertionCount: registryAssertions.size,
  failures,
  unknowns,
  invalidEvidence,
  shaMismatches,
  unauthorizedSkips,
  rootCauses: [...independentRootCauses],
  workflows: manifest.workflows,
};

fs.mkdirSync(path.join(root, 'diagnostics', 'certification'), { recursive: true });
fs.writeFileSync(path.join(root, 'diagnostics', 'certification', 'global-evidence.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exit(1);
