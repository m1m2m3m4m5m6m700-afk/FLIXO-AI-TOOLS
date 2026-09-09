#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const evidenceRoot = path.resolve(root, process.env.EXECUTION_EVIDENCE_ROOT ?? 'evidence');
const expectedSha = process.env.EXPECTED_SHA ?? process.env.CERTIFICATION_SHA ?? null;
const expectedRunId = process.env.GITHUB_RUN_ID ?? null;
const errors = [];

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const find = (pattern) => walk(evidenceRoot).filter((file) => pattern.test(path.basename(file))).sort();
const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');

const registryPath = path.resolve(root, 'scripts/ci/assertion-registry.json');
if (!fs.existsSync(registryPath)) errors.push('ASSERTION_REGISTRY_MISSING');
const registry = fs.existsSync(registryPath) ? readJson(registryPath) : { assertions: {} };
const registryByImplementation = new Map();
for (const [assertionId, entry] of Object.entries(registry.assertions ?? {})) {
  const implementation = entry?.implementation;
  if (implementation?.kind === 'playwright-test' && implementation.spec && implementation.test) {
    registryByImplementation.set(`${normalize(implementation.spec)}\u0000${implementation.test}`, assertionId);
  }
}
const registeredAssertionIds = new Set(Object.keys(registry.assertions ?? {}));

const fastFiles = find(/^browser-fast-(chromium|firefox|webkit)-([12])\.json$/);
const deepFiles = find(/^browser-deep-(chromium|firefox|webkit)-([123])\.json$/);
if (fastFiles.length !== 6) errors.push(`FAST_EXECUTION_FILE_COUNT=${fastFiles.length}; expected=6`);
if (process.env.GITHUB_EVENT_NAME !== 'pull_request' && deepFiles.length !== 9) errors.push(`DEEP_EXECUTION_FILE_COUNT=${deepFiles.length}; expected=9`);

const load = (files) => files.map((file) => {
  try { return { file, value: readJson(file), parseError: null }; }
  catch (error) { return { file, value: null, parseError: error.message }; }
});
const fast = load(fastFiles);
const deep = load(deepFiles);
const included = [...fast, ...(process.env.GITHUB_EVENT_NAME !== 'pull_request' ? deep : [])];

