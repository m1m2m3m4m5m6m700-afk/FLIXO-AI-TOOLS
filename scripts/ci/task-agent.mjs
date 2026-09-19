#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadMemory, findSimilarCases, deriveReusableKnowledge, rankLessons } from './auto-repair-learning.mjs';

const ROOT = process.cwd();
const TASK_FILE = fs.existsSync(path.join(ROOT, 'المهام.md')) ? path.join(ROOT, 'المهام.md') : path.join(ROOT, 'مهام.md');
const OUTPUT_DIR = process.env.FLIXO_TASK_AGENT_OUTPUT_DIR ?? '/tmp/flixo-task-agent';
const DIAGNOSIS_PATH = process.env.FLIXO_REPAIR_DIAGNOSIS_PATH ?? '/tmp/flixo-root-cause.json';
const CONTRACT_VERSION = 'TASK-AGENT-DIRECT-REPAIR-v2';
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
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
const hash = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

if (!fs.existsSync(TASK_FILE)) throw new Error('TASK_FILE_NOT_FOUND=المهام.md|legacy=مهام.md');
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
const failureRunId = arg('failure-run-id');
const failureSha = arg('failure-sha');
const failureFingerprint = arg('failure-fingerprint');
const failureEvidencePath = arg('failure-evidence');
const repairMode = failureRunId || failureSha || failureFingerprint ? 'ACTIVE_REPAIR_CYCLE_DIRECT_EXECUTION' : 'DIRECT_EXECUTION';
const diagnosis = fs.existsSync(DIAGNOSIS_PATH) ? JSON.parse(fs.readFileSync(DIAGNOSIS_PATH, 'utf8')) : null;
const memory = loadMemory();
const memoryContext = diagnosis
  ? {
      similarCases: findSimilarCases(memory, {
        fingerprint: failureFingerprint || diagnosis.fingerprint || null,
        normalized: diagnosis.normalizedFailure || diagnosis.failure || '',
        features: diagnosis.features || [],
      }),
      reusableKnowledge: deriveReusableKnowledge(memory, {
        rootCause: diagnosis.rootCause || null,
        features: diagnosis.features || [],
        fingerprint: failureFingerprint || diagnosis.fingerprint || null,
      }),
      lessons: rankLessons(memory, {
        fingerprint: failureFingerprint || diagnosis.fingerprint || null,
        rootCause: diagnosis.rootCause || null,
      }).slice(0, 8),
    }
  : { similarCases: [], reusableKnowledge: null, lessons: [] };
const reusableKnowledge = diagnosis?.reusableKnowledge ?? memoryContext.reusableKnowledge;
const activeRepairTask = failureRunId || failureSha || failureFingerprint
  ? [{
      taskId: `repair-${slug(failureFingerprint || 'active-failure').slice(0, 80)}`,
      section: 'ACTIVE REPAIR CYCLE',
      title: `Repair active failure ${failureFingerprint || 'unknown'}`,
      completed: false,
      sourceLine: null,
      sourceText: 'Generated from the current failure context; do not replace with unrelated task backlog work.',
    }]
  : [];
const selected = requested
  ? tasks.filter((task) => task.taskId === requested || task.title.includes(requested))
  : activeRepairTask.length
    ? activeRepairTask
    : allReady
      ? tasks.filter((task) => !task.completed)
      : tasks.filter((task) => !task.completed).slice(0, 1);

if (!selected.length) throw new Error(requested ? `TASK_NOT_FOUND=${requested}` : 'NO_READY_TASKS');
if (branch !== 'execution') throw new Error('DIRECT_EXECUTION_REQUIRES_EXECUTION_BRANCH');

const scopePolicy = 'SELF_HEALING_REPAIR_ONLY';
const scopeEnforcement = 'FAIL_CLOSED';
if (scopePolicy !== 'SELF_HEALING_REPAIR_ONLY' || scopeEnforcement !== 'FAIL_CLOSED') throw new Error('SELF_HEALING_SCOPE_CONTRACT_VIOLATION');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const generatedAt = new Date().toISOString();
const outputs = [];

