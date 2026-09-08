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
const outputPath = String(args.get('output') ?? `diagnostics/certification/${mode === 'DEEP' ? 'browser-deep' : 'browser-fast'}-${browser}-${shard}.execution.json`);
const registryPath = 'scripts/ci/assertion-registry.json';

if (!['FAST', 'DEEP'].includes(mode)) throw new Error(`Invalid --mode: ${mode}`);
if (!browser) throw new Error('Browser is required');
if (!Number.isInteger(shard) || shard < 1) throw new Error(`Invalid shard: ${shard}`);
if (!fs.existsSync(reportPath)) throw new Error(`Missing Playwright report: ${reportPath}`);
if (!fs.existsSync(registryPath)) throw new Error(`Missing assertion registry: ${registryPath}`);

const expectedFastSpecs = [
  'tests/image-compressor.spec.ts', 'tests/background-remover.spec.ts', 'tests/image-upscaler.spec.ts',
  'tests/image-converter.spec.ts', 'tests/ai-image-generator.spec.ts', 'tests/object-remover.spec.ts',
  'tests/watermark-remover.spec.ts', 'tests/image-cropper.spec.ts', 'tests/image-to-svg.spec.ts',
  'tests/image-ocr.spec.ts', 'tests/photo-colorizer.spec.ts', 'tests/background-blur.spec.ts',
  'tests/passport-photo-maker.spec.ts', 'tests/watermark-adder.spec.ts', 'tests/meme-generator.spec.ts',
  'tests/collage-maker.spec.ts', 'tests/image-effects.spec.ts', 'tests/exif-cleaner.spec.ts',
  'tests/svg-optimizer.spec.ts', 'tests/mockup-generator.spec.ts', 'tests/seed.spec.ts', 'tests/pix.spec.ts',
];
const expectedDeepSpec = 'tests/localization-runtime.spec.ts';
const localeSource = fs.readFileSync('src/lib/i18n/config.ts', 'utf8');
const localeArray = localeSource.match(/LOCALES\s*=\s*\[([\s\S]*?)\]/u)?.[1] ?? '';
const localeCodes = [...localeArray.matchAll(/['"]([a-z]{2,3})['"]/giu)].map((match) => match[1]);
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
if (!report || typeof report !== 'object' || !Array.isArray(report.suites)) throw new Error('Invalid Playwright JSON report');
if (!localeCodes.length) throw new Error('Locale registry could not be parsed');

const implementationIndex = new Map();
for (const [assertionId, entry] of Object.entries(registry.assertions ?? {})) {
  const implementation = entry?.implementation;
  if (implementation?.kind === 'playwright-test' && implementation.spec && implementation.test) {
    implementationIndex.set(`${normalize(implementation.spec)}\u0000${implementation.test}`, assertionId);
  }
}

const units = [];
const walkSuite = (suite, file = null, titlePath = []) => {
  const suiteFile = typeof suite.file === 'string' ? normalize(suite.file) : file;
  const nextTitlePath = [...titlePath, ...(typeof suite.title === 'string' && suite.title ? [suite.title] : [])];
  for (const spec of suite.specs ?? []) {
    const specFile = typeof spec.file === 'string' ? normalize(spec.file) : suiteFile;
    for (const test of spec.tests ?? []) {
      const results = Array.isArray(test.results) ? test.results : [];
      const status = test.outcome === 'skipped'
        ? 'NOT_EXECUTED'
        : results.some((r) => r.status === 'failed' || r.status === 'timedOut')
          ? 'FAIL'
          : results.length && results.every((r) => r.status === 'passed')
            ? 'PASS'
            : 'NOT_EXECUTED';
      const specName = specFile ?? '<unknown>';
      const testName = test.title ?? null;
      const key = `${specName}\u0000${testName ?? ''}`;
      const canonicalAssertionId = implementationIndex.get(key) ?? null;
      const normalizedTitlePath = [...nextTitlePath, testName].filter(Boolean);
      const pathFromTitle = String(testName ?? '').match(/—\s+(\/[^\s]+)$/u)?.[1] ?? null;
      const locale = pathFromTitle?.match(/^\/([a-z]{2,3})(?:\/|$)/iu)?.[1]?.toLowerCase() ?? null;
      units.push({
        executionUnitId: `${mode}:${browser}:${shard}:${specName}:${testName ?? '<untitled>'}`,
        assertionId: canonicalAssertionId,
        attribution: canonicalAssertionId ? 'CANONICAL_IMPLEMENTATION_MATCH' : 'SURFACE_COVERAGE_ONLY',
        coverageId: `${mode}:${specName}`,
        mode,
        browser,
        shard,
        spec: specFile,
        test: testName,
        titlePath: normalizedTitlePath,
        semanticLocale: locale,
        status,
        attempts: results.map((r, index) => ({ attempt: index + 1, status: r.status, durationMs: r.duration ?? 0, errorCount: Array.isArray(r.errors) ? r.errors.length : 0 })),
        runId,
        exactSha,
      });
    }
  }
  for (const child of suite.suites ?? []) walkSuite(child, suiteFile, nextTitlePath);
};
for (const suite of report.suites) walkSuite(suite);

const specSet = new Set(units.map((unit) => unit.spec).filter(Boolean));
const localeSet = new Set(units.map((unit) => unit.semanticLocale).filter(Boolean));
const expectedSpecs = mode === 'FAST' ? expectedFastSpecs : [expectedDeepSpec];
const unexpectedSpecs = [...specSet].filter((spec) => !expectedSpecs.includes(spec));
const statusNames = ['PASS', 'FAIL', 'CANCELLED', 'BLOCKED', 'NOT_EXECUTED', 'MISSING_EVIDENCE', 'MALFORMED_EVIDENCE'];
const statusCounts = Object.fromEntries(statusNames.map((state) => [state, 0]));
for (const unit of units) statusCounts[unit.status] = (statusCounts[unit.status] ?? 0) + 1;
const canonicalAssertionIds = [...new Set(units.map((unit) => unit.assertionId).filter(Boolean))];
const coverageIds = [...new Set(units.map((unit) => unit.coverageId))];
const expectedDeepLocales = localeCodes.length;
const missingDeepLocales = mode === 'DEEP' ? localeCodes.filter((locale) => !localeSet.has(locale)) : [];
const unexpectedDeepLocales = mode === 'DEEP' ? [...localeSet].filter((locale) => !localeCodes.includes(locale)) : [];

const output = {
  schema_version: 2,
  evidenceClass: 'PRIMARY_EXECUTION',
  mode,
  browser,
  shard,
  runId,
  exactSha,
  reportPath,
  sourceReportSha256: createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex'),
  expectedSpecCount: mode === 'FAST' ? 22 : 1,
  executedSpecCount: specSet.size,
  unexpectedSpecs,
  executionUnitCount: units.length,
  statusCounts,
  attribution: {
    canonicalAssertionIds,
    canonicalAssertionExecutionCount: units.filter((unit) => unit.assertionId).length,
    surfaceCoverageExecutionCount: units.filter((unit) => !unit.assertionId).length,
    uniqueCoverageIds: coverageIds,
  },
  semanticCoverage: {
    localeRegistryCount: expectedDeepLocales,
    observedLocaleCount: localeSet.size,
    observedLocales: [...localeSet].sort(),
    missingLocales: missingDeepLocales,
    unexpectedLocales: unexpectedDeepLocales,
  },
  complete: unexpectedSpecs.length === 0 && units.length > 0 && statusCounts.NOT_EXECUTED === 0 && (mode !== 'DEEP' || (missingDeepLocales.length === 0 && unexpectedDeepLocales.length === 0)),
  units,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (!output.complete) process.exitCode = 1;
