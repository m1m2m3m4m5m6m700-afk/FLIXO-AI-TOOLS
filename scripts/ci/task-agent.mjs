#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadMemory, findSimilarCases, deriveReusableKnowledge, rankLessons } from './auto-repair-learning.mjs';
import { assertAgentAdmission } from './repair-protocol.mjs';

const ROOT = process.cwd();
const TASK_FILE = fs.existsSync(path.join(ROOT, 'المهام.md')) ? path.join(ROOT, 'المهام.md') : path.join(ROOT, 'مهام.md');
const OUTPUT_DIR = process.env.FLIXO_TASK_AGENT_OUTPUT_DIR ?? '/tmp/flixo-task-agent';
const DIAGNOSIS_PATH = process.env.FLIXO_REPAIR_DIAGNOSIS_PATH ?? '/tmp/flixo-root-cause.json';
const CONTRACT_VERSION = 'TASK-AGENT-PREPARATION-v4-ISOLATED-WORKSPACE';
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

function extractBotEvolutionLedger(markdown) {
  const lines = markdown.split(/\r?\n/);
  const keywords = /(AUTO-REPAIR|EXECUTION-BOT|ERROR-INTELLIGENCE|ERROR-MEMORY|WATCHDOG|REPAIR|AGENT|SELF-HEALING|ROOT-CAUSE|CERTIFICATION|EXACT-SHA|REGRESSION|HANDOFF|SECURITY|PROVENANCE|CIRCUIT|BLAST-RADIUS|CROSS-WORKFLOW)/iu;
  const items = [];
  let section = 'UNSCOPED';
  for (let i = 0; i < lines.length; i += 1) {
    const heading = lines[i].match(/^#{1,3}\s+(.+)$/u);
    if (heading) section = heading[1].trim();
    const line = lines[i].trim();
    if (!line || line.startsWith('```') || !keywords.test(line)) continue;
    if (/^\|.*\|$/u.test(line) || /^[-*]\s+/u.test(line) || /^\d+[.)]\s+/u.test(line) || /^STATUS\s*=/iu.test(line)) {
      items.push({ section, line: i + 1, text: line });
    }
  }
  const unique = new Map();
  for (const item of items) {
    const key = item.text.replace(/\s+/gu, ' ').trim();
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].slice(0, 80);
}