for (const task of selected) {
  const fingerprint = failureFingerprint || hash(`${task.taskId}|${task.title}|${task.section}`).slice(0, 16);
  const packet = {
    schemaVersion: 8,
    authority: 'FLIXO_TASK_AGENT',
    contractVersion: CONTRACT_VERSION,
    role: 'TASK_OWNER_AND_DIRECT_REPAIR_AGENT',
    mode: repairMode,
    preparedOnly: false,
    executionMode: 'DIRECT_ON_EXECUTION_BRANCH',
    mutationPolicy: 'DIRECT_SOURCE_MUTATION_COMMIT_PUSH_ON_EXECUTION_BRANCH',
    scopePolicy,
    scopeEnforcement,
    allowedWork: 'ACTIVE_SELF_HEALING_REPAIR_CYCLE_OR_EXPLICIT_INCOMPLETE_REPAIR_TASK_ONLY',
    forbiddenWork: ['UNRELATED_PRODUCT_WORK','OPPORTUNISTIC_CLEANUP','GATE_WEAKENING','MAIN_MUTATION','THIRD_BRANCH_CREATION','UNAUTHORIZED_TRUST_CONTROL_CHANGES'],
    taskFile: 'مهام.md',
    task,
    failureContext: {
      active: Boolean(failureRunId || failureSha || failureFingerprint),
      runId: failureRunId || null,
      failedSha: failureSha || null,
      fingerprint,
      evidencePath: failureEvidencePath || null,
      scopeRule: 'ASSIST_CURRENT_FAILURE_BEFORE_CREATING_NEW_TESTS',
      testCreationPolicy: 'NO_NEW_TEST_AS_A_SUBSTITUTE_FOR_SOURCE_REPAIR',
    },
    baselineSha: sha,
    executionBranch: branch,
    mainBranchMutation: false,
    branchPolicy: 'TWO_BRANCHES_ONLY_EXECUTION_AND_MAIN',
    generatedAt,
    errorFingerprint: fingerprint,
    repairSummary: {
      status: repairMode.includes('ACTIVE') ? 'ACTIVE_FAILURE_TARGET' : 'DIRECT_TASK_TARGET',
      taskId: task.taskId,
      fingerprint,
      error: repairMode.includes('ACTIVE') ? 'SEE_FAILURE_EVIDENCE' : 'UNOBSERVED',
      rootCause: diagnosis?.rootCause ?? 'REQUIRES_EVIDENCE',
      repair: 'EXECUTE_SOURCE_FIX_ON_EXECUTION_BRANCH',
      verification: 'REQUIRED_AFTER_SOURCE_REPAIR',
    },
    cognition: diagnosis ? {
      authority: 'AUTO_REPAIR_REASONING_KERNEL',
      schemaVersion: diagnosis.schemaVersion ?? null,
      rootCause: diagnosis.rootCause ?? 'unknown',
      decision: diagnosis.decision ?? 'PROPOSE_ONLY',
      causalConfidence: diagnosis.causalConfidence ?? 0,
      ambiguity: diagnosis.ambiguity ?? true,
      sourceMutationAllowed: diagnosis.sourceMutationAllowed ?? false,
      topHypothesis: diagnosis.topHypothesis?.id ?? diagnosis.rootCause ?? 'unknown',
      secondHypothesis: diagnosis.secondHypothesis?.id ?? null,
      verificationStrategy: diagnosis.verificationStrategy ?? [],
      evidenceDigest: diagnosis.signature ?? null,
      reusableKnowledge,
      memoryContext,
    } : (failureRunId || failureSha || failureFingerprint ? { authority: 'AUTO_REPAIR_REASONING_KERNEL', required: true, decision: 'MISSING' } : null),
    instructions: {
      cognitionRequired: Boolean(failureRunId || failureSha || failureFingerprint),
      mutationDecisionMustMatch: 'ALLOW_BOUNDED_MUTATION',
      objective: repairMode.includes('ACTIVE')
        ? 'Execute only the smallest safe source correction plus proportional hardening for the currently failing repair cycle; do not replace source repair with a newly added test or unrelated work.'
        : 'Execute only the selected repair task directly on execution, verify the result, and leave main untouched.',
      sourcePayload: 'CODE_AND_EXECUTION',
      requiredChangeShape: ['path', 'operation', 'content', 'baselineSha', 'repairRationale'],
    contractVersion: CONTRACT_VERSION,
      verificationRequired: true,
      unresolvedWorkMustBeReported: true,
      currentCycleFirst: true,
      scopeMustRemainSelfHealingOnly: true,
      newTestMayOnlyBeAddedWhen: 'IT_PROVES_REGRESSION_OR_HARDENING_AFTER_THE_SOURCE_FIX_AND_IS_NOT_THE_FIX_ITSELF',
    },
    completionPolicy: {
      stateAfterPreparation: 'NOT_APPLICABLE_DIRECT_EXECUTION',
      stateAfterRepair: 'REPAIR_PENDING_VERIFICATION',
      stateAfterAnyRedCheck: 'REPAIR_PENDING',
      stateAfterGreenCheck: 'REVERIFY_ALL',
      terminalState: 'CLOSED_VERIFIED_ONLY_AFTER_CANONICAL_GREEN',
      codeAppliedIsNotCompletion: true,
      everyRepairOpensAnotherVerificationCycle: true,
      everyRedCheckMustBecomeARepairTarget: true,
      everyActionableRedRequiresSourceRepairAttempt: true,
      noRedCheckMayBeClosedWithoutRepairOrExplicitExternalBlock: true,
      newlyIntroducedFailuresMustOpenNewCycles: true,
      taskCannotBeClosedFromTargetedRegressionAlone: true,
      sourceRepairPrecedesRegressionTest: true,
    },
    repairLoop: {
      mode: 'RED_TO_GREEN_IN_SAME_CYCLE',
      maxCycles: 1000000,
      rescanAfterEveryRepair: true,
      rescanScope: 'ALL_REQUIRED_CHECKS',
      repairOrder: ['capture-failure', 'root-cause', 'source-fix', 'proportional-hardening', 'targeted-regression', 'canonical-ci'],
      circuitBreaker: {
        enabled: true,
        maxStalledCycles: 1000000,
        definition: 'SAME_FAILURE_FINGERPRINT_WITHOUT_VERIFIABLE_PROGRESS',
        fingerprintScope: 'RED_CHECKS_AND_REPAIR_TARGETS',
        progressEvidence: 'CHECK_STATE_OR_ERROR_FINGERPRINT_CHANGED',
        action: 'REQUIRES_REVIEW_AND_REDISPATCH',
        failClosed: true,
      },
      closureGate: ['canonical-ci-green', 'zero-red-checks', 'fresh-exact-sha-evidence', 'required-regression-proof', 'no-unprocessed-actionable-red'],
    },
    preparedChanges: [],
    inspectedFiles: [],
    dependencies: [],
    verification: [],
    blockers: [],
    handoff: {
      consumer: 'CANONICAL_CI_AND_REPAIR_ORCHESTRATOR',
      applyAuthority: 'TASK_AGENT_DIRECT_EXECUTION',
      commitAuthority: 'TASK_AGENT_ON_EXECUTION_BRANCH_ONLY',
      pushAuthority: 'TASK_AGENT_ON_EXECUTION_BRANCH_ONLY',
      completionAuthority: 'VERIFIER_AFTER_CANONICAL_GREEN_ONLY',
      scopeAuthority: 'SELF_HEALING_REPAIR_ONLY',
    },
  };
  const output = path.join(OUTPUT_DIR, `${task.taskId}.json`);
  fs.writeFileSync(output, `${JSON.stringify(packet, null, 2)}\n`);
  outputs.push({ taskId: task.taskId, output, fingerprint });
}

