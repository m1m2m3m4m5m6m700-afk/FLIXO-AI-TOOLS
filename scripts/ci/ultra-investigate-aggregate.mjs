import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { aggregateFailures } from './failure/engine.ts';
import { classifyFailure } from './failure/taxonomy.ts';
import { ULTRA_SCHEMA_VERSION, ULTRA_SUITE_NAMES, ultraContractHash } from './ultra-contract.mjs';

const root = process.env.INVESTIGATION_DIR ?? 'diagnostics/investigation';
const ledgerRoot = process.env.EVIDENCE_ROOT ?? 'ci-evidence';
const expectedSha = process.env.EXPECTED_SHA ?? process.env.GITHUB_SHA;
if (!expectedSha) throw new Error('EXPECTED_SHA/GITHUB_SHA is required.');

mkdirSync(root, { recursive: true });
mkdirSync(ledgerRoot, { recursive: true });
const expected = new Set(ULTRA_SUITE_NAMES.map((suite) => `${suite}.json`));
const files = statSync(root, { throwIfNoEntry: false })?.isDirectory()
  ? readdirSync(root).filter((file) => expected.has(file)).sort()
  : [];
const integrityErrors = [];
for (const suite of expected) if (!files.includes(suite)) integrityErrors.push(`Missing suite evidence: ${suite}`);

const records = [];
for (const file of files) {
  try {
    records.push(JSON.parse(readFileSync(path.join(root, file), 'utf8')));
  } catch (error) {
    integrityErrors.push(`${file}: invalid JSON (${error.message})`);
  }
}

const seenSuites = new Set();
const failureEvents = [];
for (const record of records) {
  if (seenSuites.has(record.suite)) integrityErrors.push(`Duplicate suite: ${record.suite}`);
  seenSuites.add(record.suite);
  if (record.schema_version !== ULTRA_SCHEMA_VERSION) integrityErrors.push(`${record.suite}: schema_version mismatch`);
  if (record.sha !== expectedSha) integrityErrors.push(`${record.suite}: SHA mismatch ${record.sha} != ${expectedSha}`);
  if (record.actualHeadSha !== expectedSha) integrityErrors.push(`${record.suite}: actualHeadSha mismatch`);
  if (record.contractHash !== ultraContractHash()) integrityErrors.push(`${record.suite}: contractHash mismatch`);
  if (record.worktreeClean !== true) integrityErrors.push(`${record.suite}: worktree is not clean`);
  if (record.checksExpected !== record.checksExecuted) integrityErrors.push(`${record.suite}: incomplete execution`);
  if (record.skipped !== 0 || record.missing !== 0) integrityErrors.push(`${record.suite}: skipped/missing checks are not allowed`);
  for (const result of record.results ?? []) {
    if (result.status === 'FAIL') failureEvents.push({
      id: result.id,
      contract: result.contract,
      status: 'FAIL',
      message: result.output?.signature || `${result.command} failed`,
      source: result.source,
      durationMs: result.durationMs,
    });
  }
}

const intelligence = failureEvents.length ? aggregateFailures(failureEvents.map((event) => classifyFailure(event))) : {
  schemaVersion: 1,
  rootCauses: [],
  failures: [],
  unknownCount: 0,
  reportHash: 'empty',
};

const expectedChecks = records.reduce((sum, record) => sum + Number(record.checksExpected ?? 0), 0);
const executedChecks = records.reduce((sum, record) => sum + Number(record.checksExecuted ?? 0), 0);
const passedChecks = records.reduce((sum, record) => sum + Number(record.passed ?? 0), 0);
const failedChecks = records.reduce((sum, record) => sum + Number(record.failed ?? 0), 0);
const skippedChecks = records.reduce((sum, record) => sum + Number(record.skipped ?? 0), 0);
const missingChecks = records.reduce((sum, record) => sum + Number(record.missing ?? 0), 0);

const report = {
  schema_version: ULTRA_SCHEMA_VERSION,
  status: integrityErrors.length || records.some((record) => record.status !== 'PASS') || failureEvents.length ? 'FAIL' : 'PASS',
  sha: expectedSha,
  contractHash: ultraContractHash(),
  generatedAt: new Date().toISOString(),
  workflow: process.env.GITHUB_WORKFLOW ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  suiteCount: records.length,
  expectedSuiteCount: ULTRA_SUITE_NAMES.length,
  checks: { expected: expectedChecks, executed: executedChecks, passed: passedChecks, failed: failedChecks, skipped: skippedChecks, missing: missingChecks },
  suites: records.map((record) => ({
    suite: record.suite,
    status: record.status,
    sha: record.sha,
    expected: record.checksExpected,
    executed: record.checksExecuted,
    passed: record.passed,
    failed: record.failed,
    skipped: record.skipped,
    missing: record.missing,
  })),
  failureCount: failureEvents.length,
  rootCauseCount: intelligence.rootCauses.length,
  unknownCount: intelligence.unknownCount,
  rootCauses: intelligence.rootCauses,
  failures: intelligence.failures,
  failureIntelligenceHash: intelligence.reportHash,
  integrityErrors,
};

writeFileSync(path.join(root, 'aggregate.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(path.join(ledgerRoot, 'ultra-recovery.json'), JSON.stringify({
  sha: expectedSha,
  gate: 'ULTRA',
  expected: expectedChecks,
  executed: executedChecks,
  passed: passedChecks,
  failed: failedChecks,
  skipped: skippedChecks,
  missing: missingChecks,
  result: report.status,
}, null, 2) + '\n');

console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exit(1);
