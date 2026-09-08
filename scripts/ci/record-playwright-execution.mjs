#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith('--')) continue;
  const [key, value] = token.slice(2).split('=');
  args.set(key, value ?? process.argv[i + 1] ?? null);
}

const mode = String(args.get('mode') ?? '').toUpperCase();
const browser = String(args.get('browser') ?? process.env.BROWSER ?? '');
const shard = Number(args.get('shard') ?? process.env.SHARD ?? 0);
const runId = process.env.GITHUB_RUN_ID ?? null;
const exactSha = process.env.EXPECTED_SHA ?? null;
const reportPath = String(args.get('report') ?? 'playwright-report/results.json');
const outputPath = String(args.get('output') ?? `diagnostics/certification/${mode === 'DEEP' ? 'browser-deep' : 'browser-fast'}-${browser}-${shard}.json`);
const registryPath = 'scripts/ci/assertion-registry.json';

if (!['FAST', 'DEEP'].includes(mode)) throw new Error(`Invalid --mode: ${mode}`);
if (!browser) throw new Error('Browser is required');
if (!Number.isInteger(shard) || shard < 1) throw new Error(`Invalid shard: ${shard}`);
if (!fs.existsSync(reportPath)) throw new Error(`Missing Playwright report: ${reportPath}`);
if (!fs.existsSync(registryPath)) throw new Error(`Missing assertion registry: ${registryPath}`);

