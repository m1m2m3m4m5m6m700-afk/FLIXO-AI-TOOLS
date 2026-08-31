import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aggregateFailures } from './failure/engine.ts';
import { classifyFailure } from './failure/taxonomy.ts';
import { normalizeOutput, suiteContract, ultraContractHash, ULTRA_SCHEMA_VERSION, ULTRA_SUITE_NAMES } from './ultra-contract.mjs';

const DEFAULT_OUTPUT_DIR = process.env.INVESTIGATION_DIR ?? 'diagnostics/investigation';
const OUTPUT_TAIL = 12_000;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function hash(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function fileHash(file) {
  try {
    return hash(readFileSync(file));
  } catch {
    return null;
  }
}

function identity() {
  const actualHeadSha = git(['rev-parse', 'HEAD']);
  const treeSha = git(['rev-parse', 'HEAD^{tree}']);
  const status = git(['status', '--porcelain']);
  const expectedSha = process.env.INVESTIGATION_SHA ?? process.env.EXPECTED_SHA ?? actualHeadSha;
  return { expectedSha, actualHeadSha, treeSha, worktreeClean: status === '', status };
}

function environmentIdentity() {
  const keys = [
    'CI', 'GITHUB_ACTIONS', 'GITHUB_WORKFLOW', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT',
    'RUNNER_OS', 'RUNNER_ARCH', 'VITE_SITE_URL', 'VITE_RUNTIME_ORIGIN', 'VITE_TEST_ORIGIN',
    'NODE_ENV', 'NPM_CONFIG_USER_AGENT',
  ];
  const values = Object.fromEntries(keys.map((key) => [key, process.env[key] ?? null]));
  values.node = process.version;
  values.platform = process.platform;
  values.arch = process.arch;
  return { values, fingerprint: hash(JSON.stringify(values)) };
}

function commandLabel(check) {
  return [check.command, ...check.args].join(' ');
}

export function runCheck(check, context = process.env) {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    let timeout;
    let hardTimeout;
    let settled = false;
    let timedOut = false;
    let stdout = '';
    let stderr = '';
    const child = spawn(check.command, check.args, {
      env: context,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (code, signal, spawnError = null) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (hardTimeout) clearTimeout(hardTimeout);
      if (spawnError) stderr += `\nspawn-error: ${spawnError.stack ?? spawnError}`;
      const durationMs = Date.now() - started;
      const message = normalizeOutput([stderr, stdout].filter(Boolean).join('\n'));
      resolve({
        id: check.id,
        contract: check.contract,
        command: commandLabel(check),
        status: code === 0 && !timedOut ? 'PASS' : 'FAIL',
        exitCode: code,
        signal,
        timedOut,
        durationMs,
        startedAt,
        finishedAt: new Date().toISOString(),
        expected: { exitCode: 0, maxDurationMs: check.timeoutMs },
        actual: { exitCode: code, signal, timedOut },
        assertion: 'Command exits with code 0 before the contract timeout and without forced termination.',
        source: `scripts/ci/ultra-investigate.mjs:${check.id}`,
        output: { stdout: stdout.slice(-OUTPUT_TAIL), stderr: stderr.slice(-OUTPUT_TAIL), signature: message },
      });
    };

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => finish(null, null, error));
    child.once('close', (code, signal) => finish(code, signal));

    timeout = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      stderr += `\nUltra timeout after ${check.timeoutMs}ms: ${commandLabel(check)}`;
      child.kill('SIGTERM');
      hardTimeout = setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, 5_000);
      hardTimeout.unref();
    }, check.timeoutMs);
    timeout.unref();
  });
}

function buildFailureEvents(results) {
  return results.filter((result) => result.status === 'FAIL').map((result) => ({
    id: result.id,
    contract: result.contract,
    status: 'FAIL',
    message: result.output.signature || `${result.command} failed`,
    source: result.source,
    durationMs: result.durationMs,
  }));
}

function deriveFailureIntelligence(events) {
  if (!events.length) return { schemaVersion: 1, rootCauses: [], failures: [], unknownCount: 0, reportHash: hash('empty') };
  return aggregateFailures(events.map((event) => classifyFailure(event)));
}

