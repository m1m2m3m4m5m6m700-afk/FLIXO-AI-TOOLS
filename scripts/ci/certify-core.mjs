#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { reduceCheckResults } from './result-state.mjs';

const root = process.cwd();
const sha = process.env.CERTIFICATION_SHA;
const runId = process.env.GITHUB_RUN_ID;
const event = process.env.GITHUB_EVENT_NAME;
const manifestPath = process.env.CERTIFICATION_MANIFEST || 'certification-run-manifest.json';
if (!sha) throw new Error('CERTIFICATION_SHA is required');
if (!runId) throw new Error('GITHUB_RUN_ID is required');
if (!fs.existsSync(manifestPath)) throw new Error(`Missing certification manifest: ${manifestPath}`);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
};
const normalize = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
const digest = (file) => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const expectedBrowsers = ['chromium', 'firefox', 'webkit'];
const expectedFastSpecs = [
  'tests/image-compressor.spec.ts','tests/background-remover.spec.ts','tests/image-upscaler.spec.ts','tests/image-converter.spec.ts',
  'tests/ai-image-generator.spec.ts','tests/object-remover.spec.ts','tests/watermark-remover.spec.ts','tests/image-cropper.spec.ts',
  'tests/image-to-svg.spec.ts','tests/image-ocr.spec.ts','tests/photo-colorizer.spec.ts','tests/background-blur.spec.ts',
  'tests/passport-photo-maker.spec.ts','tests/watermark-adder.spec.ts','tests/meme-generator.spec.ts','tests/collage-maker.spec.ts',
  'tests/image-effects.spec.ts','tests/exif-cleaner.spec.ts','tests/svg-optimizer.spec.ts','tests/mockup-generator.spec.ts',
  'tests/seed.spec.ts','tests/pix.spec.ts',
];
const expectedFastKeys = new Set(expectedBrowsers.flatMap((browser) => [1,2].map((shard) => `${browser}:${shard}`)));
const expectedDeepKeys = new Set(expectedBrowsers.flatMap((browser) => [1,2,3].map((shard) => `${browser}:${shard}`)));
const errors = [];
const unknowns = [];
const invalidEvidence = [];
const shaMismatches = [];
const unauthorizedSkips = [];
const duplicatePrimaryEvidence = [];
const rootCauses = new Set();

const manifest = readJson(manifestPath);
if (manifest.sha !== sha) shaMismatches.push(`manifest.sha=${manifest.sha}`);
if (String(manifest.workflow_run_id) !== String(runId)) shaMismatches.push(`manifest.workflow_run_id=${manifest.workflow_run_id}`);
if (manifest.jobs?.static !== 'success') errors.push(`static=${manifest.jobs?.static ?? 'missing'}`);
if (manifest.jobs?.build !== 'success') errors.push(`build=${manifest.jobs?.build ?? 'missing'}`);
if (event !== 'pull_request' && manifest.jobs?.browserDeep !== 'success') errors.push(`browserDeep=${manifest.jobs?.browserDeep ?? 'missing'}`);
if (manifest.jobs?.browserFast !== 'success') errors.push(`browserFast=${manifest.jobs?.browserFast ?? 'missing'}`);

const identityCandidates = [];
const evidenceFiles = walk(path.join(root, 'evidence')).filter((file) => file.endsWith('.json'));
const parsed = new Map();
for (const file of evidenceFiles) {
  const rel = path.relative(root, file);
  try {
    const value = readJson(file);
    parsed.set(file, value);
    if (value?.schemaVersion === 2 && value?.evidenceClass === 'PRIMARY_EXECUTION' && typeof value?.packageLockSha256 === 'string') identityCandidates.push({ file, value });
    if (Array.isArray(value?.skipped)) unauthorizedSkips.push(`${rel}.skipped`);
    if (Array.isArray(value?.unauthorizedSkips)) unauthorizedSkips.push(`${rel}.unauthorizedSkips`);
    if (Array.isArray(value?.rootCauses)) for (const rc of value.rootCauses) if (rc) rootCauses.add(String(rc));
    for (const key of ['sha','exactSha','expected_sha','expectedSha','actualHeadSha']) if (typeof value?.[key] === 'string' && value[key] !== sha) shaMismatches.push(`${rel}.${key}=${value[key]}`);
    if (typeof value?.runId === 'string' && value.runId !== runId) shaMismatches.push(`${rel}.runId=${value.runId}`);
    if (typeof value?.run_id === 'string' && value.run_id !== runId) shaMismatches.push(`${rel}.run_id=${value.run_id}`);
  } catch (error) {
    invalidEvidence.push(`${rel}: invalid JSON: ${error.message}`);
  }
}

