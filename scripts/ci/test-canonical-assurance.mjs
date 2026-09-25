#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const mode = process.argv.includes('--mode=contract') ? 'contract' : 'full';
const expectedSha = process.env.EXPECTED_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const actualSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = process.env.FLIXO_CANONICAL_ASSURANCE_OUTPUT || '/tmp/flixo-canonical-assurance.json';
const failures = [];
const read = (file) => {
  try { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
  catch (error) { failures.push(`READ_FAILED=${file}:${String(error?.message ?? error)}`); return ''; }
};
const exists = (file) => fs.existsSync(path.join(ROOT, file));
const requireSha = (value, label) => {
  if (!/^[a-f0-9]{40}$/iu.test(String(value ?? ''))) failures.push(label);
};
requireSha(actualSha, 'ACTUAL_HEAD_SHA_INVALID');
requireSha(expectedSha, 'EXPECTED_SHA_INVALID');
if (actualSha !== expectedSha) failures.push(`EXACT_SHA_MISMATCH actual=${actualSha} expected=${expectedSha}`);

const workflows = {
  ci: read('.github/workflows/ci.yml'),
  green: read('.github/workflows/daily-flixo-green-gate.yml'),
  heartbeat: read('.github/workflows/agent-repair-heartbeat.yml'),
  watchdog: read('.github/workflows/execution-bot-watchdog.yml'),
  supersession: read('.github/workflows/latest-commit-test-supersession.yml'),
  security: read('.github/workflows/security-red-team.yml'),
};
const scripts = [
  'scripts/ci/assert-current-commit.mjs',
  'scripts/ci/verify-run-proof.mjs',
  'scripts/ci/verify-run-lock.mjs',
  'scripts/ci/resident-wake-proof.mjs',
  'scripts/ci/test-resident-wake-proof.mjs',
  'scripts/ci/test-negative-control-integration.mjs',
  'scripts/ci/test-release-evidence-binding.mjs',
  'scripts/ci/test-post-patch-adversarial-v2.mjs',
  'scripts/ci/test-runtime-proof-coverage.mjs',
  'scripts/ci/test-latest-commit-only.mjs',
  'scripts/ci/test-latest-commit-test-supersession.mjs',
  'scripts/ci/test-security-red-team-contract.mjs',
  'scripts/ci/test-root-closure-contract.mjs',
  'scripts/ci/test-continuous-error-watch.mjs',
  'scripts/ci/test-automation-watchdog-contract.mjs',
  'scripts/ci/continuous-error-watch.mjs',
  'scripts/ci/release-evidence-binding.mjs',
];
for (const file of scripts) if (!exists(file)) failures.push(`REQUIRED_ASSURANCE_SCRIPT_MISSING=${file}`);

const wiringChecks = [
  ['CI_CURRENT_SHA_GUARD', /scripts\/ci\/assert-current-commit\.mjs/u.test(workflows.ci)],
  ['CI_RUN_PROOF', /scripts\/ci\/verify-run-proof\.mjs/u.test(workflows.ci)],
  ['CI_RUN_LOCK', /scripts\/ci\/verify-run-lock\.mjs/u.test(workflows.ci)],
  ['CI_LATEST_ONLY_CONTROLLER', /scripts\/ci\/assert-current-commit\.mjs/u.test(workflows.ci) && /cancel-in-progress:\s*true/u.test(workflows.supersession) && /gh run cancel/u.test(workflows.supersession)],
  ['CI_CANONICAL_ASSURANCE_STEP', /test-canonical-assurance\.mjs --mode=full/u.test(workflows.ci)],
  ['CI_CANONICAL_ASSURANCE_ARTIFACT', /flixo-canonical-assurance-/u.test(workflows.ci)],
  ['GREEN_FAIL_CLOSED', /case "\$STATUS" in[\s\S]*GREEN\) exit 0/iu.test(workflows.green)],
  ['GREEN_CONTRACT_SELF_TEST', /test-canonical-assurance\.mjs --mode=contract/u.test(workflows.green)],
  ['GREEN_ASSURANCE_EVIDENCE_CHECK', /CANONICAL_ASSURANCE/u.test(workflows.green)],
  ['HEARTBEAT_RESIDENT_BATON', /FLIXO-RESIDENT-WAKE-BATON-v1/u.test(workflows.heartbeat)],
  ['HEARTBEAT_READY_ACK', /resident-wake-proof\.mjs issue/u.test(workflows.heartbeat)],
  ['HEARTBEAT_INDEPENDENT_PROOF', /resident-wake-proof\.mjs verify/u.test(workflows.heartbeat)],
  ['WATCHDOG_INDEPENDENT_PROOF', /Independently verify resident handoff proof/u.test(workflows.watchdog)],
  ['SECURITY_READ_ONLY', /contents:\s*read/u.test(workflows.security)],
  ['BINARY_AUTOMATION_OUTCOME', /NON_BINARY_AUTOMATION_OUTCOME/u.test(read('scripts/ci/continuous-error-watch.mjs')) && /automationOutcome/u.test(read('scripts/ci/continuous-error-watch.mjs'))],
];
for (const [name, passed] of wiringChecks) if (!passed) failures.push(`ASSURANCE_WIRING_FAILED=${name}`);