const index = {
  schemaVersion: 8,
  authority: 'FLIXO_TASK_AGENT',
  contractVersion: CONTRACT_VERSION,
  mode: repairMode,
  preparedOnly: false,
  executionMode: 'DIRECT_ON_EXECUTION_BRANCH',
  scopePolicy,
  scopeEnforcement,
  baselineSha: sha,
  executionBranch: branch,
  mainBranchMutation: false,
  branchPolicy: 'TWO_BRANCHES_ONLY_EXECUTION_AND_MAIN',
  generatedAt,
  selected: outputs,
  selectedCount: outputs.length,
  lifecycle: 'ACTIVE_UNTIL_CANONICAL_GREEN',
  failureContext: { runId: failureRunId || null, failedSha: failureSha || null, fingerprint: failureFingerprint || null },
  repairLoop: {
    enabled: true,
    mode: 'RED_TO_GREEN_IN_SAME_CYCLE',
    maxCycles: 1000000,
    rescanAfterEveryRepair: true,
    circuitBreaker: { enabled: true, maxStalledCycles: 1000000, action: 'REQUIRES_REVIEW_AND_REDISPATCH', failClosed: true },
  },
  greenGate: {
    required: ['CANONICAL_GREEN', 'ZERO_RED_CHECKS', 'FRESH_EXACT_SHA_EVIDENCE', 'REGRESSION_PROOF'],
    closureAllowedOnlyWhenAllRequired: true,
  },
  changeBudget: { maxPreparedFiles: 12, maxInspectedFiles: 40, onExceed: 'REQUIRES_REVIEW' },
  memory: { fingerprinted: true, summaryPerRepair: true, reuseKnownFingerprint: true, generalizedAcrossFingerprints: true, promotionRequiresMultipleVerifiedCases: true },
  cognition: diagnosis ? { rootCause: diagnosis.rootCause ?? 'unknown', decision: diagnosis.decision ?? 'PROPOSE_ONLY', causalConfidence: diagnosis.causalConfidence ?? 0, ambiguity: diagnosis.ambiguity ?? true, reusableKnowledge, memoryContext } : { memoryVersion: memory.version, caseCount: memory.cases.length, playbookCount: memory.playbooks.length },
  digest: hash(JSON.stringify(outputs)),
};
fs.writeFileSync(path.join(OUTPUT_DIR, 'latest.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(JSON.stringify(index, null, 2));