const expectedFastSpecs = [
  'tests/image-compressor.spec.ts','tests/background-remover.spec.ts','tests/image-upscaler.spec.ts','tests/image-converter.spec.ts',
  'tests/ai-image-generator.spec.ts','tests/object-remover.spec.ts','tests/watermark-remover.spec.ts','tests/image-cropper.spec.ts',
  'tests/image-to-svg.spec.ts','tests/image-ocr.spec.ts','tests/photo-colorizer.spec.ts','tests/background-blur.spec.ts',
  'tests/passport-photo-maker.spec.ts','tests/watermark-adder.spec.ts','tests/meme-generator.spec.ts','tests/collage-maker.spec.ts',
  'tests/image-effects.spec.ts','tests/exif-cleaner.spec.ts','tests/svg-optimizer.spec.ts','tests/mockup-generator.spec.ts',
  'tests/seed.spec.ts','tests/pix.spec.ts',
];
const expectedDeepSpec = 'tests/localization-runtime.spec.ts';
const localeSource = fs.readFileSync('src/lib/i18n/config.ts', 'utf8');
const localeArray = localeSource.match(/LOCALES\s*=\s*\[([\s\S]*?)\]/u)?.[1] ?? '';
const localeCodes = [...localeArray.matchAll(/["']([a-z]{2,3})["']/giu)].map((match) => match[1].toLowerCase());
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const normalize = (value) => {
  const normalized = String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
  const marker = normalized.lastIndexOf('/tests/');
  return marker >= 0 ? normalized.slice(marker + 1) : normalized.startsWith('tests/') ? normalized : `tests/${normalized}`;
};
const reportBytes = fs.readFileSync(reportPath);
const report = JSON.parse(reportBytes);
if (!report || typeof report !== 'object' || !Array.isArray(report.suites)) throw new Error('Invalid Playwright JSON report');
if (!localeCodes.length) throw new Error('Locale registry could not be parsed');

const implementationIndex = new Map();
for (const [assertionId, entry] of Object.entries(registry.assertions ?? {})) {
  const implementation = entry?.implementation;
  if (implementation?.kind === 'playwright-test' && implementation.spec && implementation.test) {
    implementationIndex.set(`${normalize(implementation.spec)}\u0000${implementation.test}`, assertionId);
  }
}

const specRecords = new Map();
const walkSuite = (suite, inheritedFile = null) => {
  const suiteFile = typeof suite.file === 'string' ? suite.file : inheritedFile;
  for (const spec of suite.specs ?? []) {
    const specFile = normalize(typeof spec.file === 'string' ? spec.file : suiteFile);
    if (!specFile) continue;
    const record = specRecords.get(specFile) ?? { spec: specFile, tests: [] };
    for (const test of spec.tests ?? []) {
      const testName = typeof test.title === 'string' && test.title.trim() ? test.title.trim() : null;
      const results = Array.isArray(test.results) ? test.results : [];
      const failed = results.some((result) => result.status === 'failed' || result.status === 'timedOut');
      const passed = results.some((result) => result.status === 'passed');
      const skipped = test.outcome === 'skipped' || (results.length > 0 && results.every((result) => result.status === 'skipped'));
      const status = failed ? 'FAIL' : passed ? 'PASS' : skipped ? 'SKIPPED' : 'NOT_EXECUTED';
      record.tests.push({
        name: testName,
        status,
        attempt: results.length,
        attempts: results.map((result, index) => ({
          attempt: index + 1,
          status: result.status,
          durationMs: result.duration ?? 0,
          errorCount: Array.isArray(result.errors) ? result.errors.length : 0,
        })),
        assertionId: implementationIndex.get(`${specFile}\u0000${testName ?? ''}`) ?? null,
      });
    }
    specRecords.set(specFile, record);
  }
  for (const child of suite.suites ?? []) walkSuite(child, suiteFile);
};
for (const suite of report.suites) walkSuite(suite);

const expectedSpecs = mode === 'FAST' ? expectedFastSpecs : [expectedDeepSpec];
const unexpectedSpecs = [...specRecords.keys()].filter((spec) => !expectedSpecs.includes(spec));
const units = [...specRecords.values()].map((record) => {
  const tests = record.tests;
  const failedTestCount = tests.filter((test) => test.status === 'FAIL').length;
  const passedTestCount = tests.filter((test) => test.status === 'PASS').length;
  const skippedTestCount = tests.filter((test) => test.status === 'SKIPPED').length;
  const notExecutedTestCount = tests.filter((test) => test.status === 'NOT_EXECUTED').length;
  const status = failedTestCount > 0 ? 'FAIL' : passedTestCount > 0 ? 'PASS' : skippedTestCount === tests.length && tests.length > 0 ? 'SKIPPED' : 'NOT_EXECUTED';
  const canonicalAssertionIds = [...new Set(tests.map((test) => test.assertionId).filter(Boolean))];
  const testName = tests.length === 1 ? tests[0].name : tests.length > 1 ? `${tests.length} tests` : '<untitled>';
  const semanticLocale = mode === 'DEEP'
    ? tests.map((test) => test.name ?? '').map((name) => name.match(/(?:^|\s)\/([a-z]{2,3})(?:\/|$)/iu)?.[1]?.toLowerCase() ?? null).find(Boolean) ?? null
    : null;
  return {
    executionUnitId: `${mode}:${browser}:${shard}:${record.spec}`,
    semanticUnitId: mode === 'FAST'
      ? `FAST:${browser}:${record.spec}`
      : semanticLocale
        ? `DEEP:${browser}:${semanticLocale}`
        : null,
    assertionId: canonicalAssertionIds.length === 1 && tests.length === 1 ? canonicalAssertionIds[0] : null,
    attribution: canonicalAssertionIds.length === 1 && tests.length === 1 ? 'CANONICAL_IMPLEMENTATION_MATCH' : 'SURFACE_COVERAGE_ONLY',
    coverageId: `${mode}:${record.spec}`,
    mode,
    browser,
    locale: semanticLocale,
    shard,
    spec: record.spec,
    test: testName,
    titlePath: [path.basename(record.spec), ...(tests.length === 1 && tests[0].name ? [tests[0].name] : [])],
    semanticLocale,
    attempt: tests.reduce((max, test) => Math.max(max, test.attempt), 0),
    attempts: tests.flatMap((test) => test.attempts),
    status,
    testStatusCounts: {
      PASS: passedTestCount,
      FAIL: failedTestCount,
      SKIPPED: skippedTestCount,
      NOT_EXECUTED: notExecutedTestCount,
    },
    skippedTests: tests.filter((test) => test.status === 'SKIPPED').map((test) => test.name),
    tests,
    runId,
    exactSha,
  };
});

const specSet = new Set(units.map((unit) => unit.spec));
const localeSet = new Set(units.map((unit) => unit.semanticLocale).filter(Boolean));
const semanticUnitSet = new Set(units.map((unit) => unit.semanticUnitId).filter(Boolean));
const statusNames = ['PASS','FAIL','SKIPPED','CANCELLED','BLOCKED','NOT_EXECUTED','MISSING_EVIDENCE','MALFORMED_EVIDENCE'];
const statusCounts = Object.fromEntries(statusNames.map((state) => [state, 0]));
for (const unit of units) statusCounts[unit.status] = (statusCounts[unit.status] ?? 0) + 1;
const canonicalAssertionIds = [...new Set(units.map((unit) => unit.assertionId).filter(Boolean))];
const coverageIds = [...new Set(units.map((unit) => unit.coverageId))];
const skippedTestCount = units.reduce((sum, unit) => sum + unit.testStatusCounts.SKIPPED, 0);
const failedTestCount = units.reduce((sum, unit) => sum + unit.testStatusCounts.FAIL, 0);
const notExecutedTestCount = units.reduce((sum, unit) => sum + unit.testStatusCounts.NOT_EXECUTED, 0);
const semanticUnitStatus = mode === 'FAST'
  ? semanticUnitSet.size > 0 && units.every((unit) => Boolean(unit.semanticUnitId) && expectedFastSpecs.includes(unit.spec))
  : semanticUnitSet.size > 0 && unexpectedSpecs.length === 0 && units.every((unit) => Boolean(unit.semanticUnitId) && Boolean(unit.semanticLocale) && localeCodes.includes(unit.semanticLocale));
const outputStatus = units.length > 0
  && units.every((unit) => unit.status === 'PASS')
  && failedTestCount === 0
  && notExecutedTestCount === 0
  && unexpectedSpecs.length === 0
  && semanticUnitStatus
  ? 'PASS'
  : 'FAIL';
const output = {
  schema_version: 5,
  evidenceClass: 'PRIMARY_EXECUTION',
  mode,
  browser,
  shard,
  runId,
  exactSha,
  reportPath,
  sourceReportSha256: createHash('sha256').update(reportBytes).digest('hex'),
  status: outputStatus,
  ...(mode === 'FAST' ? { toolSpecs: expectedFastSpecs.length } : { locales: localeCodes.length }),
  expectedSpecCount: expectedSpecs.length,
  executedSpecCount: specSet.size,
  unexpectedSpecs,
  executionUnitCount: units.length,
  skippedTestCount,
  failedTestCount,
  notExecutedTestCount,
  statusCounts,
  attribution: {
    canonicalAssertionIds,
    canonicalAssertionExecutionCount: units.filter((unit) => unit.assertionId).length,
    surfaceCoverageExecutionCount: units.filter((unit) => !unit.assertionId).length,
    uniqueCoverageIds: coverageIds,
  },
  semanticCoverage: {
    model: mode === 'FAST' ? '22 specs × 3 browsers = 66 semantic spec-browser units, partitioned by shard' : `${localeCodes.length} locales × 3 browsers = ${localeCodes.length * 3} semantic locale-browser units, partitioned by shard`,
    plannedSemanticUnitCount: mode === 'FAST' ? expectedFastSpecs.length : localeCodes.length,
    semanticUnitCount: semanticUnitSet.size,
    semanticUnitIds: [...semanticUnitSet].sort(),
    localeRegistryCount: localeCodes.length,
    observedLocaleCount: localeSet.size,
    observedLocales: [...localeSet].sort(),
    unexpectedLocales: [...localeSet].filter((locale) => !localeCodes.includes(locale)),
    partition: true,
    partitionCount: mode === 'FAST' ? 2 : 3,
    partitionIndex: shard,
  },
  complete: unexpectedSpecs.length === 0
    && units.length > 0
    && statusCounts.FAIL === 0
    && statusCounts.SKIPPED === 0
    && statusCounts.NOT_EXECUTED === 0
    && failedTestCount === 0
    && notExecutedTestCount === 0
    && semanticUnitStatus,
  units,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (!output.complete) process.exitCode = 1;
