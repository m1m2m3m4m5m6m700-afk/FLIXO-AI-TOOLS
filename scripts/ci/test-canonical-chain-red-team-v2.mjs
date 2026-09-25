#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const expectedSha = process.env.EXPECTED_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const runId = 'redteam-chain-v2-' + expectedSha.slice(0, 12);
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-canonical-chain-redteam-v2-'));

const copy = (relative) => {
  const source = path.join(repoRoot, relative);
  const destination = path.join(workspace, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};

for (const file of [
  'scripts/ci/validate-execution-graph.mjs',
  'scripts/ci/certification-engine.mjs',
  'scripts/ci/assertion-registry.json',
  'src/lib/i18n/config.ts',
]) copy(file);

const evidenceRoot = path.join(workspace, 'diagnostics', 'certification');
fs.mkdirSync(evidenceRoot, { recursive: true });

const writeJson = (relative, value) => {
  const target = path.join(workspace, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n');
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
  mode: 'FAST',
  browser,
  locale: null,
  shard,
  spec,
  test: 'surface coverage',
  titlePath: [path.basename(spec)],
  semanticLocale: null,
  attempt: 1,
  attempts: [{ attempt: 1, status: 'passed', durationMs: 1, errorCount: 0 }],
  status: 'PASS',
  testStatusCounts: { PASS: 1, FAIL: 0, SKIPPED: 0, NOT_EXECUTED: 0 },
  skippedTests: [],
  tests: [{ name: 'surface coverage', locale: null, status: 'PASS', attempt: 1, attempts: [{ attempt: 1, status: 'passed', durationMs: 1, errorCount: 0 }] }],
  runId,
  exactSha: expectedSha,
});

const deepUnit = (browser, shard, locale) => ({
  executionUnitId: `DEEP:${browser}:${shard}:tests/localization-runtime.spec.ts:${locale}`,
  semanticUnitId: `DEEP:${browser}:${locale}`,
  assertionId: null,
  attribution: 'SURFACE_COVERAGE_ONLY',
  coverageId: `DEEP:tests/localization-runtime.spec.ts:${locale}`,
  mode: 'DEEP',
  browser,
  locale,
  shard,
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
  runId,
  exactSha: expectedSha,
});

for (const browser of browsers) {
  const parts = [fastSpecs.slice(0, 11), fastSpecs.slice(11)];
  parts.forEach((specs, index) => {
    const shard = index + 1;
    writeJson(`diagnostics/certification/browser-fast-${browser}-${shard}.json`, {
      schema_version: 5,
      evidenceClass: 'PRIMARY_EXECUTION',
      mode: 'FAST',
      browser,
      shard,
      runId,
      exactSha: expectedSha,
      sourceReportSha256: '0'.repeat(64),
      status: 'PASS',
      toolSpecs: 23,
      expectedSpecCount: specs.length,
      executedSpecCount: specs.length,
      unexpectedSpecs: [],
      executionUnitCount: specs.length,
      skippedTestCount: 0,
      failedTestCount: 0,
      notExecutedTestCount: 0,
      statusCounts: { PASS: specs.length, FAIL: 0, SKIPPED: 0, CANCELLED: 0, BLOCKED: 0, NOT_EXECUTED: 0 },
      semanticCoverage: { plannedSemanticUnitCount: 23, semanticUnitCount: specs.length, semanticUnitIds: specs.map((spec) => `FAST:${browser}:${spec}`), localeRegistryCount: 20, observedLocaleCount: 0, observedLocales: [], unexpectedLocales: [], partition: true, partitionCount: 2, partitionIndex: shard },
      complete: true,
      units: specs.map((spec) => fastUnit(browser, shard, spec)),
    });
  });
}

for (const browser of browsers) {
  const parts = [locales.slice(0, 3), locales.slice(3, 6), locales.slice(6, 9), locales.slice(9, 12), locales.slice(12, 15), locales.slice(15, 18), locales.slice(18)];
  parts.forEach((group, index) => {
    const shard = index + 1;
    writeJson(`diagnostics/certification/browser-deep-${browser}-${shard}.json`, {
      schema_version: 5,
      evidenceClass: 'PRIMARY_EXECUTION',
      mode: 'DEEP',
      browser,
      shard,
      runId,
      exactSha: expectedSha,
      sourceReportSha256: '0'.repeat(64),
      status: 'PASS',
      locales: 20,
      expectedSpecCount: 1,
      executedSpecCount: 1,
      unexpectedSpecs: [],
      executionUnitCount: group.length,
      skippedTestCount: 0,
      failedTestCount: 0,
      notExecutedTestCount: 0,
      statusCounts: { PASS: group.length, FAIL: 0, SKIPPED: 0, CANCELLED: 0, BLOCKED: 0, NOT_EXECUTED: 0 },
      semanticCoverage: { plannedSemanticUnitCount: 20, semanticUnitCount: group.length, semanticUnitIds: group.map((locale) => `DEEP:${browser}:${locale}`), localeRegistryCount: 20, observedLocaleCount: group.length, observedLocales: group, unexpectedLocales: [], partition: true, partitionCount: 7, partitionIndex: shard },
      complete: true,
      units: group.map((locale) => deepUnit(browser, shard, locale)),
    });
  });
}

const env = {
  ...process.env,
  EXPECTED_SHA: expectedSha,
  CERTIFICATION_SHA: expectedSha,
  GITHUB_SHA: expectedSha,
  GITHUB_RUN_ID: runId,
  EXECUTION_EVIDENCE_ROOT: 'diagnostics/certification',
};

const run = (script) => spawnSync(process.execPath, [script], {
  cwd: workspace,
  env,
  encoding: 'utf8',
  timeout: 120000,
});

const graphPath = path.join(evidenceRoot, 'execution-graph.json');
const certificationPath = path.join(evidenceRoot, 'certification.json');

const baselineGraph = run('scripts/ci/validate-execution-graph.mjs');
assert.equal(baselineGraph.status, 0, `baseline graph validation failed:\n${baselineGraph.stdout}\n${baselineGraph.stderr}`);
assert.equal(run('scripts/ci/certification-engine.mjs').status, 0, 'baseline canonical certification must PASS');
assert.equal(JSON.parse(fs.readFileSync(certificationPath, 'utf8')).status, 'PASS');

const restoreFast = () => {
  const file = path.join(evidenceRoot, 'browser-fast-chromium-1.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const attacks = [
  {
    id: 'POST_VALIDATION_EVIDENCE_STATUS_RACE',
    mutate() {
      const file = path.join(evidenceRoot, 'browser-fast-chromium-1.json');
      const value = restoreFast();
      value.status = 'FAIL';
      fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
    },
  },
  {
    id: 'FORGED_GRAPH_MASKS_BAD_SHA',
    mutate() {
      const file = path.join(evidenceRoot, 'browser-fast-chromium-1.json');
      const value = restoreFast();
      value.exactSha = '0'.repeat(40);
      value.units[0].exactSha = '0'.repeat(40);
      fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

      const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      graph.status = 'PASS';
      graph.exactSha = expectedSha;
      graph.runId = runId;
      graph.errors = [];
      fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + '\n');
    },
  },
  {
    id: 'MALFORMED_EVIDENCE_MASKED_BY_FORGED_GRAPH',
    mutate() {
      const file = path.join(evidenceRoot, 'browser-deep-firefox-7.json');
      fs.writeFileSync(file, '{ this is not json }\n');
      const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      graph.status = 'PASS';
      graph.exactSha = expectedSha;
      graph.runId = runId;
      graph.errors = [];
      fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + '\n');
    },
  },
  {
    id: 'MISSING_ARTIFACT_MASKED_BY_FORGED_GRAPH',
    mutate() {
      fs.rmSync(path.join(evidenceRoot, 'browser-fast-webkit-2.json'));
      const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      graph.status = 'PASS';
      graph.exactSha = expectedSha;
      graph.runId = runId;
      graph.fast.shardFiles = 6;
      graph.deep.shardFiles = 21;
      graph.errors = [];
      fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + '\n');
    },
  },
  {
    id: 'DUPLICATE_SEMANTIC_MASKED_BY_FORGED_GRAPH',
    mutate() {
      const file = path.join(evidenceRoot, 'browser-deep-chromium-1.json');
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      value.units[0].semanticUnitId = value.units[1].semanticUnitId;
      fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
      const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      graph.status = 'PASS';
      graph.exactSha = expectedSha;
      graph.runId = runId;
      graph.errors = [];
      fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + '\n');
    },
  },
  {
    id: 'CANCELLED_UNIT_MASKED_BY_FORGED_GRAPH',
    mutate() {
      const file = path.join(evidenceRoot, 'browser-fast-firefox-2.json');
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      value.units[0].status = 'CANCELLED';
      fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
      const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      graph.status = 'PASS';
      graph.exactSha = expectedSha;
      graph.runId = runId;
      graph.errors = [];
      fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + '\n');
    },
  },
  {
    id: 'WRONG_RUN_ID_MASKED_BY_FORGED_GRAPH',
    mutate() {
      const file = path.join(evidenceRoot, 'browser-fast-firefox-1.json');
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      value.runId = 'stale-run';
      value.units[0].runId = 'stale-run';
      fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
      const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      graph.status = 'PASS';
      graph.exactSha = expectedSha;
      graph.runId = runId;
      graph.errors = [];
      fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + '\n');
    },
  },
];

