#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const evidenceRoot = path.resolve(root, process.env.EXECUTION_EVIDENCE_ROOT ?? 'evidence');
const expectedSha = process.env.EXPECTED_SHA ?? process.env.CERTIFICATION_SHA ?? null;
const expectedRunId = process.env.GITHUB_RUN_ID ?? null;
const errors = [];
const registry = JSON.parse(fs.readFileSync(path.resolve(root, 'scripts/ci/assertion-registry.json'), 'utf8'));
const registryAssertions = registry.assertions ?? {};

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const find = (pattern) => walk(evidenceRoot).filter((file) => pattern.test(path.basename(file))).sort();

const fastFiles = find(/^browser-fast-(chromium|firefox|webkit)-([12])\.execution\.json$/);
const deepFiles = find(/^browser-deep-(chromium|firefox|webkit)-([123])\.execution\.json$/);
if (fastFiles.length !== 6) errors.push(`FAST_EXECUTION_FILE_COUNT=${fastFiles.length}; expected=6`);
if (process.env.GITHUB_EVENT_NAME !== 'pull_request' && deepFiles.length !== 9) errors.push(`DEEP_EXECUTION_FILE_COUNT=${deepFiles.length}; expected=9`);

const load = (files) => files.map((file) => {
  try { return { file, value: readJson(file), parseError: null }; }
  catch (error) { return { file, value: null, parseError: error.message }; }
});
const fast = load(fastFiles);
const deep = load(deepFiles);
const allEntries = [...fast, ...(process.env.GITHUB_EVENT_NAME !== 'pull_request' ? deep : [])];

for (const entry of allEntries) {
  const relative = path.relative(root, entry.file);
  if (entry.parseError) { errors.push(`${relative}: MALFORMED_EVIDENCE ${entry.parseError}`); continue; }
  const value = entry.value;
  if (value.evidenceClass !== 'PRIMARY_EXECUTION') errors.push(`${relative}: evidenceClass must be PRIMARY_EXECUTION`);
  if (expectedSha && value.exactSha !== expectedSha) errors.push(`${relative}: exactSha mismatch`);
  if (expectedRunId && value.runId !== expectedRunId) errors.push(`${relative}: runId mismatch`);
  if (typeof value.sourceReportSha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(value.sourceReportSha256)) errors.push(`${relative}: invalid sourceReportSha256`);
  const unitIds = new Set();
  for (const unit of value.units ?? []) {
    if (!unit.executionUnitId) errors.push(`${relative}: unit missing executionUnitId`);
    if (unitIds.has(unit.executionUnitId)) errors.push(`${relative}: duplicate executionUnitId=${unit.executionUnitId}`);
    unitIds.add(unit.executionUnitId);
    if (unit.exactSha !== expectedSha) errors.push(`${relative}: unit exactSha mismatch`);
    if (unit.runId !== expectedRunId) errors.push(`${relative}: unit runId mismatch`);
    if (!unit.spec || !unit.test) errors.push(`${relative}: unit missing spec/test`);
    if (!['CANONICAL_ASSERTION','SPEC_SURFACE'].includes(unit.executionKind)) errors.push(`${relative}: invalid executionKind=${unit.executionKind}`);
    if (!['PASS','FAIL','CANCELLED','BLOCKED','NOT_EXECUTED','MISSING_EVIDENCE','MALFORMED_EVIDENCE'].includes(unit.status)) errors.push(`${relative}: invalid unit state ${unit.status}`);

    if (unit.assertionId) {
      const canonical = registryAssertions[unit.assertionId];
      if (!canonical) errors.push(`${relative}: unknown assertionId=${unit.assertionId}`);
      else if (canonical.implementation?.kind === 'playwright-test') {
        if (canonical.implementation.spec !== unit.spec) errors.push(`${relative}: assertion/spec mismatch for ${unit.assertionId}`);
        if (canonical.implementation.test !== unit.test) errors.push(`${relative}: assertion/test mismatch for ${unit.assertionId}`);
      }
      if (unit.executionKind !== 'CANONICAL_ASSERTION') errors.push(`${relative}: assertionId requires CANONICAL_ASSERTION executionKind`);
    } else if (unit.executionKind !== 'SPEC_SURFACE') {
      errors.push(`${relative}: missing assertionId must be SPEC_SURFACE`);
    }
  }
}