if (identityCandidates.length !== 1) invalidEvidence.push(`RUN_IDENTITY_COUNT=${identityCandidates.length}; expected=1`);
if (identityCandidates.length === 1) {
  const identity = identityCandidates[0].value;
  const expected = {
    sha,
    runId,
    workflowName: process.env.GITHUB_WORKFLOW ?? null,
    eventName: event,
    workflowSha256: digest('.github/workflows/ci.yml'),
    testPlanSha256: digest('scripts/ci/test-plan.json'),
    assertionRegistrySha256: digest('scripts/ci/assertion-registry.json'),
    packageLockSha256: digest('package-lock.json'),
    node: process.version,
    npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
  };
  const actual = {
    sha: identity.sha,
    runId: identity.runId,
    workflowName: identity.workflowName,
    eventName: identity.eventName,
    workflowSha256: identity.workflowSha256,
    testPlanSha256: identity.testPlanSha256,
    assertionRegistrySha256: identity.assertionRegistrySha256,
    packageLockSha256: identity.packageLockSha256,
    node: identity.runtime?.node,
    npm: identity.runtime?.npm,
  };
  for (const [key, value] of Object.entries(expected)) if (actual[key] !== value) shaMismatches.push(`identity.${key}=${actual[key]}`);
}

const primary = new Map();
for (const [file, value] of parsed) {
  if (value?.evidenceClass !== 'PRIMARY_EXECUTION' || !value?.mode || !value?.browser || !Number.isInteger(value?.shard)) continue;
  const key = `${value.mode}:${value.browser}:${value.shard}`;
  if (primary.has(key)) duplicatePrimaryEvidence.push(`${primary.get(key)} <> ${path.relative(root,file)}`);
  primary.set(key, file);
}
const fast = [...primary.entries()].filter(([key]) => key.startsWith('FAST:')).map(([,file]) => parsed.get(file));
const deep = [...primary.entries()].filter(([key]) => key.startsWith('DEEP:')).map(([,file]) => parsed.get(file));
if (fast.length !== expectedFastKeys.size) invalidEvidence.push(`FAST_PRIMARY_LEDGER_COUNT=${fast.length}; expected=${expectedFastKeys.size}`);
if (event !== 'pull_request' && deep.length !== expectedDeepKeys.size) invalidEvidence.push(`DEEP_PRIMARY_LEDGER_COUNT=${deep.length}; expected=${expectedDeepKeys.size}`);

