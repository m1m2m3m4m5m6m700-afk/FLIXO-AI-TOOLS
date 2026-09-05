import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { aggregateFailures } from './failure/engine.ts';
import { ULTRA_SCHEMA_VERSION, ultraContractHash } from './ultra-contract.mjs';

const OUTPUT_DIR = process.env.INVESTIGATION_DIR ?? 'diagnostics/investigation';
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? process.env.GITHUB_SHA;
const BASE_SHA = process.env.CHANGE_BASE ?? '';
const TAIL = 8_000;
const DEFAULT_TIMEOUT_MS = 90_000;

if (!EXPECTED_SHA) throw new Error('EXPECTED_SHA/GITHUB_SHA is required.');

const hash = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');
const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function safeGitDiffFiles() {
  try {
    if (BASE_SHA) return git(['diff', '--name-only', `${BASE_SHA}...HEAD`]).split('\n').filter(Boolean);
  } catch {
    // Fall through to HEAD^ so triage remains useful even when the comparison base is unavailable.
  }
  try {
    return git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function classifyRisk(files) {
  const areas = new Set();
  for (const file of files) {
    if (file.startsWith('.github/workflows/') || file.startsWith('scripts/ci/')) areas.add('CI');
    if (file.includes('tools') || file.includes('tool-manifest')) areas.add('G1');
    if (file.includes('route') || file.startsWith('src/routes/')) areas.add('ROUTING');
    if (file.startsWith('src/lib/i18n/') || file.includes('locale')) areas.add('I18N');
    if (file.startsWith('src/lib/seo/') || file.includes('seo') || file.includes('sitemap')) areas.add('SEO');
    if (file.includes('file-safety') || file.includes('upload-boundary')) areas.add('G2');
    if (file.includes('output-integrity') || file.includes('/g3/')) areas.add('G3');
    if (file.startsWith('tests/') || file.includes('playwright')) areas.add('G4');
    if (file.endsWith('.tsx') || file.endsWith('.jsx')) areas.add('UI');
  }
  return [...areas].sort();
}

function killChild(child) {
  if (!child.pid) return;
  try { child.kill('SIGTERM'); } catch { /* already exited */ }
  const hardKill = setTimeout(() => {
    try { child.kill('SIGKILL'); } catch { /* already exited */ }
  }, 2_000);
  hardKill.unref();
}

function runCheck(check) {
  return new Promise((resolve) => {
    const started = Date.now();
    const startedAt = new Date().toISOString();
    const timeoutMs = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const child = spawn(check.command, check.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const finish = (code, signal, error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) stderr += `\nspawn-error: ${error.stack ?? error}`;
      const output = `${stderr}\n${stdout}`.trim();
      resolve({
        id: check.id,
        contract: check.contract,
        status: code === 0 && !timedOut ? 'PASS' : 'FAIL',
        exitCode: code,
        signal,
        timedOut,
        durationMs: Date.now() - started,
        startedAt,
        finishedAt: new Date().toISOString(),
        command: [check.command, ...check.args].join(' '),
        expected: { exitCode: 0, maxDurationMs: timeoutMs },
        actual: { exitCode: code, signal, timedOut },
        assertion: 'Fast triage command exits successfully within its bounded timeout.',
        source: `scripts/ci/ultra-fast.mjs:${check.id}`,
        output: {
          stdout: stdout.slice(-TAIL),
          stderr: stderr.slice(-TAIL),
          signature: output.replace(/https?:\/\/[^\s]+/giu, '<URL>').replace(/[0-9a-f]{7,64}/giu, '<SHA>').replace(/\b\d+(?:\.\d+)?\b/gu, '<N>').replace(/\s+/gu, ' ').trim().slice(-800),
        },
      });
    };

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => finish(null, null, error));
    child.once('close', (code, signal) => finish(code, signal));

    const timer = setTimeout(() => {
      timedOut = true;
      stderr += `\nUltra Fast timeout after ${timeoutMs}ms: ${check.command} ${check.args.join(' ')}`;
      killChild(child);
    }, timeoutMs);
    timer.unref();
  });
}

const CHECKS = [
  { id: 'diff-check', contract: 'CI-ULTRA-FAST-001', command: 'git', args: BASE_SHA ? ['diff', '--check', `${BASE_SHA}...HEAD`] : ['diff', '--check'], timeoutMs: 30_000 },
  { id: 'typecheck', contract: 'CI-TOOLCHAIN-001', command: 'npm', args: ['run', 'typecheck'], timeoutMs: 90_000 },
  { id: 'ci-contract', contract: 'CI-CONFIG-001', command: 'npm', args: ['run', 'validate:ci-contract'], timeoutMs: 90_000 },
  { id: 'tool-registry', contract: 'G1-REGISTRY-001', command: 'npm', args: ['run', 'validate:tool-registry'], timeoutMs: 90_000 },
  { id: 'router-registry', contract: 'G1-ROUTER-001', command: 'npm', args: ['run', 'validate:router-registry'], timeoutMs: 90_000 },
];

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const actualHeadSha = git(['rev-parse', 'HEAD']);
  const treeSha = git(['rev-parse', 'HEAD^{tree}']);
  const worktreeStatus = git(['status', '--porcelain']);
  const changedFiles = safeGitDiffFiles();
  const environment = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    runnerOs: process.env.RUNNER_OS ?? null,
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  };

  const startedAt = new Date().toISOString();
  const results = await Promise.all(CHECKS.map(runCheck));
  const events = results.filter((result) => result.status === 'FAIL').map((result) => ({
    id: result.id,
    contract: result.contract,
    status: 'FAIL',
    message: result.output.signature || `${result.command} failed`,
    source: result.source,
    durationMs: result.durationMs,
  }));
  const failureIntelligence = events.length ? aggregateFailures(events) : {
    schemaVersion: 1,
    rootCauses: [],
    failures: [],
    unknownCount: 0,
    reportHash: hash('empty'),
  };

  const integrityErrors = [];
  if (actualHeadSha !== EXPECTED_SHA) integrityErrors.push(`SHA mismatch: ${actualHeadSha} != ${EXPECTED_SHA}`);
  if (worktreeStatus) integrityErrors.push('Worktree is not clean.');

  const report = {
    schema_version: ULTRA_SCHEMA_VERSION,
    phase: 'ULTRA_FAST_TRIAGE',
    status: integrityErrors.length || results.some((result) => result.status === 'FAIL') ? 'FAIL' : 'PASS',
    sha: EXPECTED_SHA,
    actualHeadSha,
    treeSha,
    baseSha: BASE_SHA || null,
    worktreeClean: worktreeStatus === '',
    contractHash: ultraContractHash(),
    generatedAt: new Date().toISOString(),
    startedAt,
    durationMs: results.reduce((max, result) => Math.max(max, result.durationMs), 0),
    environmentFingerprint: hash(environment),
    environment,
    changedFiles,
    riskAreas: classifyRisk(changedFiles),
    checksExpected: CHECKS.length,
    checksExecuted: results.length,
    passed: results.filter((result) => result.status === 'PASS').length,
    failed: results.filter((result) => result.status === 'FAIL').length,
    skipped: 0,
    missing: CHECKS.length - results.length,
    results,
    failureIntelligence,
    rootCauses: failureIntelligence.rootCauses,
    failureCount: events.length,
    rootCauseCount: failureIntelligence.rootCauses.length,
    unknownCount: failureIntelligence.unknownCount,
    integrityErrors,
  };

  writeFileSync(`${OUTPUT_DIR}/ultra-fast.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