for (const [name, source] of Object.entries({ ci: workflows.ci, heartbeat: workflows.heartbeat, watchdog: workflows.watchdog })) {
  if (/continue-on-error:\s*true/u.test(source)) failures.push(`FAILURE_MASKING_FORBIDDEN=${name}`);
}
if (/if:\s*always\(\)/u.test(workflows.ci) && !/Publish canonical assurance evidence/u.test(workflows.ci)) failures.push('CI_ALWAYS_STEP_UNKNOWN');

const categories = {
  CONTRACT: 'canonical workflow/script contracts',
  EXACT_SHA: 'live HEAD identity and run-proof chain',
  LATEST_ONLY: 'latest-commit supersession and cancellation',
  LIVENESS: 'resident baton + ready ACK + independent observer proof',
  FALSE_GREEN: 'negative-control and fail-closed verification',
  ADVERSARIAL: 'post-patch falsification/counterexample contract',
  RELEASE: 'release evidence binding to exact SHA',
  RUNTIME: 'runtime proof coverage and sensitive-contract controls',
  SECURITY: 'isolated red-team security boundary',
  CLOSURE: 'root-closure/canonical symmetry checks',
  BINARY_OUTCOME: 'skipped/neutral cannot become GREEN',
  DEPLOYMENT_BINDING: 'artifact/release identity remains SHA-bound',
};
const testCommands = [
  'scripts/ci/test-resident-wake-proof.mjs',
  'scripts/ci/test-negative-control-integration.mjs',
  'scripts/ci/test-release-evidence-binding.mjs',
  'scripts/ci/test-post-patch-adversarial-v2.mjs',
  'scripts/ci/test-runtime-proof-coverage.mjs',
  'scripts/ci/test-latest-commit-only.mjs',
  'scripts/ci/test-latest-commit-test-supersession.mjs',
  'scripts/ci/test-security-red-team-contract.mjs',
  'scripts/ci/test-root-closure-contract.mjs',
  'scripts/ci/test-continuous-error-watch.mjs',
];
const results = [];
if (mode === 'full') {
  for (const command of testCommands) {
    const started = Date.now();
    const proc = spawnSync(process.execPath, [command], {
      cwd: ROOT,
      env: { ...process.env, EXPECTED_SHA: expectedSha },
      encoding: 'utf8',
      timeout: 180000,
    });
    const stdout = String(proc.stdout ?? '');
    const stderr = String(proc.stderr ?? '');
    const passed = proc.status === 0 && !proc.error;
    const result = {
      command,
      status: passed ? 'PASS' : 'FAIL',
      exitCode: proc.status,
      durationMs: Date.now() - started,
      stdoutTail: stdout.slice(-2000),
      stderrTail: stderr.slice(-2000),
    };
    results.push(result);
    if (!passed) failures.push(`CANONICAL_ASSURANCE_SUBTEST_FAILED=${command}`);
  }
}

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const evidence = {
  schemaVersion: 1,
  protocol: 'FLIXO-CANONICAL-ASSURANCE-v1',
  status,
  mode,
  executionSha: expectedSha,
  actualHeadSha: actualSha,
  exactShaVerified: actualSha === expectedSha,
  generatedAt: new Date().toISOString(),
  categoryCount: Object.keys(categories).length,
  categories,
  wiringChecks: Object.fromEntries(wiringChecks.map(([name, passed]) => [name, Boolean(passed)])),
  subtests: results,
  failures,
  falseGreenPolicy: {
    skipped: 'RED',
    neutral: 'RED',
    cancelled: 'RED',
    staleEvidence: 'RED',
    wrongShaEvidence: 'RED',
    missingVerification: 'RED',
  },
  greenAuthority: 'DAILY_FLIXO_GREEN_GATE_ONLY',
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({
  status,
  protocol: evidence.protocol,
  mode,
  executionSha: expectedSha,
  categoryCount: evidence.categoryCount,
  failedControls: failures,
  subtests: results.map(({ command, status: subtestStatus }) => ({ command, status: subtestStatus })),
  output,
}, null, 2));
if (status !== 'PASS') process.exitCode = 1;
