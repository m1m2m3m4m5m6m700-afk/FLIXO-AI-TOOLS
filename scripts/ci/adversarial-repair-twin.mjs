#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadMemory, fingerprintFailure, normalizeFailure } from './auto-repair-learning.mjs';
import { reasonFailure } from './auto-repair/reasoning.mjs';

const root = process.env.FLIXO_TARGET_DIR ?? process.cwd();
const output = process.env.FLIXO_TWIN_OUTPUT ?? '/tmp/flixo-twin/twin-result.json';
const failureLogPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-twin/failure.log';
const targetRunId = String(process.env.TARGET_RUN_ID ?? '').trim();
const expectedSha = String(process.env.FLIXO_EXPECTED_TARGET_SHA ?? '').trim();
const attempt = Math.max(1, Number(process.env.FLIXO_REPAIR_ATTEMPT ?? 1));

if (process.env.FLIXO_TWIN_READ_ONLY !== 'true') throw new Error('TWIN_READ_ONLY_CONTRACT_REQUIRED');
const branch = execFileSync('git', ['-C', root, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
const detached = process.env.FLIXO_TWIN_DETACHED === 'true';
if (branch !== 'execution' && !(detached && branch === '')) throw new Error('TWIN_EXECUTION_REF_REQUIRED');
const currentSha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (expectedSha && currentSha !== expectedSha) throw new Error(`TWIN_EXACT_SHA_MISMATCH:${currentSha}:${expectedSha}`);

function shellRead(args) {
  const result = spawnSync(args[0], args.slice(1), { cwd: root, encoding: 'utf8', env: process.env });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'READ_COMMAND_FAILED'));
  return String(result.stdout);
}
function hash(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}
function mapAlternativeRepair(hypothesis, location) {
  const file = location?.file ?? 'the smallest exact target file';
  const map = new Map([
    ['lint', `Inspect ${file} at the reported symbol and prefer the smallest semantic correction (remove, rename, or consume the symbol) rather than blindly applying the executor's first lint fix.`],
    ['format', `Verify the formatter configuration and scope first, then apply only the smallest formatting change required by the exact failure.`],
    ['typescript', `Trace the type mismatch to its boundary and repair the real contract/type flow; reject an assertion-only workaround unless the invariant proves it safe.`],
    ['build', 'Trace the build dependency/module-resolution path first and repair configuration or import ownership before changing unrelated source code.'],
    ['playwright', 'Reproduce the browser failure on the exact target and isolate runtime/browser state before accepting an application-source mutation.'],
    ['webkit-render', 'Test the WebKit-specific rendering path and runtime assumptions first; only mutate source after the browser-specific mechanism is reproduced.'],
    ['certification', 'Trace the certification evidence contract and exact-SHA provenance before changing product source; repair the violated evidence invariant instead of the symptom.'],
    ['external-tooling', 'Separate provider failure from source failure and require a reproducible repository-side signal before any source mutation.'],
  ]);
  return map.get(hypothesis) ?? 'Use a materially different root-cause hypothesis and prove it on the exact SHA before mutation.';
}

function mapAlternativeStrategy(hypothesis) {
  const map = new Map([
    ['lint', 'alternate-hypothesis'],
    ['format', 'minimize-failure'],
    ['typescript', 'diff-forensics'],
    ['build', 'environment-audit'],
    ['playwright', 'environment-audit'],
    ['webkit-render', 'workflow-forensics'],
    ['certification', 'workflow-forensics'],
    ['external-tooling', 'alternate-hypothesis'],
  ]);
  return map.get(hypothesis) ?? 'alternate-hypothesis';
}

fs.mkdirSync(path.dirname(output), { recursive: true });

if (!fs.existsSync(failureLogPath)) {
  if (!targetRunId) throw new Error('TWIN_FAILURE_EVIDENCE_MISSING');
  const log = shellRead(['gh', 'run', 'view', targetRunId, '--repo', process.env.GITHUB_REPOSITORY, '--log-failed']);
  fs.writeFileSync(failureLogPath, log);
}
const log = fs.readFileSync(failureLogPath, 'utf8');
if (!log.trim()) throw new Error('TWIN_FAILURE_LOG_EMPTY');

const memory = loadMemory();
const historical = [
  ...(memory.cases ?? []).map(({ rootCause, successes, attempts }) => ({
    rootCause,
    confidence: attempts ? successes / attempts : 0,
  })),
  ...(memory.lessons ?? []).map(({ rootCause, confidence }) => ({ rootCause, confidence })),
];

const diagnosis = reasonFailure(log, { targetDir: root, historical });
const top = diagnosis.topHypothesis ?? null;
const second = diagnosis.secondHypothesis ?? null;
const alternative = second && second.id !== top?.id ? second : null;
const twinPreferredStrategy = mapAlternativeStrategy(alternative?.id ?? top?.id);
const twinAlternativeRepair = mapAlternativeRepair(alternative?.id ?? top?.id, diagnosis.location);
const dissentStrength = alternative
  ? Number(Math.max(0, Math.min(1, 1 - Math.abs(Number(top?.score ?? 0) - Number(alternative?.score ?? 0)))).toFixed(3))
  : 0;

const result = Object.freeze({
  schemaVersion: 1,
  protocol: 'FLIXO-ADVERSARIAL-REPAIR-TWIN-v1',
  authority: 'READ_ONLY_ADVERSARIAL_TWIN',
  mutationAuthority: false,
  repositoryWrite: false,
  actionsWrite: false,
  branch: 'execution',
  targetRunId: targetRunId || null,
  targetSha: currentSha,
  expectedSha: expectedSha || null,
  attempt,
  fingerprint: fingerprintFailure(log),
  normalizedFailure: normalizeFailure(log),
  independentDiagnosis: {
    rootCause: diagnosis.rootCause,
    topHypothesis: top,
    alternativeHypothesis: alternative,
    causalConfidence: diagnosis.causalConfidence,
    ambiguity: diagnosis.ambiguity,
    evidenceProfile: diagnosis.evidenceProfile,
    falsificationChecks: diagnosis.falsificationChecks,
    repairHypothesis: diagnosis.repairHypothesis,
  },
  challenge: {
    objective: 'TRY_TO_DISPROVE_EXECUTOR_PLAN_AND_PROPOSE_A_MATERIALLY_DIFFERENT_SAFE_APPROACH',
    preferredAlternativeRootCause: alternative?.id ?? null,
    preferredAlternativeStrategy: twinPreferredStrategy,
    preferredAlternativeRepair: twinAlternativeRepair,
    dissentStrength,
    disposition: alternative ? (dissentStrength >= 0.9 ? 'STRONG_DISSENT' : 'COUNTERCHECK') : 'NO_SAFE_ALTERNATIVE_FOUND',
    rule: 'NEVER_WRITE_SOURCE_AND_NEVER_CONTROL_ACTIONS',
  },
  evidenceDigest: hash(JSON.stringify({ currentSha, log, top, alternative })),
  generatedAt: new Date().toISOString(),
});

fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