const rebuildFixture = () => {
  fs.rmSync(evidenceRoot, { recursive: true, force: true });
  fs.mkdirSync(evidenceRoot, { recursive: true });
  for (const browser of browsers) {
    const fastParts = [fastSpecs.slice(0, 11), fastSpecs.slice(11)];
    fastParts.forEach((specs, index) => {
      const shard = index + 1;
      writeJson(`diagnostics/certification/browser-fast-${browser}-${shard}.json`, {
        schema_version: 5, evidenceClass: 'PRIMARY_EXECUTION', mode: 'FAST', browser, shard, runId,
        exactSha: expectedSha, sourceReportSha256: '0'.repeat(64), status: 'PASS',
        toolSpecs: 23, expectedSpecCount: specs.length, executedSpecCount: specs.length, unexpectedSpecs: [],
        executionUnitCount: specs.length, skippedTestCount: 0, failedTestCount: 0, notExecutedTestCount: 0,
        statusCounts: { PASS: specs.length, FAIL: 0, SKIPPED: 0, CANCELLED: 0, BLOCKED: 0, NOT_EXECUTED: 0 },
        semanticCoverage: { plannedSemanticUnitCount: 23, semanticUnitCount: specs.length, semanticUnitIds: specs.map((spec) => `FAST:${browser}:${spec}`), localeRegistryCount: 20, observedLocaleCount: 0, observedLocales: [], unexpectedLocales: [], partition: true, partitionCount: 2, partitionIndex: shard },
        complete: true, units: specs.map((spec) => fastUnit(browser, shard, spec)),
      });
    });
    const deepParts = [locales.slice(0, 3), locales.slice(3, 6), locales.slice(6, 9), locales.slice(9, 12), locales.slice(12, 15), locales.slice(15, 18), locales.slice(18)];
    deepParts.forEach((group, index) => {
      const shard = index + 1;
      writeJson(`diagnostics/certification/browser-deep-${browser}-${shard}.json`, {
        schema_version: 5, evidenceClass: 'PRIMARY_EXECUTION', mode: 'DEEP', browser, shard, runId,
        exactSha: expectedSha, sourceReportSha256: '0'.repeat(64), status: 'PASS', locales: 20,
        expectedSpecCount: 1, executedSpecCount: 1, unexpectedSpecs: [], executionUnitCount: group.length,
        skippedTestCount: 0, failedTestCount: 0, notExecutedTestCount: 0,
        statusCounts: { PASS: group.length, FAIL: 0, SKIPPED: 0, CANCELLED: 0, BLOCKED: 0, NOT_EXECUTED: 0 },
        semanticCoverage: { plannedSemanticUnitCount: 20, semanticUnitCount: group.length, semanticUnitIds: group.map((locale) => `DEEP:${browser}:${locale}`), localeRegistryCount: 20, observedLocaleCount: group.length, observedLocales: group, unexpectedLocales: [], partition: true, partitionCount: 7, partitionIndex: shard },
        complete: true, units: group.map((locale) => deepUnit(browser, shard, locale)),
      });
    });
  }
  const rebuilt = run('scripts/ci/validate-execution-graph.mjs');
  assert.equal(rebuilt.status, 0, `fixture rebuild failed:\n${rebuilt.stdout}\n${rebuilt.stderr}`);
};

const escaped = [];
for (const attack of attacks) {
  attack.mutate();
  const result = run('scripts/ci/certification-engine.mjs');
  const certification = fs.existsSync(certificationPath)
    ? JSON.parse(fs.readFileSync(certificationPath, 'utf8'))
    : null;
  const blocked = result.status !== 0 &&
    certification?.status === 'FAIL' &&
    certification?.authority === 'CANONICAL_CERTIFICATION_ENGINE';
  if (!blocked) escaped.push({
    id: attack.id,
    exitCode: result.status,
    certification,
    stdoutTail: String(result.stdout ?? '').slice(-1200),
    stderrTail: String(result.stderr ?? '').slice(-1200),
  });
  rebuildFixture();
}

fs.rmSync(workspace, { recursive: true, force: true });

console.log(JSON.stringify({
  status: escaped.length === 0 ? 'PASS' : 'FAIL',
  protocol: 'FLIXO-CANONICAL-CHAIN-REDTEAM-v2',
  exactSha: expectedSha,
  attackCount: attacks.length,
  blockedAttacks: attacks.length - escaped.length,
  escapedAttacks: escaped.length,
  attacks: attacks.map(({ id }) => id),
  escaped,
}, null, 2));

if (escaped.length) process.exit(1);