const fastSpecOwners = new Map();
for (const entry of fast) {
  if (!entry.value) continue;
  const browser = entry.value.browser;
  for (const spec of new Set((entry.value.units ?? []).map((unit) => unit.spec).filter(Boolean))) {
    const key = `${browser}:${spec}`;
    const previous = fastSpecOwners.get(key);
    if (previous && previous !== entry.value.shard) errors.push(`FAST_SPEC_DUPLICATE_OWNER=${key}; shards=${previous},${entry.value.shard}`);
    fastSpecOwners.set(key, entry.value.shard);
  }
}
const expectedFastSpecs = [
  'tests/image-compressor.spec.ts', 'tests/background-remover.spec.ts', 'tests/image-upscaler.spec.ts',
  'tests/image-converter.spec.ts', 'tests/ai-image-generator.spec.ts', 'tests/object-remover.spec.ts',
  'tests/watermark-remover.spec.ts', 'tests/image-cropper.spec.ts', 'tests/image-to-svg.spec.ts',
  'tests/image-ocr.spec.ts', 'tests/photo-colorizer.spec.ts', 'tests/background-blur.spec.ts',
  'tests/passport-photo-maker.spec.ts', 'tests/watermark-adder.spec.ts', 'tests/meme-generator.spec.ts',
  'tests/collage-maker.spec.ts', 'tests/image-effects.spec.ts', 'tests/exif-cleaner.spec.ts',
  'tests/svg-optimizer.spec.ts', 'tests/mockup-generator.spec.ts', 'tests/seed.spec.ts', 'tests/pix.spec.ts',
];
for (const browser of ['chromium','firefox','webkit']) for (const spec of expectedFastSpecs) if (!fastSpecOwners.has(`${browser}:${spec}`)) errors.push(`FAST_SPEC_MISSING=${browser}:${spec}`);
for (const entry of fast) {
  if (!entry.value) continue;
  if ((entry.value.units ?? []).some((unit) => unit.status !== 'PASS')) errors.push(`${path.relative(root, entry.file)}: non-PASS execution unit`);
}

const deepLocaleSet = new Set();
const deepExecutionKeys = new Set();
for (const entry of deep) {
  if (!entry.value) continue;
  if ((entry.value.units ?? []).length === 0) errors.push(`${path.relative(root, entry.file)}: empty DEEP execution ledger`);
  for (const unit of entry.value.units ?? []) {
    const key = `${entry.value.browser}:${unit.spec}:${unit.test}`;
    if (deepExecutionKeys.has(key)) errors.push(`DEEP_DUPLICATE_EXECUTION=${key}`);
    deepExecutionKeys.add(key);
    if (unit.locale) deepLocaleSet.add(unit.locale);
    if (unit.spec !== 'tests/localization-runtime.spec.ts') errors.push(`${path.relative(root, entry.file)}: unexpected DEEP spec ${unit.spec}`);
    if (unit.status !== 'PASS') errors.push(`${path.relative(root, entry.file)}: non-PASS execution unit`);
  }
}
if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
  const expectedLocales = new Set(['en','ar','de','es','fr','it','pt','tr','ru','zh','ja','ko','nl','pl','sv','da','no','fi','cs','uk']);
  for (const locale of expectedLocales) if (!deepLocaleSet.has(locale)) errors.push(`DEEP_LOCALE_MISSING=${locale}`);
  for (const locale of deepLocaleSet) if (!expectedLocales.has(locale)) errors.push(`DEEP_UNEXPECTED_LOCALE=${locale}`);
}

const result = {
  schema_version: 2,
  status: errors.length ? 'FAIL' : 'PASS',
  exactSha: expectedSha,
  runId: expectedRunId,
  fast: { shardFiles: fastFiles.length, expectedBrowsers: 3, expectedSpecsPerBrowser: 22, certifiedSpecBrowserUnits: fastSpecOwners.size },
  deep: { shardFiles: deepFiles.length, executionRecords: deep.reduce((n, entry) => n + (entry.value?.units?.length ?? 0), 0), uniqueExecutionRecords: deepExecutionKeys.size, observedLocales: [...deepLocaleSet].sort() },
  conservation: { fastRequiredSpecBrowserUnits: 66, fastObservedSpecBrowserUnits: fastSpecOwners.size, deepShardFiles: 9, deepObservedSemanticExecutions: deepExecutionKeys.size, deepObservedLocales: deepLocaleSet.size },
  errors,
};
fs.mkdirSync(path.resolve(root, 'diagnostics', 'certification'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics', 'certification', 'execution-graph.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