export function buildEnvironmentFingerprint(identityState) {
  return hash(JSON.stringify({
    schemaVersion: ULTRA_SCHEMA_VERSION,
    contractHash: ultraContractHash(),
    sha: identityState.actualHeadSha,
    treeSha: identityState.treeSha,
    node: process.version,
    lockfile: fileHash('package-lock.json'),
    package: fileHash('package.json'),
  }));
}

async function investigateSuite(suite, checks, identityState, environmentState) {
  const startedAt = new Date().toISOString();
  const results = await Promise.all(checks.map((check) => runCheck(check)));
  const failures = buildFailureEvents(results);
  const failureIntelligence = deriveFailureIntelligence(failures);
  return {
    schema_version: ULTRA_SCHEMA_VERSION,
    suite,
    sha: identityState.expectedSha,
    actualHeadSha: identityState.actualHeadSha,
    treeSha: identityState.treeSha,
    worktreeClean: identityState.worktreeClean,
    contractHash: ultraContractHash(),
    environmentFingerprint: environmentState.fingerprint,
    environment: environmentState.values,
    startedAt,
    generatedAt: new Date().toISOString(),
    status: failures.length || identityState.expectedSha !== identityState.actualHeadSha || !identityState.worktreeClean ? 'FAIL' : 'PASS',
    checksExpected: checks.length,
    checksExecuted: results.length,
    passed: results.filter((result) => result.status === 'PASS').length,
    failed: results.filter((result) => result.status === 'FAIL').length,
    skipped: 0,
    missing: checks.length - results.length,
    results,
    failureIntelligence,
    rootCauses: failureIntelligence.rootCauses,
    failureCount: failures.length,
    rootCauseCount: failureIntelligence.rootCauses.length,
    unknownCount: failureIntelligence.unknownCount,
  };
}

export async function investigate(requestedSuite = process.env.INVESTIGATION_SUITE ?? 'all', outputDir = DEFAULT_OUTPUT_DIR) {
  mkdirSync(outputDir, { recursive: true });
  const identityState = identity();
  const environmentState = environmentIdentity();
  const selection = requestedSuite === 'all' ? ULTRA_SUITE_NAMES : [requestedSuite];
  for (const suite of selection) suiteContract(suite);

  const records = await Promise.all(selection.map((suite) => investigateSuite(suite, suiteContract(suite), identityState, environmentState)));
  const failureEvents = records.flatMap((record) => record.failureIntelligence.failures);
  const allFailureIntelligence = deriveFailureIntelligence(failureEvents);
  const integrityErrors = [];
  if (identityState.expectedSha !== identityState.actualHeadSha) integrityErrors.push(`SHA mismatch: ${identityState.actualHeadSha} != ${identityState.expectedSha}`);
  if (!identityState.worktreeClean) integrityErrors.push('Working tree is not clean; reproducible CI evidence requires a clean tree.');
  if (records.length !== selection.length) integrityErrors.push(`Suite count mismatch: ${records.length} != ${selection.length}`);
  if (records.some((record) => record.checksExecuted !== record.checksExpected)) integrityErrors.push('One or more suites did not execute their complete contract set.');
  const report = {
    schema_version: ULTRA_SCHEMA_VERSION,
    status: integrityErrors.length || records.some((record) => record.status !== 'PASS') ? 'FAIL' : 'PASS',
    sha: identityState.expectedSha,
    actualHeadSha: identityState.actualHeadSha,
    treeSha: identityState.treeSha,
    worktreeClean: identityState.worktreeClean,
    contractHash: ultraContractHash(),
    environmentFingerprint: environmentState.fingerprint,
    environment: environmentState.values,
    generatedAt: new Date().toISOString(),
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    suiteScope: requestedSuite,
    expectedSuites: selection,
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
      failures: record.results.filter((result) => result.status === 'FAIL').map((result) => result.id),
    })),
    failureCount: records.reduce((sum, record) => sum + record.failureCount, 0),
    rootCauseCount: allFailureIntelligence.rootCauses.length,
    unknownCount: allFailureIntelligence.unknownCount,
    rootCauses: allFailureIntelligence.rootCauses,
    failures: allFailureIntelligence.failures,
    failureIntelligenceHash: allFailureIntelligence.reportHash,
    integrityErrors,
  };
  for (const record of records) writeFileSync(path.join(outputDir, `${record.suite}.json`), JSON.stringify(record, null, 2) + '\n');
  writeFileSync(path.join(outputDir, 'ultra-investigation.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

async function main() {
  const report = await investigate();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 2;
  });
}