const registry = readJson(path.join(root, 'scripts/ci/assertion-registry.json'));
const registryByImplementation = new Map();
for (const [assertionId, entry] of Object.entries(registry.assertions ?? {})) {
  const implementation = entry?.implementation;
  if (implementation?.kind === 'playwright-test' && implementation.spec && implementation.test) registryByImplementation.set(`${normalize(implementation.spec)}\u0000${implementation.test}`, assertionId);
}
const verifyUnit = (ledger, mode, file) => {
  const rel = path.relative(root,file);
  if (ledger.exactSha !== sha || ledger.runId !== runId) shaMismatches.push(`${rel}: ledger identity mismatch`);
  if (ledger.evidenceClass !== 'PRIMARY_EXECUTION') invalidEvidence.push(`${rel}: wrong evidenceClass`);
  if (ledger.complete !== true || ledger.status !== 'PASS') errors.push(`${rel}: ledger not PASS/complete`);
  if (!/^[0-9a-f]{64}$/iu.test(String(ledger.sourceReportSha256 ?? ''))) invalidEvidence.push(`${rel}: invalid source report hash`);
  if (ledger.executionUnitCount !== (ledger.units ?? []).length) invalidEvidence.push(`${rel}: unit count mismatch`);
  const seen = new Set();
  for (const unit of ledger.units ?? []) {
    if (!unit.executionUnitId || seen.has(unit.executionUnitId)) invalidEvidence.push(`${rel}: duplicate/missing executionUnitId=${unit.executionUnitId ?? '<missing>'}`);
    seen.add(unit.executionUnitId);
    if (unit.runId !== runId) shaMismatches.push(`${rel}:${unit.executionUnitId}: wrong runId`);
    if (unit.exactSha !== sha) shaMismatches.push(`${rel}:${unit.executionUnitId}: wrong exactSha`);
    if (!unit.spec || !unit.test || !unit.browser || !Number.isInteger(unit.shard)) invalidEvidence.push(`${rel}:${unit.executionUnitId}: incomplete identity`);
    if (!Array.isArray(unit.attempts) || unit.attempts.length === 0) invalidEvidence.push(`${rel}:${unit.executionUnitId}: missing attempts`);
    if (unit.status !== 'PASS') errors.push(`${rel}:${unit.executionUnitId}=${unit.status}`);
    if (mode === 'FAST') {
      const expected = `FAST:${unit.browser}:${normalize(unit.spec)}`;
      if (unit.semanticUnitId !== expected) invalidEvidence.push(`${rel}:${unit.executionUnitId}: semantic id=${unit.semanticUnitId}; expected=${expected}`);
      if (!expectedBrowsers.includes(unit.browser) || !expectedFastSpecs.includes(normalize(unit.spec))) invalidEvidence.push(`${rel}:${unit.executionUnitId}: unexpected FAST surface`);
    } else {
      if (!unit.semanticUnitId || !unit.semanticLocale) invalidEvidence.push(`${rel}:${unit.executionUnitId}: missing DEEP semantic identity`);
      if (unit.semanticUnitId !== `DEEP:${unit.browser}:${unit.semanticLocale}`) invalidEvidence.push(`${rel}:${unit.executionUnitId}: DEEP semantic id mismatch`);
    }
    if (unit.assertionId) {
      const canonical = registryByImplementation.get(`${normalize(unit.spec)}\u0000${unit.test}`) ?? null;
      if (unit.assertionId !== canonical) invalidEvidence.push(`${rel}:${unit.executionUnitId}: WRONG_IMPLEMENTATION/WRONG_TEST`);
      if (unit.attribution !== 'CANONICAL_IMPLEMENTATION_MATCH') invalidEvidence.push(`${rel}:${unit.executionUnitId}: invalid attribution`);
    } else if (unit.attribution !== 'SURFACE_COVERAGE_ONLY') invalidEvidence.push(`${rel}:${unit.executionUnitId}: missing attribution classification`);
  }
};
for (const [key,file] of primary) verifyUnit(parsed.get(file), key.startsWith('FAST:') ? 'FAST' : 'DEEP', file);

const fastSemantic = new Map();
for (const value of fast) for (const unit of value.units ?? []) {
  const key = unit.semanticUnitId;
  if (!key) continue;
  if (fastSemantic.has(key)) invalidEvidence.push(`FAST_DUPLICATE_SEMANTIC=${key}`);
  fastSemantic.set(key, unit.status);
}
for (const browser of expectedBrowsers) for (const spec of expectedFastSpecs) {
  const key = `FAST:${browser}:${spec}`;
  if (!fastSemantic.has(key)) invalidEvidence.push(`FAST_MISSING_SEMANTIC=${key}`);
}
if (fastSemantic.size !== 66) invalidEvidence.push(`FAST_CONSERVATION=${fastSemantic.size}; expected=66`);

