#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadMemory, fingerprintFailure, normalizeFailure } from './auto-repair-learning.mjs';
import { reasonFailure } from './auto-repair/reasoning.mjs';

const root = process.env.FLIXO_TARGET_DIR ?? process.cwd();
const output = process.env.FLIXO_TWIN_OUTPUT ?? '/tmp/flixo-twin/twin-result.json';
const failureLogPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-twin/failure.log';
const targetRunId = String(process.env.TARGET_RUN_ID ?? '').trim();
const expectedSha = String(process.env.FLIXO_EXPECTED_TARGET_SHA ?? '').trim();
const attempt = Math.max(1, Number(process.env.FLIXO_REPAIR_ATTEMPT ?? 1));

if (process.env.FLIXO_TWIN_READ_ONLY !== 'true') throw new Error('TWIN_READ_ONLY_CONTRACT_REQUIRED');
if (execFileSync('git', ['-C', root, 'branch', '--show-current'], { encoding: 'utf8' }).trim() !== 'execution') {
  throw new Error('TWIN_EXECUTION_BRANCH_REQUIRED');
}
const currentSha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (expectedSha && currentSha !== expectedSha) throw new Error(`TWIN_EXACT_SHA_MISMATCH:${currentSha}:${expectedSha}`);

function shellRead(args) {
  const result = spawnSync(args[0], args.slice(1), { cwd: root, encoding: 'utf8', env: process.env });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'READ_COMMAND_FAILED'));
  return String(result.stdout);
}
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function hash(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
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
    ['external-tooling', 'external-provider-separation'],
  ]);
  return map.get(hypothesis) ?? 'alternate-hypothesis';
}

fs.mkdirSync(new URL('.', new URL(`file://${pathFor(output)}`)).pathname, { recursive: true });

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
    dissentStrength,
    disposition: alternative ? (dissentStrength >= 0.9 ? 'STRONG_DISSENT' : 'COUNTERCHECK') : 'NO_SAFE_ALTERNATIVE_FOUND',
    rule: 'NEVER_WRITE_SOURCE_AND_NEVER_CONTROL_ACTIONS',
  },
  evidenceDigest: hash(JSON.stringify({ currentSha, log, top, alternative })),
  generatedAt: new Date().toISOString(),
});

fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));

function pathFor(file) {
  const normalized = String(file).replaceAll('\\\\', '/');
  const slash = normalized.lastIndexOf('/');
  return slash > 0 ? normalized.slice(0, slash + 1) : './';
}
