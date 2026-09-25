#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repoRoot = process.cwd();
const actualSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const corruptedSha = '0000000000000000000000000000000000000000';
const runId = `negative-control-${Date.now()}`;
assert.match(actualSha, /^[0-9a-f]{40}$/iu);
assert.notEqual(actualSha, corruptedSha);

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
  'scripts/ci/certification-engine.mjs',
  'scripts/ci/validate-execution-graph.mjs',
  'src/lib/i18n/config.ts',
]) copy(file);

const certificationRoot = path.join(workspace, 'diagnostics', 'certification');
const evidenceRoot = certificationRoot;
fs.mkdirSync(certificationRoot, { recursive: true });

const digest = (relative) => createHash('sha256').update(fs.readFileSync(path.join(workspace, relative))).digest('hex');
const writeJson = (relative, value) => {
  const target = path.join(workspace, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

const writePlaywrightReport = (mode, browser, shard) => {
  const relative = `diagnostics/certification/playwright-results/browser-${mode.toLowerCase()}-${browser}-${shard}-results.json`;
  const target = path.join(workspace, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const report = { suites: [], generatedFor: { mode, browser, shard, runId, exactSha: actualSha } };
  fs.writeFileSync(target, JSON.stringify(report) + '\n');
  return createHash('sha256').update(fs.readFileSync(target)).digest('hex');
};

const browsers = ['chromium', 'firefox', 'webkit'];
const fastSpecs = [
  'tests/image-compressor.spec.ts','tests/background-remover.spec.ts','tests/image-upscaler.spec.ts',
  'tests/image-converter.spec.ts','tests/ai-image-generator.spec.ts','tests/object-remover.spec.ts',
  'tests/watermark-remover.spec.ts','tests/image-cropper.spec.ts','tests/image-to-svg.spec.ts',
  'tests/image-ocr.spec.ts','tests/photo-colorizer.spec.ts','tests/background-blur.spec.ts',
  'tests/passport-photo-maker.spec.ts','tests/watermark-adder.spec.ts','tests/meme-generator.spec.ts',
  'tests/collage-maker.spec.ts','tests/image-effects.spec.ts','tests/exif-cleaner.spec.ts',
  'tests/svg-optimizer.spec.ts','tests/mockup-generator.spec.ts','tests/seed.spec.ts','tests/pix.spec.ts',
  'tests/mvp-agent-e2e.spec.ts',
];
const locales = ['ar','de','en','es','fr','hi','id','it','ja','ko','ms','nl','pl','pt','ru','sv','th','tr','uk','vi'];

const fastUnit = (browser, shard, spec) => ({
  executionUnitId: `FAST:${browser}:${shard}:${spec}`,
  semanticUnitId: `FAST:${browser}:${spec}`,
  assertionId: null,
  attribution: 'SURFACE_COVERAGE_ONLY',
  coverageId: `FAST:${spec}`,
  mode: 'FAST', browser, locale: null, shard, spec,
  test: 'surface coverage',
  titlePath: [path.basename(spec)],
  semanticLocale: null,
  attempt: 1,
  attempts: [{ attempt: 1, status: 'passed', durationMs: 1, errorCount: 0 }],
  status: 'PASS',
  testStatusCounts: { PASS: 1, FAIL: 0, SKIPPED: 0, NOT_EXECUTED: 0 },
  skippedTests: [],
  tests: [{ name: 'surface coverage', locale: null, status: 'PASS', attempt: 1, attempts: [{ attempt: 1, status: 'passed', durationMs: 1, errorCount: 0 }] }],
  runId, exactSha: actualSha,
});

const deepUnit = (browser, shard, locale) => ({
  executionUnitId: `DEEP:${browser}:${shard}:tests/localization-runtime.spec.ts:${locale}`,
  semanticUnitId: `DEEP:${browser}:${locale}`,
  assertionId: null,
  attribution: 'SURFACE_COVERAGE_ONLY',
  coverageId: `DEEP:tests/localization-runtime.spec.ts:${locale}`,
  mode: 'DEEP', browser, locale, shard,
  spec: 'tests/localization-runtime.spec.ts',
  test: `/${locale}/localized runtime`,
  titlePath: ['localization-runtime.spec.ts', `/${locale}/localized runtime`],
  semanticLocale: locale,
  attempt: 1,
  attempts: [{ attempt: 1, status: 'passed', durationMs: 1, errorCount: 0 }],
  status: 'PASS',
  testStatusCounts: { PASS: 1, FAIL: 0, SKIPPED: 0, NOT_EXECUTED: 0 },
  skippedTests: [],
  tests: [{ name: `/${locale}/localized runtime`, locale, status: 'PASS', attempt: 1, attempts: [{ attempt: 1, status: 'passed', durationMs: 1, errorCount: 0 }] }],
  runId, exactSha: actualSha,
});

for (const browser of browsers) {
  const parts = [fastSpecs.slice(0, 11), fastSpecs.slice(11)];
  parts.forEach((specs, index) => {
    const shard = index + 1;
    const sourceReportSha256 = writePlaywrightReport('FAST', browser, shard);
    writeJson(`diagnostics/certification/browser-fast-${browser}-${shard}.json`, {
      schema_version: 5, evidenceClass: 'PRIMARY_EXECUTION', mode: 'FAST', browser, shard, runId,
      exactSha: actualSha, sourceReportSha256, status: 'PASS', toolSpecs: fastSpecs.length,
      expectedSpecCount: specs.length, executedSpecCount: specs.length, unexpectedSpecs: [], executionUnitCount: specs.length,
      skippedTestCount: 0, failedTestCount: 0, notExecutedTestCount: 0,
      statusCounts: { PASS: specs.length, FAIL: 0, SKIPPED: 0, CANCELLED: 0, BLOCKED: 0, NOT_EXECUTED: 0 },
      attribution: { canonicalAssertionIds: [], canonicalAssertionExecutionCount: 0, surfaceCoverageExecutionCount: specs.length, uniqueCoverageIds: specs.map((spec) => `FAST:${spec}`) },
      semanticCoverage: { model: `${fastSpecs.length} specs × 3 browsers = ${fastSpecs.length * browsers.length} semantic spec-browser units`, plannedSemanticUnitCount: fastSpecs.length, semanticUnitCount: specs.length, semanticUnitIds: specs.map((spec) => `FAST:${browser}:${spec}`), localeRegistryCount: 20, observedLocaleCount: 0, observedLocales: [], unexpectedLocales: [], partition: true, partitionCount: 2, partitionIndex: shard },
      complete: true,
      units: specs.map((spec) => fastUnit(browser, shard, spec)),
    });
  });
}

for (const browser of browsers) {
  const parts = [locales.slice(0, 3), locales.slice(3, 6), locales.slice(6, 9), locales.slice(9, 12), locales.slice(12, 15), locales.slice(15, 18), locales.slice(18)];
  parts.forEach((group, index) => {
    const shard = index + 1;
    const sourceReportSha256 = writePlaywrightReport('DEEP', browser, shard);
    writeJson(`diagnostics/certification/browser-deep-${browser}-${shard}.json`, {
      schema_version: 5, evidenceClass: 'PRIMARY_EXECUTION', mode: 'DEEP', browser, shard, runId,
      exactSha: actualSha, sourceReportSha256: '0'.repeat(64), status: 'PASS', locales: 20,
      expectedSpecCount: 1, executedSpecCount: 1, unexpectedSpecs: [], executionUnitCount: group.length,
      skippedTestCount: 0, failedTestCount: 0, notExecutedTestCount: 0,
      statusCounts: { PASS: group.length, FAIL: 0, SKIPPED: 0, CANCELLED: 0, BLOCKED: 0, NOT_EXECUTED: 0 },
      attribution: { canonicalAssertionIds: [], canonicalAssertionExecutionCount: 0, surfaceCoverageExecutionCount: group.length, uniqueCoverageIds: group.map((locale) => `DEEP:${locale}`) },
      semanticCoverage: { model: '20 locales × 3 browsers = 60 semantic locale-browser units', plannedSemanticUnitCount: 20, semanticUnitCount: group.length, semanticUnitIds: group.map((locale) => `DEEP:${browser}:${locale}`), localeRegistryCount: 20, observedLocaleCount: group.length, observedLocales: group, unexpectedLocales: [], partition: true, partitionCount: 7, partitionIndex: shard },
      complete: true,
      units: group.map((locale) => deepUnit(browser, shard, locale)),
    });
  });
}

writeJson('evidence/static-build/run-identity.json', {
  schemaVersion: 2, evidenceClass: 'PRIMARY_EXECUTION',
  contractVersion: 'CLOSURE NEGATIVE CONTROL TEST', sha: actualSha,
  workflowSha256: digest('.github/workflows/ci.yml'),
  testPlanSha256: digest('scripts/ci/test-plan.json'),
  assertionRegistrySha256: digest('scripts/ci/assertion-registry.json'),
  packageLockSha256: digest('package-lock.json'),
  runtime: { node: process.version, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim() },
  runId, workflowName: 'FLIXO Test System', eventName: 'test',
});
writeJson('evidence/static-build/static.json', { evidenceClass: 'PRIMARY_EXECUTION', status: 'PASS', sha: actualSha });
writeJson('evidence/static-build/build.json', { evidenceClass: 'PRIMARY_EXECUTION', status: 'PASS', sha: actualSha });
writeJson('certification-run-manifest.json', {
  schema_version: 4, sha: actualSha, workflow_run_id: runId, workflow: 'FLIXO Test System',
  jobs: { static: 'success', build: 'success', browserFast: 'success', browserDeep: 'success' },
  required: { matrixFirstUnits: fastSpecs.length * browsers.length, fullMatrixLocales: 20, browsers: 3 },
});

const runNode = (script, env) => spawnSync(process.execPath, [script], {
  cwd: workspace, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
const cleanEnv = { EXPECTED_SHA: actualSha, GITHUB_RUN_ID: runId, EXECUTION_EVIDENCE_ROOT: 'diagnostics/certification', CERTIFICATION_SHA: actualSha, GITHUB_EVENT_NAME: 'test', GITHUB_WORKFLOW: 'FLIXO Test System' };

const graphPass = runNode('scripts/ci/validate-execution-graph.mjs', cleanEnv);
assert.equal(graphPass.status, 0, `positive graph validation failed:\n${graphPass.stdout}\n${graphPass.stderr}`);

const graphPath = path.join(certificationRoot, 'execution-graph.json');
const graphBaseline = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

const certPass = runNode('scripts/ci/certification-engine.mjs', cleanEnv);
assert.equal(certPass.status, 0, `canonical certification engine rejected clean evidence:\n${certPass.stdout}\n${certPass.stderr}`);
const cleanCertification = JSON.parse(fs.readFileSync(path.join(certificationRoot, 'certification.json'), 'utf8'));
assert.equal(cleanCertification.authority, 'CANONICAL_CERTIFICATION_ENGINE');
assert.equal(cleanCertification.status, 'PASS');


const target = path.join(evidenceRoot, 'browser-fast', 'browser-fast-chromium-1.json');
const mutated = JSON.parse(fs.readFileSync(target, 'utf8'));
mutated.exactSha = corruptedSha;
mutated.units[0].exactSha = corruptedSha;
fs.writeFileSync(target, `${JSON.stringify(mutated, null, 2)}\n`);
assert.equal(JSON.parse(fs.readFileSync(target, 'utf8')).exactSha, corruptedSha);

const graphFail = runNode('scripts/ci/validate-execution-graph.mjs', cleanEnv);
assert.notEqual(graphFail.status, 0, 'corrupted provenance must fail graph validation');
const graphEvidence = JSON.parse(fs.readFileSync(path.join(certificationRoot, 'execution-graph.json'), 'utf8'));
assert.equal(graphEvidence.status, 'FAIL');
assert.ok(graphEvidence.errors.some((error) => error.includes('exactSha mismatch')));
assert.equal(graphEvidence.exactSha, actualSha);

const certFail = runNode('scripts/ci/certification-engine.mjs', cleanEnv);
assert.notEqual(certFail.status, 0, 'canonical certification engine must fail closed on corrupted evidence');
const rejectedCertification = JSON.parse(fs.readFileSync(path.join(certificationRoot, 'certification.json'), 'utf8'));
assert.equal(rejectedCertification.authority, 'CANONICAL_CERTIFICATION_ENGINE');
assert.equal(rejectedCertification.status, 'FAIL');
assert.ok(rejectedCertification.errors.some((error) => /execution-graph revalidation failed|executionGraph\.(status|exactSha)/u.test(error)));

const directCertificationMutations = [
  ['GRAPH_STATUS_FAIL', (graph) => { graph.status = 'FAIL'; graph.errors = ['INJECTED_GRAPH_FAILURE']; }],
  ['EXACT_SHA_MISMATCH', (graph) => { graph.exactSha = corruptedSha; }],
  ['RUN_ID_MISMATCH', (graph) => { graph.runId = 'stale-run-id'; }],
  ['FAST_UNDERCOVERAGE', (graph) => { graph.fast.observedSemanticUnits = 68; }],
  ['DEEP_UNDERCOVERAGE', (graph) => { graph.deep.semanticLocaleBrowserUnits = 59; }],
  ['LOCALE_UNDERCOVERAGE', (graph) => { graph.deep.semanticLocaleCount = 19; }],
  ['FAST_CONSERVATION_FAIL', (graph) => { graph.conservation.fast.status = 'FAIL'; }],
  ['DEEP_CONSERVATION_FAIL', (graph) => { graph.conservation.deepSemanticLocaleBrowser.status = 'FAIL'; }],
];

for (const [id, mutate] of directCertificationMutations) {
  const mutatedGraph = structuredClone(graphBaseline);
  mutate(mutatedGraph);
  fs.writeFileSync(graphPath, `${JSON.stringify(mutatedGraph, null, 2)}\n`);
  const result = runNode('scripts/ci/certification-engine.mjs', cleanEnv);
  assert.notEqual(result.status, 0, `canonical certification mutation escaped: ${id}`);
  const certification = JSON.parse(fs.readFileSync(path.join(certificationRoot, 'certification.json'), 'utf8'));
  assert.equal(certification.authority, 'CANONICAL_CERTIFICATION_ENGINE');
  assert.equal(certification.status, 'FAIL', `canonical certification mutation falsely passed: ${id}`);
}
fs.writeFileSync(graphPath, `${JSON.stringify(graphBaseline, null, 2)}\n`);

const artifactToRemove = path.join(evidenceRoot, 'browser-fast', 'browser-fast-chromium-1.json');
const artifactBackup = fs.readFileSync(artifactToRemove);
fs.rmSync(artifactToRemove);
const artifactCountFail = runNode('scripts/ci/certification-engine.mjs', cleanEnv);
assert.notEqual(artifactCountFail.status, 0, 'canonical certification must fail when a required browser evidence artifact is missing');
const artifactCertification = JSON.parse(fs.readFileSync(path.join(certificationRoot, 'certification.json'), 'utf8'));
assert.equal(artifactCertification.status, 'FAIL');
assert.ok(artifactCertification.errors.some((error) => /primaryBrowserEvidence=26; expected=27/u.test(error)));
fs.writeFileSync(artifactToRemove, artifactBackup);

console.log(JSON.stringify({
  status: 'PASS', actualSha, corruptedSha,
  proof: {
    cleanCanonicalCertificationPass: true,
    executionGraphRejectedCorruption: true,
    canonicalCertificationRejectedCorruption: true,
    canonicalCertificationAdversarialMutations: directCertificationMutations.length + 1,
    noSuccessCertificationOnMutation: true,
  },
}, null, 2));

console.log(JSON.stringify({
  status: 'PASS', actualSha, corruptedSha,
  proof: {
    evidencePersistedBeforeRejection: true,
    executionGraphRejectedCorruption: true,
    certificationStopped: true,
    noSuccessCertification: true,
  },
}, null, 2));

fs.rmSync(workspace, { recursive: true, force: true });