const botEvolutionLedger = extractBotEvolutionLedger(source);

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
const executionPromptPath = arg('execution-prompt');
const executionPromptBundle = (() => {
  if (!executionPromptPath) return null;
  try {
    const bundle = JSON.parse(fs.readFileSync(executionPromptPath, 'utf8'));
    if (bundle.executionSha !== sha) throw new Error(`PROMPT_BUNDLE_SHA_MISMATCH:${bundle.executionSha}:${sha}`);
    if (!Array.isArray(bundle.prompts)) throw new Error('PROMPT_BUNDLE_PROMPTS_INVALID');
    const selectedPrompt = failureRunId
      ? bundle.prompts.find((item) => (item.runIds ?? []).map(String).includes(String(failureRunId))) ?? null
      : null;
    return {
      sourcePath: executionPromptPath,
      digest: bundle.digest ?? null,
      bundleSha: bundle.executionSha ?? null,
      sourceRunId: bundle.sourceRunId ?? null,
      selectedPromptId: selectedPrompt?.promptId ?? null,
      selectedPrompt: selectedPrompt?.prompt ?? bundle.masterPrompt ?? null,
      promptCount: Number(bundle.promptCount ?? bundle.prompts.length),
      verifiedExactSha: true,
    };
  } catch (error) {
    throw new Error(`PROMPT_BUNDLE_INVALID:${error?.message ?? error}`, { cause: error });
  }
})();
const repairMode = failureRunId || failureSha || failureFingerprint ? 'ACTIVE_REPAIR_PREPARATION' : 'TASK_PREPARATION';
const diagnosis = fs.existsSync(DIAGNOSIS_PATH) ? JSON.parse(fs.readFileSync(DIAGNOSIS_PATH, 'utf8')) : null;
const memory = loadMemory();
const currentOriginExecutionSha = (() => {
  try { return execFileSync('git', ['rev-parse', 'origin/execution'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; }
})();
if (currentOriginExecutionSha && currentOriginExecutionSha !== sha) {
  throw new Error('STALE_EXECUTION_BASELINE=HEAD:' + sha + ':ORIGIN_EXECUTION:' + currentOriginExecutionSha);
}

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
if (branch !== 'execution') throw new Error('TASK_PREPARATION_REQUIRES_EXECUTION_BRANCH');
const repairProtocolAdmission = assertAgentAdmission({ actor: 'taskAgent', branch, mutation: false });

const scopePolicy = 'TASK_PREPARATION_ONLY';
const executionAuthority = 'TASK_PREPARATION_ONLY';
const mutationScope = 'PREPARATION_ONLY_NO_REPOSITORY_MUTATION';
const humanCommandRequired = false;
const scopeEnforcement = 'FAIL_CLOSED';
const controlPlaneMutationPolicy = 'HUMAN_REVIEW_REQUIRED';
const repairProtocol = repairProtocolAdmission.protocol;
if (scopePolicy !== 'TASK_PREPARATION_ONLY' || scopeEnforcement !== 'FAIL_CLOSED') throw new Error('TASK_PREPARATION_SCOPE_CONTRACT_VIOLATION');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const generatedAt = new Date().toISOString();
const outputs = [];

for (const task of selected) {
  const fingerprint = failureFingerprint || hash(`${task.taskId}|${task.title}|${task.section}`).slice(0, 16);
  const packet = {
    schemaVersion: 8,
    authority: 'FLIXO_TASK_AGENT',
    contractVersion: CONTRACT_VERSION,
    role: 'TASK_OWNER_AND_PREPARATION_AGENT',
    mode: repairMode,
    preparedOnly: true,
    executionMode: 'PREPARATION_ONLY',
    mutationPolicy: 'NO_DIRECT_MUTATION',
    scopePolicy,
    scopeEnforcement,
    executionAuthority,
    mutationScope,
    humanCommandRequired,
    allowedWork: 'TASK_UNDERSTANDING_AND_BOUNDED_PREPARATION_ONLY',
    forbiddenWork: ['UNRELATED_PRODUCT_WORK','OPPORTUNISTIC_CLEANUP','DIRECT_SOURCE_MUTATION','COMMIT','PUSH','PR_CREATE','MERGE','CERTIFICATION','GATE_WEAKENING','MAIN_MUTATION','THIRD_BRANCH_CREATION','UNAUTHORIZED_TRUST_CONTROL_CHANGES'],
    taskFile: 'مهام.md',
    task,
    botEvolution: {
      source: 'مهام.md',
      extractedCount: botEvolutionLedger.length,
      priorities: ['ERROR_INTELLIGENCE','SELF_HEALING_REPAIR_LOOP','EXACT_SHA_AND_PROVENANCE','REGRESSION_AND_BLAST_RADIUS','WATCHDOG_AND_HANDOFF','MEMORY_AND_HISTORICAL_LEARNING'],
      ledgerItems: botEvolutionLedger,
      policy: 'ADVISORY_ONLY_NO_SCOPE_EXPANSION',
    },
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
    controlPlaneMutationPolicy,
    repairProtocol,
    controlPlaneMutationScope: 'AUTO_REPAIR_CONTROLLER_FILES_MUST_NOT_BE_MUTATED_BY_AUTO_REPAIR',
    generatedAt,
    errorFingerprint: fingerprint,
    executionPrompt: executionPromptBundle,
    repairSummary: {
      status: repairMode.includes('ACTIVE') ? 'ACTIVE_FAILURE_PREPARATION' : 'TASK_PREPARATION',
      taskId: task.taskId,
      fingerprint,
      error: repairMode.includes('ACTIVE') ? 'SEE_FAILURE_EVIDENCE' : 'UNOBSERVED',
      rootCause: diagnosis?.rootCause ?? 'REQUIRES_EVIDENCE',
      repair: 'PREPARE_SOURCE_FIX_FOR_AUTHORIZED_EXECUTION_OR_REPAIR_AGENT',
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
      downstreamMutationDecisionMustBeRevalidated: true,
      objective: repairMode.includes('ACTIVE')
        ? 'Prepare only the smallest evidence-backed source correction and verification obligations for the active repair cycle; never mutate the repository.'
        : 'Prepare only the selected task and exact downstream changes for an authorized execution or repair agent; never mutate the repository.',
      sourcePayload: 'CODE_AND_EXECUTION',
      requiredChangeShape: ['path', 'operation', 'content', 'baselineSha', 'repairRationale'],
    contractVersion: CONTRACT_VERSION,
      verificationRequired: true,
      unresolvedWorkMustBeReported: true,
      currentCycleFirst: true,
      scopeMustRemainTaskPreparationOnly: true,
      newTestMayOnlyBeAddedWhen: 'IT_IS_REQUIRED_BY_THE_PREPARED_VERIFICATION_PLAN_AND_IS_NOT_USED_AS_A_SUBSTITUTE_FOR_SOURCE_REPAIR',
    },
    completionPolicy: {
      stateAfterPreparation: 'PREPARED_PACKET_READY',
      stateAfterRepair: 'NOT_APPLICABLE_PREPARATION_ONLY',
      stateAfterAnyRedCheck: 'REPAIR_PENDING',
      stateAfterGreenCheck: 'REVERIFY_ALL',
      terminalState: 'CLOSED_VERIFIED_ONLY_AFTER_CANONICAL_GREEN',
      codeAppliedIsNotCompletion: true,
      everyRepairOpensAnotherVerificationCycle: true,
      everyRedCheckMustBecomeARepairTarget: true,
      everyActionableRedRequiresSourceRepairAttempt: true,
      noRedCheckMayBeClosedWithoutRepairOrExplicitExternalBlock: true,
      sessionBudgetScope: 'SESSION_ONLY',
      onSessionBudgetExhausted: 'RECOVER_AND_REDISPATCH',
      taskRemainsOpenAfterSessionEnd: true,
      closureRequiresCanonicalGreen: true,
      newlyIntroducedFailuresMustOpenNewCycles: true,
      taskCannotBeClosedFromTargetedRegressionAlone: true,
      sourceRepairPrecedesRegressionTest: true,
    },
    repairLoop: {
      enabled: true,
      delegatedTo: 'REPAIR_AGENT_OR_EXECUTION_AGENT',
      mode: 'DELEGATED_RED_TO_GREEN',
      budgetScope: 'SESSION_ONLY',
      maxCycles: 12,
      onBudgetExhausted: 'RECOVER_AND_REDISPATCH',
      taskRemainsOpen: true,
      stopConditions: ['CANONICAL_GREEN'],
      nonGreenTerminalGuards: ['PROOF_FAILED','CIRCUIT_BREAKER_OPEN','BLOCKED','STALE_BASELINE'],
      rescanAfterEveryRepair: true,
      rescanScope: 'ALL_REQUIRED_CHECKS',
      repairOrder: ['capture-failure', 'root-cause', 'source-fix', 'proportional-hardening', 'targeted-regression', 'canonical-ci'],
      circuitBreaker: {
        enabled: true,
        maxStalledCycles: 3,
        definition: 'SAME_FAILURE_FINGERPRINT_WITHOUT_VERIFIABLE_PROGRESS',
        fingerprintScope: 'RED_CHECKS_AND_REPAIR_TARGETS',
        progressEvidence: 'CHECK_STATE_OR_ERROR_FINGERPRINT_CHANGED',
        action: 'PERSIST_TASK_AND_RECOVER_AND_REDISPATCH_WITH_NEW_EVIDENCE',
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
      consumer: 'AUTHORIZED_EXECUTION_AGENT_OR_REPAIR_AGENT',
      applyAuthority: 'EXECUTION_AGENT_OR_REPAIR_AGENT',
      commitAuthority: 'EXECUTION_AGENT_OR_REPAIR_AGENT_ON_EXECUTION_ONLY',
      pushAuthority: 'EXECUTION_AGENT_OR_REPAIR_AGENT_ON_EXECUTION_ONLY',
      completionAuthority: 'VERIFIER_AFTER_CANONICAL_GREEN_ONLY',
      scopeAuthority: 'TASK_PREPARATION_ONLY',
      executionAuthority,
      mutationScope,
      humanCommandRequired,
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
  preparedOnly: true,
  executionMode: 'PREPARATION_ONLY',
  scopePolicy,
  scopeEnforcement,
  executionAuthority,
  mutationScope,
  humanCommandRequired,
  baselineSha: sha,
  executionBranch: branch,
  mainBranchMutation: false,
  branchPolicy: 'TWO_BRANCHES_ONLY_EXECUTION_AND_MAIN',
  controlPlaneMutationPolicy,
  controlPlaneMutationScope: 'AUTO_REPAIR_CONTROLLER_FILES_MUST_NOT_BE_MUTATED_BY_AUTO_REPAIR',
  generatedAt,
  selected: outputs,
  executionPrompt: executionPromptBundle ? { digest: executionPromptBundle.digest, selectedPromptId: executionPromptBundle.selectedPromptId, verifiedExactSha: executionPromptBundle.verifiedExactSha } : null,
  selectedCount: outputs.length,
  lifecycle: 'PREPARATION_HANDOFF_PENDING_CHAIR1_AGGREGATION',
  workspaceContract: {
    protocol: 'FLIXO-AGENT-ISOLATED-WORKSPACE-v1',
    mode: 'DETACHED_WORKSPACE',
    entrySha: sha,
    relationToExecutionHeadAfterEntry: 'NONE',
    resultEditableBy: 'CHAIR_1',
    publicationAuthority: 'CHAIR_1',
  },
  failureContext: { runId: failureRunId || null, failedSha: failureSha || null, fingerprint: failureFingerprint || null },
  repairLoop: {
    enabled: true,
    delegatedTo: 'REPAIR_AGENT_OR_EXECUTION_AGENT',
    mode: 'DELEGATED_RED_TO_GREEN',
    budgetScope: 'SESSION_ONLY',
    maxCycles: 12,
    onBudgetExhausted: 'RECOVER_AND_REDISPATCH',
    taskRemainsOpen: true,
    stopConditions: ['CANONICAL_GREEN'],
    rescanAfterEveryRepair: true,
    circuitBreaker: { enabled: true, maxStalledCycles: 3, action: 'PERSIST_TASK_AND_RECOVER_AND_REDISPATCH_WITH_NEW_EVIDENCE', failClosed: true },
  },
  greenGate: {
    required: ['CANONICAL_GREEN', 'ZERO_RED_CHECKS', 'FRESH_EXACT_SHA_EVIDENCE', 'REGRESSION_PROOF', 'NO_UNPROCESSED_ACTIONABLE_RED'],
    closureAllowedOnlyWhenAllRequired: true,
  },
  changeBudget: { maxPreparedFiles: 12, maxInspectedFiles: 40, onExceed: 'REQUIRES_REVIEW' },
  memory: { fingerprinted: true, summaryPerRepair: true, reuseKnownFingerprint: true, generalizedAcrossFingerprints: true, promotionRequiresMultipleVerifiedCases: true },
  cognition: diagnosis ? { rootCause: diagnosis.rootCause ?? 'unknown', decision: diagnosis.decision ?? 'PROPOSE_ONLY', causalConfidence: diagnosis.causalConfidence ?? 0, ambiguity: diagnosis.ambiguity ?? true, reusableKnowledge, memoryContext } : { memoryVersion: memory.version, caseCount: memory.cases.length, playbookCount: memory.playbooks.length },
  digest: hash(JSON.stringify(outputs)),
};
fs.writeFileSync(path.join(OUTPUT_DIR, 'latest.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(JSON.stringify(index, null, 2));