for (const entry of included) {
  const relative = path.relative(root, entry.file);
  if (entry.parseError) { errors.push(`${relative}: MALFORMED_EVIDENCE ${entry.parseError}`); continue; }
  const value = entry.value;
  if (value.evidenceClass !== 'PRIMARY_EXECUTION') errors.push(`${relative}: evidenceClass must be PRIMARY_EXECUTION`);
  if (expectedSha && value.exactSha !== expectedSha) errors.push(`${relative}: exactSha mismatch`);
  if (expectedRunId && value.runId !== expectedRunId) errors.push(`${relative}: runId mismatch`);
  if (value.executionUnitCount !== (value.units ?? []).length) errors.push(`${relative}: executionUnitCount mismatch`);
  if (value.status !== 'PASS') errors.push(`${relative}: execution status=${value.status}`);
  if (value.complete !== true) errors.push(`${relative}: execution ledger is not complete`);
  const unitIds = new Set();
  for (const unit of value.units ?? []) {
    if (unitIds.has(unit.executionUnitId)) errors.push(`${relative}: duplicate executionUnitId=${unit.executionUnitId}`);
    unitIds.add(unit.executionUnitId);
    if (unit.exactSha !== expectedSha) errors.push(`${relative}: unit exactSha mismatch`);
    if (unit.runId !== expectedRunId) errors.push(`${relative}: unit runId mismatch`);
    if (!unit.spec || !unit.test) errors.push(`${relative}: unit missing spec/test`);
    if (!Array.isArray(unit.attempts) || unit.attempts.length === 0) errors.push(`${relative}: unit missing attempt evidence`);
    if (!['PASS','FAIL','CANCELLED','BLOCKED','NOT_EXECUTED','MISSING_EVIDENCE','MALFORMED_EVIDENCE'].includes(unit.status)) errors.push(`${relative}: invalid unit state ${unit.status}`);
    if (unit.assertionId !== null && unit.assertionId !== undefined) {
      if (!registeredAssertionIds.has(unit.assertionId)) errors.push(`${relative}: unknown assertionId=${unit.assertionId}`);
      const canonical = registryByImplementation.get(`${normalize(unit.spec)}\u0000${unit.test}`) ?? null;
      if (canonical !== unit.assertionId) errors.push(`${relative}: assertion attribution mismatch for ${unit.spec} :: ${unit.test}; ledger=${unit.assertionId}; registry=${canonical}`);
      if (unit.attribution !== 'CANONICAL_IMPLEMENTATION_MATCH') errors.push(`${relative}: canonical assertion requires CANONICAL_IMPLEMENTATION_MATCH`);
    } else if (unit.attribution !== 'SURFACE_COVERAGE_ONLY') {
      errors.push(`${relative}: unattributed unit must be marked SURFACE_COVERAGE_ONLY`);
    }
    if (unit.mode === 'FAST' && unit.semanticUnitId !== `FAST:${unit.browser}:${normalize(unit.spec)}`) errors.push(`${relative}: invalid FAST semanticUnitId for ${unit.spec}`);
    if (unit.mode === 'DEEP' && unit.semanticUnitId !== `DEEP:${unit.browser}:${unit.semanticLocale}`) errors.push(`${relative}: invalid DEEP semanticUnitId for ${unit.browser}:${unit.semanticLocale ?? '<no-locale>'}`);
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
const fastSemanticOwners = new Map();
for (const entry of fast) {
  if (!entry.value) continue;
  for (const unit of entry.value.units ?? []) {
    const semanticId = unit.semanticUnitId;
    if (!semanticId) { errors.push(`FAST_SEMANTIC_UNIT_MISSING=${entry.value.browser}:${unit.spec}`); continue; }
    const key = `${entry.value.browser}:${semanticId}`;
    const previous = fastSemanticOwners.get(key);
    if (previous && previous !== entry.value.shard) errors.push(`FAST_SEMANTIC_DUPLICATE_OWNER=${key}; shards=${previous},${entry.value.shard}`);
    fastSemanticOwners.set(key, entry.value.shard);
  }
}
for (const browser of ['chromium','firefox','webkit']) for (const spec of expectedFastSpecs) {
  const key = `${browser}:FAST:${browser}:${spec}`;
  if (!fastSemanticOwners.has(key)) errors.push(`FAST_SEMANTIC_MISSING=${key}`);
}
if (fastSemanticOwners.size !== 66) errors.push(`FAST_CONSERVATION=${fastSemanticOwners.size}; expected=66 semantic spec-browser units`);

const deepSemanticOwners = new Map();
const deepExecutionKeys = new Set();
const deepLocales = new Set();
for (const entry of deep) {
  if (!entry.value) continue;
  const units = entry.value.units ?? [];
  if (!units.length) errors.push(`${path.relative(root, entry.file)}: empty DEEP execution ledger`);
  for (const unit of units) {
    if (unit.status !== 'PASS') errors.push(`${path.relative(root, entry.file)}: non-PASS execution unit`);
    if (unit.semanticLocale) deepLocales.add(unit.semanticLocale);
    if (unit.semanticUnitId) {
      const key = `${entry.value.browser}:${unit.semanticUnitId}`;
      const previous = deepSemanticOwners.get(key);
      if (previous && previous !== entry.value.shard) errors.push(`DEEP_SEMANTIC_DUPLICATE_OWNER=${key}; shards=${previous},${entry.value.shard}`);
      deepSemanticOwners.set(key, entry.value.shard);
    }
    const executionKey = `${entry.value.browser}:${unit.spec}:${unit.test}:${unit.semanticLocale ?? '<no-locale>'}`;
    if (deepExecutionKeys.has(executionKey)) errors.push(`DEEP_DUPLICATE_EXECUTION=${executionKey}`);
    deepExecutionKeys.add(executionKey);
  }
}
const localeSource = fs.readFileSync(path.resolve(root, 'src/lib/i18n/config.ts'), 'utf8');
const localeArray = localeSource.match(/LOCALES\s*=\s*\[([\s\S]*?)\]/u)?.[1] ?? '';
const expectedLocales = [...localeArray.matchAll(/['"]([a-z]{2,3})['"]/giu)].map((match) => match[1].toLowerCase());
if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
  for (const browser of ['chromium','firefox','webkit']) for (const locale of expectedLocales) {
    const key = `${browser}:DEEP:${browser}:${locale}`;
    if (!deepSemanticOwners.has(key)) errors.push(`DEEP_SEMANTIC_MISSING=${key}`);
  }
  if (deepSemanticOwners.size !== expectedLocales.length * 3) errors.push(`DEEP_SEMANTIC_CONSERVATION=${deepSemanticOwners.size}; expected=${expectedLocales.length * 3} locale-browser units`);
  for (const locale of expectedLocales) if (!deepLocales.has(locale)) errors.push(`DEEP_LOCALE_MISSING=${locale}`);
  for (const locale of deepLocales) if (!expectedLocales.includes(locale)) errors.push(`DEEP_LOCALE_UNEXPECTED=${locale}`);
}

const result = {
  schema_version: 4,
  status: errors.length ? 'FAIL' : 'PASS',
  exactSha: expectedSha,
  runId: expectedRunId,
  registryAssertionCount: registeredAssertionIds.size,
  fast: { shardFiles: fastFiles.length, expectedBrowsers: 3, expectedSpecsPerBrowser: 22, requiredSemanticUnits: 66, observedSemanticUnits: fastSemanticOwners.size },
  deep: { shardFiles: deepFiles.length, executionRecords: deepExecutionKeys.size, semanticLocaleBrowserUnits: deepSemanticOwners.size, expectedSemanticLocaleBrowserUnits: expectedLocales.length * 3, semanticLocaleCount: deepLocales.size, expectedLocaleCount: expectedLocales.length, observedLocales: [...deepLocales].sort() },
  conservation: {
    fast: { required: 66, observed: fastSemanticOwners.size, status: fastSemanticOwners.size === 66 ? 'PASS' : 'FAIL' },
    deepSemanticLocaleBrowser: { required: expectedLocales.length * 3, observed: deepSemanticOwners.size, status: deepSemanticOwners.size === expectedLocales.length * 3 ? 'PASS' : 'FAIL' },
  },
  attribution: {
    canonicalExecutionUnits: included.flatMap((entry) => entry.value?.units ?? []).filter((unit) => unit.assertionId).length,
    surfaceCoverageOnlyUnits: included.flatMap((entry) => entry.value?.units ?? []).filter((unit) => !unit.assertionId).length,
  },
  errors,
};
fs.mkdirSync(path.resolve(root, 'diagnostics', 'certification'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics', 'certification', 'execution-graph.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
