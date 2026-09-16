#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const TASK_FILE = path.join(ROOT, 'مهام.md');
const OUTPUT_DIR = path.join(ROOT, 'diagnostics/agents/task-agent');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith('--')) continue;
  const eq = token.indexOf('=');
  const key = token.slice(2, eq >= 0 ? eq : undefined);
  const value = eq >= 0 ? token.slice(eq + 1) : process.argv[i + 1];
  args.set(key, value ?? null);
}

const arg = (name, fallback = '') => String(args.get(name) ?? fallback).trim();
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const hash = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

if (!fs.existsSync(TASK_FILE)) throw new Error('TASK_FILE_NOT_FOUND=مهام.md');
const source = fs.readFileSync(TASK_FILE, 'utf8');

function parseTasks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tasks = [];
  let section = 'UNSCOPED';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const heading = line.match(/^#{1,3}\s+(.+)$/u);
    if (heading) section = heading[1].trim();
    const item = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)$/u);
    if (!item) continue;
    const completed = item[1].toLowerCase() === 'x';
    const title = item[2].trim();
    const taskId = `${slug(section)}-${slug(title)}`.slice(0, 160);
    tasks.push({ taskId, section, title, completed, sourceLine: i + 1, sourceText: line });
  }
  return tasks;
}

function slug(value) {
  return String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'task';
}

const tasks = parseTasks(source);
const requested = arg('task-id');
const allReady = process.argv.includes('--all-ready');
const selected = requested
  ? tasks.filter((task) => task.taskId === requested || task.title.includes(requested))
  : allReady
    ? tasks.filter((task) => !task.completed)
    : tasks.filter((task) => !task.completed).slice(0, 1);

if (!selected.length) throw new Error(requested ? `TASK_NOT_FOUND=${requested}` : 'NO_READY_TASKS');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const generatedAt = new Date().toISOString();
const outputs = [];

for (const task of selected) {
  const fingerprint = hash(`${task.taskId}|${task.title}|${task.section}`).slice(0, 16);
  const packet = {
    schemaVersion: 4,
    authority: 'FLIXO_TASK_AGENT',
    role: 'TASK_OWNER_AND_CODE_PREPARER',
    mode: 'PREPARATION_ONLY',
    preparedOnly: true,
    mutationPolicy: 'NO_SOURCE_MUTATION_NO_COMMIT_NO_PUSH',
    taskFile: 'مهام.md',
    task,
    baselineSha: sha,
    generatedAt,
    errorFingerprint: fingerprint,
    repairSummary: {
      status: 'PENDING',
      taskId: task.taskId,
      fingerprint,
      error: 'UNOBSERVED',
      rootCause: 'UNOBSERVED',
      repair: 'NOT_APPLIED_BY_PREPARATION_AGENT',
      verification: 'PENDING',
    },
    instructions: {
      objective: 'Understand this task, inspect its contracts, prepare exact source-code changes for a supervising agent, and stop before applying/committing/pushing them.',
      sourcePayload: 'CODE_ONLY',
      requiredChangeShape: ['path', 'operation', 'content', 'baselineSha'],
      verificationRequired: true,
      unresolvedWorkMustBeReported: true,
    },
    completionPolicy: {
      stateAfterPreparation: 'PREPARED',
      stateAfterRepair: 'REPAIR_PENDING_VERIFICATION',
      stateAfterAnyRedCheck: 'REPAIR_PENDING',
      stateAfterGreenCheck: 'REVERIFY_ALL',
      terminalState: 'CLOSED_VERIFIED_ONLY_AFTER_CANONICAL_GREEN',
      codeGeneratedOrAppliedIsNotCompletion: true,
      everyRepairOpensAnotherVerificationCycle: true,
      everyRedCheckMustBecomeARepairTarget: true,
      newlyIntroducedFailuresMustOpenNewCycles: true,
      taskCannotBeClosedFromTargetedRegressionAlone: true,
    },
    repairLoop: {
      mode: 'RED_TO_GREEN',
      maxCycles: 12,
      rescanAfterEveryRepair: true,
      rescanScope: 'ALL_REQUIRED_CHECKS',
      circuitBreaker: {
        enabled: true,
        maxStalledCycles: 3,
        definition: 'SAME_FAILURE_FINGERPRINT_WITHOUT_VERIFIABLE_PROGRESS',
        fingerprintScope: 'RED_CHECKS_AND_REPAIR_TARGETS',
        progressEvidence: 'CHECK_STATE_OR_ERROR_FINGERPRINT_CHANGED',
        action: 'REQUIRES_REVIEW',
        failClosed: true,
      },
      closureGate: ['canonical-ci-green', 'zero-red-checks', 'fresh-exact-sha-evidence', 'required-regression-proof'],
    },
    preparedChanges: [],
    inspectedFiles: [],
    dependencies: [],
    verification: [],
    blockers: [],
    handoff: {
      consumer: 'SUPERVISING_EXECUTION_AGENT',
      applyAuthority: 'SUPERVISING_AGENT_ONLY',
      commitAuthority: 'SUPERVISING_AGENT_ONLY',
      pushAuthority: 'SUPERVISING_AGENT_ONLY',
      completionAuthority: 'VERIFIER_AFTER_CANONICAL_GREEN_ONLY',
    },
  };
  const output = path.join(OUTPUT_DIR, `${task.taskId}.json`);
  fs.writeFileSync(output, `${JSON.stringify(packet, null, 2)}\n`);
  outputs.push({ taskId: task.taskId, output, fingerprint });
}

const index = {
  schemaVersion: 4,
  authority: 'FLIXO_TASK_AGENT',
  mode: 'PREPARATION_ONLY',
  preparedOnly: true,
  baselineSha: sha,
  generatedAt,
  selected: outputs,
  selectedCount: outputs.length,
  lifecycle: 'ACTIVE_UNTIL_CANONICAL_GREEN',
  repairLoop: {
    enabled: true,
    mode: 'RED_TO_GREEN',
    maxCycles: 12,
    rescanAfterEveryRepair: true,
    circuitBreaker: { enabled: true, maxStalledCycles: 3, action: 'REQUIRES_REVIEW', failClosed: true },
  },
  greenGate: {
    required: ['CANONICAL_GREEN', 'ZERO_RED_CHECKS', 'FRESH_EXACT_SHA_EVIDENCE', 'REGRESSION_PROOF'],
    closureAllowedOnlyWhenAllRequired: true,
  },
  changeBudget: { maxPreparedFiles: 12, maxInspectedFiles: 40, onExceed: 'REQUIRES_REVIEW' },
  memory: { fingerprinted: true, summaryPerRepair: true, reuseKnownFingerprint: true },
  digest: hash(JSON.stringify(outputs)),
};
fs.writeFileSync(path.join(OUTPUT_DIR, 'latest.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(JSON.stringify(index, null, 2));
