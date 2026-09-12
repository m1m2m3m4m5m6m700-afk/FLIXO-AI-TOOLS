#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const actualSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const runId = `negative-control-${Date.now()}`;
const corruptedSha = '0000000000000000000000000000000000000000';
assert.match(actualSha, /^[0-9a-f]{40}$/iu);
assert.notEqual(corruptedSha, actualSha);

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-phase-a-negative-control-'));
const copy = (relative) => {
  const source = path.join(repoRoot, relative);
  const destination = path.join(workspace, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};
for (const file of [
  '.github/workflows/ci.yml',
  'package-lock.json',
  'scripts/ci/assertion-registry.json',
  'scripts/ci/test-plan.json',
  'scripts/ci/result-state.mjs',
  'scripts/ci/certify-core.mjs',
  'scripts/ci/validate-execution-graph.mjs',
  'src/lib/i18n/config.ts',
]) copy(file);

const evidenceRoot = path.join(workspace, 'evidence');
const certificationRoot = path.join(workspace, 'diagnostics', 'certification');
fs.mkdirSync(evidenceRoot, { recursive: true });
fs.mkdirSync(certificationRoot, { recursive: true });

const digest = (relative) => createHash('sha256').update(fs.readFileSync(path.join(workspace, relative))).digest('hex');
const writeJson = (relative, value) => {
  const target = path.join(workspace, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

const browsers = ['chromium', 'firefox', 'webkit'];
const fastSpecs = [
  'tests/image-compressor.spec.ts', 'tests/background-remover.spec.ts', 'tests/image-upscaler.spec.ts',
  'tests/image-converter.spec.ts', 'tests/ai-image-generator.spec.ts', 'tests/object-remover.spec.ts',
  'tests/watermark-remover.spec.ts', 'tests/image-cropper.spec.ts', 'tests/image-to-svg.spec.ts',
  'tests/image-ocr.spec.ts', 'tests/photo-colorizer.spec.ts', 'tests/background-blur.spec.ts',
  'tests/passport-photo-maker.spec.ts', 'tests/watermark-adder.spec.ts', 'tests/meme-generator.spec.ts',
  'tests/collage-maker.spec.ts', 'tests/image-effects.spec.ts', 'tests/exif-cleaner.spec.ts',
  'tests/svg-optimizer.spec.ts', 'tests/mockup-generator.spec.ts', 'tests/seed.spec.ts', 'tests/pix.spec.ts',
];
const deepLocales = ['ar','de','en','es','fr','hi','id','it','ja','ko','ms','nl','pl','pt','ru','sv','th','tr','uk','vi'];

const unit = ({ mode, browser, shard, spec, locale = null, exactSha = actualSha }) => ({
  executionUnitId: `${mode}:${browser}:${shard}:${spec}${locale ? `:${locale}` : ''}`,
  semanticUnitId: mode === 'FAST' ? `FAST:${browser}:${spec}` : `DEEP:${browser}:${locale}`,
  assertionId: null,
  attribution: 'SURFACE_COVERAGE_ONLY',
  coverageId: `${mode}:${spec}${locale ? `:${locale}` : ''}`,
  mode,
  browser,
  locale,
  shard,
  spec,
  test: locale ? `/${locale}/localized runtime` : 'surface coverage',
  titlePath: [path.basename(spec)],
  semanticLocale: locale,
  attempt: 1,
  attempts: [{ attempt: 1, status: 'passed', durationMs: 1, errorCount: 0 }],
  status: 'PASS',
  testStatusCounts: { PASS: 1, FAIL: 0, SKIPPED: 0, NOT_EXECUTED: 0 },
  skippedTests: [],
  tests: [{ name: locale ? `/${locale}/localized runtime` : 'surface coverage', locale, status: 'PASS', attempt: 1, attempts: [{ attempt: 1, status: 'passed', durationMs: 1, errorCount: 0 }] }],
  runId,
  exactSha,
});

for (const browser of browsers) {
  for (const shard of [1, 2]) {
    const start = shard === 1 ? 0 : 11;
    const specs = fastSpecs.slice(start, start + 11);
    writeJson(`evidence/browser-fast/${browser}-${shard}.json`, {
      schema_version: 5,
      evidenceClass: 'PRIMARY_EXECUTION',
      mode: 'FAST',
      browser,
      shard,
      runId,
      exactSha: actualSha,
      sourceReportSha256: '0'.repeat(64),
      status: 'PASS',
      toolSpecs: 22,
      expectedSpecCount: 11,
      executedSpecCount: 11,
      unexpectedSpecs: [],
      executionUnitCount: specs.length,
      skippedTestCount: 0,
      failedTestCount: 0,
      notExecutedTestCount: 0,
      statusCounts: { PASS: specs.length, FAIL: 0, SKIPPED: 0, CANCELLED: 0, BLOCKED: 0, NOT_EXECUTED: 0 },
      attribution: { canonicalAssertionIds: [], canonicalAssertionExecutionCount: 0, surfaceCoverageExecutionCount: specs.length, uniqueCoverageIds: specs.map((spec) => `FAST:${spec}`) },
      semanticCoverage: { model: '22 specs × 3 browsers = 66 semantic spec-browser units', plannedSemanticUnitCount: 22, semanticUnitCount: specs.length, semanticUnitIds: specs.map((spec) => `FAST:${browser}:${spec}`), localeRegistryCount: 20, observedLocaleCount: 0, observedLocales: [], unexpectedLocales: [], partition: true, partitionCount: 2, partitionIndex: shard },
      complete: true,
      units: specs.map((spec) => unit({ mode: 'FAST', browser, shard, spec })),
    });
  }
}

for (const browser of browsers) {
  for (const shard of [1, 2, 3]) {
    const groups = shard === 1 ? deepLocales.slice(0, 5) : shard === 2 ? deepLocales.slice(5, 12) : deepLocales.slice(12);
    writeJson(`evidence/browser-deep/${browser}-${shard}.json`, {
      schema_version: 5,
      evidenceClass: 'PRIMARY_EXECUTION',
      mode: 'DEEP',
      browser,
      shard,
      runId,
      exactSha: actualSha,
      sourceReportSha256: '0'.repeat(64),
      status: 'PASS',
      locales: 20,
      expectedSpecCount: 1,
      executedSpecCount: 1,
      unexpectedSpecs: [],
      executionUnitCount: groups.length,
      skippedTestCount: 0,
      failedTestCount: 0,
      notExecutedTestCount: 0,
      statusCounts: { PASS: groups.length, FAIL: 0, SKIPPED: 0, CANCELLED: 0, BLOCKED: 0, NOT_EXECUTED: 0 },
      attribution: { canonicalAssertionIds: [], canonicalAssertionExecutionCount: 0, surfaceCoverageExecutionCount: groups.length, uniqueCoverageIds: groups.map((locale) => `DEEP:${locale}`) },
      semanticCoverage: { model: '20 locales × 3 browsers = 60 semantic locale-browser units', plannedSemanticUnitCount: 20, semanticUnitCount: groups.length, semanticUnitIds: groups.map((locale) => `DEEP:${browser}:${locale}`), localeRegistryCount: 20, observedLocaleCount: groups.length, observedLocales: groups, unexpectedLocales: [], partition: true, partitionCount: 3, partitionIndex: shard },
      complete: true,
      units: groups.map((locale) => unit({ mode: 'DEEP', browser, shard, spec: 'tests/localization-runtime.spec.ts', locale })),
    });
  }
}

writeJson('evidence/static-build/run-identity.json', {
  schemaVersion: 2,
  evidenceClass: 'PRIMARY_EXECUTION',
  contractVersion: 'CLOSURE NEGATIVE CONTROL TEST',
  sha: actualSha,
  workflowSha256: digest('.github/workflows/ci.yml'),
  testPlanSha256: digest('scripts/ci/test-plan.json'),
  assertionRegistrySha256: digest('scripts/ci/assertion-registry.json'),
  packageLockSha256: digest('package-lock.json'),
  runtime: { node: process.version, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim() },
  runId,
  workflowName: 'FLIXO Test System',
  eventName: 'test',
});
writeJson('evidence/static-build/static.json', { evidenceClass: 'PRIMARY_EXECUTION', status: 'PASS', sha: actualSha });
writeJson('evidence/static-build/build.json', { evidenceClass: 'PRIMARY_EXECUTION', status: 'PASS', sha: actualSha });
writeJson('certification-run-manifest.json', {
  schema_version: 4,
  sha: actualSha,
  workflow_run_id: runId,
  workflow: 'FLIXO Test System',
  jobs: { static: 'success', build: 'success', browserFast: 'success', browserDeep: 'success' },
  required: { matrixFirstUnits: 66, fullMatrixLocales: 20, browsers: 3 },
});

const runNode = (script, extraEnv = {}) => spawnSync(process.execPath, [script], {
  cwd: workspace,
  env: { ...process.env, ...extraEnv },
  encoding: 'utf8',
});

const graphPass = runNode('scripts/ci/validate-execution-graph.mjs', {
  EXPECTED_SHA: actualSha,
  GITHUB_RUN_ID: runId,
  EXECUTION_EVIDENCE_ROOT: evidenceRoot,
});
assert.equal(graphPass.status, 0, `positive graph validation failed:\n${graphPass.stdout}\n${graphPass.stderr}`);

const fastMutation = path.join(evidenceRoot, 'browser-fast', 'chromium-1.json');
const mutated = JSON.parse(fs.readFileSync(fastMutation, 'utf8'));
mutated.units[0].exactSha = corruptedSha;
mutated.exactSha = corruptedSha;
fs.writeFileSync(fastMutation, `${JSON.stringify(mutated, null, 2)}\n`);
assert.equal(fs.existsSync(fastMutation), true, 'mutated evidence must persist before rejection');
const persisted = JSON.parse(fs.readFileSync(fastMutation, 'utf8'));
assert.equal(persisted.exactSha, corruptedSha, 'corrupted evidence was not persisted');

const graphFail = runNode('scripts/ci/validate-execution-graph.mjs', {
  EXPECTED_SHA: actualSha,
  GITHUB_RUN_ID: runId,
  EXECUTION_EVIDENCE_ROOT: evidenceRoot,
});
assert.notEqual(graphFail.status, 0, 'corrupted provenance must fail graph validation');
const graphEvidence = JSON.parse(fs.readFileSync(path.join(certificationRoot, 'execution-graph.json'), 'utf8'));
assert.equal(graphEvidence.status, 'FAIL');
assert.ok(graphEvidence.errors.some((entry) => entry.includes('exactSha mismatch')));
assert.equal(graphEvidence.exactSha, actualSha);

const certificationFail = runNode('scripts/ci/certify.mjs', {
  EXPECTED_SHA: actualSha,
  CERTIFICATION_SHA: actualSha,
  CERTIFICATION_MANIFEST: path.join(workspace, 'certification-run-manifest.json'),
  GITHUB_RUN_ID: runId,
  GITHUB_EVENT_NAME: 'test',
  GITHUB_WORKFLOW: 'FLIXO Test System',
});
assert.notEqual(certificationFail.status, 0, 'certification must stop on corrupted provenance evidence');
const globalEvidencePath = path.join(certificationRoot, 'global-evidence.json');
assert.equal(fs.existsSync(globalEvidencePath), true, 'failure evidence must be persisted');
const globalEvidence = JSON.parse(fs.readFileSync(globalEvidencePath, 'utf8'));
assert.equal(globalEvidence.status, 'FAIL');
assert.ok(globalEvidence.shaMismatches.length > 0 || globalEvidence.invalidEvidence.length > 0);
assert.equal(globalEvidence.conservation.fast.certified, 0);
assert.equal(globalEvidence.conservation.deep.certified, 0);
assert.ok(!globalEvidence.failures.includes('')); 

console.log(JSON.stringify({
  status: 'PASS',
  actualSha,
  corruptedSha,
  proof: {
    evidencePersistedBeforeRejection: true,
    runtimeProvenanceRejected: true,
    executionGraphFailed: graphEvidence.status === 'FAIL',
    certificationStopped: certificationFail.status !== 0,
    successCertificationNotEmitted: globalEvidence.status !== 'PASS' && globalEvidence.conservation.fast.certified === 0 && globalEvidence.conservation.deep.certified === 0,
  },
}, null, 2));

fs.rmSync(workspace, { recursive: true, force: true });