if (event !== 'pull_request') {
  const deepSemantic = new Map();
  for (const value of deep) for (const unit of value.units ?? []) {
    const key = unit.semanticUnitId;
    if (!key) continue;
    if (deepSemantic.has(key)) invalidEvidence.push(`DEEP_DUPLICATE_SEMANTIC=${key}`);
    deepSemantic.set(key, unit.status);
  }
  const localeSource = fs.readFileSync(path.join(root, 'src/lib/i18n/config.ts'), 'utf8');
  const localeBody = localeSource.match(/LOCALES\s*=\s*\[([\s\S]*?)\]/u)?.[1] ?? '';
  const locales = [...new Set([...localeBody.matchAll(/["']([a-z]{2,3})["']/giu)].map((match) => match[1].toLowerCase()))];
  for (const browser of expectedBrowsers) for (const locale of locales) {
    const key = `DEEP:${browser}:${locale}`;
    if (!deepSemantic.has(key)) invalidEvidence.push(`DEEP_MISSING_SEMANTIC=${key}`);
  }
  if (deepSemantic.size !== locales.length * 3) invalidEvidence.push(`DEEP_CONSERVATION=${deepSemantic.size}; expected=${locales.length * 3}`);
}

const graphPath = path.join(root, 'diagnostics','certification','execution-graph.json');
if (!fs.existsSync(graphPath)) invalidEvidence.push('EXECUTION_GRAPH_MISSING');
else {
  try {
    const graph = readJson(graphPath);
    if (graph.status !== 'PASS') errors.push(`EXECUTION_GRAPH_STATUS=${graph.status}`);
    if (graph.exactSha !== sha) shaMismatches.push(`EXECUTION_GRAPH_SHA=${graph.exactSha}`);
    if (graph.runId !== runId) shaMismatches.push(`EXECUTION_GRAPH_RUN=${graph.runId}`);
    if (graph.fast?.observedSemanticUnits !== 66) invalidEvidence.push(`EXECUTION_GRAPH_FAST=${graph.fast?.observedSemanticUnits}`);
    if (event !== 'pull_request' && graph.deep?.semanticLocaleBrowserUnits !== 60) invalidEvidence.push(`EXECUTION_GRAPH_DEEP=${graph.deep?.semanticLocaleBrowserUnits}`);
  } catch (error) { invalidEvidence.push(`EXECUTION_GRAPH_INVALID=${error.message}`); }
}

const staticEvidence = [...parsed.entries()].find(([file,value]) => value && path.basename(file) === 'static.json')?.[1];
const buildEvidence = [...parsed.entries()].find(([file,value]) => value && path.basename(file) === 'build.json')?.[1];
for (const [name,value] of [['static',staticEvidence],['build',buildEvidence]]) {
  if (!value) { invalidEvidence.push(`${name}.json missing`); continue; }
  if (value.evidenceClass !== 'PRIMARY_EXECUTION' || value.status !== 'PASS') errors.push(`${name} evidence not PASS`);
  if (value.sha !== sha) shaMismatches.push(`${name}.sha=${value.sha}`);
}

const reducerChecks = [
  ...fast.flatMap((value) => (value.units ?? []).map((unit) => ({ id: unit.executionUnitId, status: unit.status }))),
  ...(event === 'pull_request' ? [] : deep.flatMap((value) => (value.units ?? []).map((unit) => ({ id: unit.executionUnitId, status: unit.status })))),
  { id: 'STATIC', status: staticEvidence?.status === 'PASS' ? 'PASS' : 'FAIL' },
  { id: 'BUILD', status: buildEvidence?.status === 'PASS' ? 'PASS' : 'FAIL' },
];
const reduced = reducerChecks.length ? reduceCheckResults(reducerChecks, reducerChecks.length) : { status:'FAIL', decision:false, expected:0, executed:0, counts:{} };
if (!reduced.decision) errors.push(`CANONICAL_REDUCER=${reduced.status}`);

const status = errors.length || unknowns.length || invalidEvidence.length || shaMismatches.length || unauthorizedSkips.length || duplicatePrimaryEvidence.length || rootCauses.size ? 'FAIL' : 'PASS';
const result = {
  schema_version: 10,
  authority: 'CANONICAL_CERTIFY_ENGINE',
  evidenceClass: 'PRIMARY_EXECUTION',
  status,
  certificationSha: sha,
  runId,
  identityVerified: identityCandidates.length === 1 && shaMismatches.every((item) => !item.startsWith('identity.')),
  reducer: reduced,
  conservation: {
    fast: { planned: 66, executed: fastSemantic.size, evidenced: fastSemantic.size, certified: status === 'PASS' ? 66 : 0 },
    deep: event === 'pull_request' ? null : { planned: 60, executed: deep.length ? 60 : 0, evidenced: deep.length ? 60 : 0, certified: status === 'PASS' ? 60 : 0 },
  },
  zeroFalseGreen: {
    independentRootCauses: rootCauses.size,
    unknowns: unknowns.length,
    invalidEvidence: invalidEvidence.length,
    shaMismatches: shaMismatches.length,
    unauthorizedSkips: unauthorizedSkips.length,
    duplicatePrimaryEvidence: duplicatePrimaryEvidence.length,
    missingRequiredExecution: [...expectedFastKeys].filter((key) => !new Set(fast.map((v) => `${v.browser}:${v.shard}`)).has(key)).length,
  },
  failures: errors,
  unknowns,
  invalidEvidence,
  shaMismatches,
  unauthorizedSkips,
  lineage: 'Registry → Test Plan → Exact Test → Runtime → Execution Unit → Primary Evidence → Identity → Canonical Reducer → Certification',
};
fs.mkdirSync(path.join(root,'diagnostics','certification'), { recursive: true });
fs.writeFileSync(path.join(root,'diagnostics','certification','global-evidence.json'), `${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result,null,2));
if (status !== 'PASS') process.exit(1);
