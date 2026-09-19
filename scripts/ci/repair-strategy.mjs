import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { INTRACTABLE_THRESHOLD, fingerprintFailure } from './auto-repair-learning.mjs';

const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';
const intractablePath = process.env.FLIXO_INTRACTABLE_ERRORS ?? 'diagnostics/auto-repair/intractable-errors.json';
const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';

const strategies = [
  ['reproduce-exact', 'Reproduce the exact failure on the exact target SHA before changing source.'],
  ['minimize-failure', 'Reduce the failure to the smallest reproducible command, file, or test surface.'],
  ['diff-forensics', 'Inspect the target diff and recent history for the first causal change.'],
  ['environment-audit', 'Audit Node, package-lock, browser, OS, cache, and dependency/environment differences.'],
  ['workflow-forensics', 'Inspect workflow ordering, permissions, concurrency, artifacts, and CI-only assumptions.'],
  ['observability-trace', 'Add bounded diagnostic evidence or tracing without changing the acceptance criteria.'],
  ['historical-analogy', 'Compare prior successful and rejected cases, lessons, anti-lessons, and playbooks.'],
  ['synthetic-reproduction', 'Build a minimal synthetic reproduction or focused regression test for the suspected root cause.'],
  ['alternate-hypothesis', 'Reject the leading hypothesis and test a materially different evidence-backed repair hypothesis.'],
  ['supervising-escalation', 'Prepare a complete teaching packet for the supervising agent; do not repeat prior repairs.'],
];

function readJson(path, fallback) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return fallback; }
}

function priorRepairArtifactCount() {
  const token = process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const targetRunId = process.env.TARGET_RUN_ID;
  if (!token || !repo || !targetRunId) return 0;
  const result = spawnSync('gh', ['api', `repos/${repo}/actions/artifacts`, '--paginate', '--slurp', '--jq', '.[].artifacts[].name'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) return 0;
  const prefix = `flixo-auto-repair-${targetRunId}-`;
  return result.stdout.split('\n').filter((name) => name.startsWith(prefix)).length;
}

const memory = readJson(memoryPath, { cases: [] });
const intractable = readJson(intractablePath, { cases: [] });
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const fingerprint = fingerprintFailure(log);
const entry = (memory.cases ?? []).find((item) => item.fingerprint === fingerprint);
const record = (intractable.cases ?? []).find((item) => item.fingerprint === fingerprint);
const attempts = Number(entry?.attempts ?? 0);
const persistedAttempts = priorRepairArtifactCount();
const nextAttempt = Math.max(attempts + 1, persistedAttempts + 1);
const index = (Math.max(0, nextAttempt - 1)) % strategies.length;
const [strategyId, strategy] = strategies[index];
const threshold = INTRACTABLE_THRESHOLD;
const teachingEscalation = record?.status === 'INTRACTABLE' || nextAttempt > threshold;
const isIntractable = false;

fs.writeFileSync('/tmp/flixo-repair-strategy.json', `${JSON.stringify({
  fingerprint,
  attempt: nextAttempt,
  priorRepairArtifacts: persistedAttempts,
  strategyId,
  strategy,
  intractable: isIntractable,
  teachingEscalation,
  cycle: nextAttempt,
  protocol: teachingEscalation ? 'SUPERVISING-REPAIR-TEACHING-v1' : null,
}, null, 2)}\n`);
fs.writeFileSync('/tmp/flixo-intractable-state', isIntractable ? 'true\n' : 'false\n');
console.log(JSON.stringify({ fingerprint, attempt: nextAttempt, priorRepairArtifacts: persistedAttempts, strategyId, teachingEscalation, intractable: isIntractable }));
