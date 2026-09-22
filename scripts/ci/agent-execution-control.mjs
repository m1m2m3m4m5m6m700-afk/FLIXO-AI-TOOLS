#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertAgentAdmission } from './repair-protocol.mjs';

const ROOT = process.cwd();
const OUT = process.env.FLIXO_AGENT_EXECUTION_CONTROL_OUTPUT_DIR ?? path.resolve(ROOT, 'diagnostics/agents/execution-control');
const TASK_AGENT_OUTPUT_DIR = process.env.FLIXO_TASK_AGENT_OUTPUT_DIR ?? '/tmp/flixo-task-agent';
const TASK_AGENT = path.resolve(ROOT, 'scripts/ci/task-agent.mjs');
const TASK_FILE = fs.existsSync(path.resolve(ROOT, 'المهام.md')) ? path.resolve(ROOT, 'المهام.md') : path.resolve(ROOT, 'مهام.md');
const MAX_STAGES = 10;
const NORMAL_MAX_REPAIR_CYCLES = 12;
const MAJOR_MAX_REPAIR_CYCLES = 30;
const MAX_STALLED_REPAIR_CYCLES = 3;
const NORMAL_MAX_PREPARED_FILES = 12;
const MAJOR_MAX_PREPARED_FILES = 60;
const NORMAL_MAX_INSPECTED_FILES = 40;
const MAJOR_MAX_INSPECTED_FILES = 240;
const MAJOR_REPAIR_WAVE = /^(1|true|yes|on)$/iu.test(process.env.FLIXO_MAJOR_REPAIR_WAVE ?? '');
const MAX_REPAIR_CYCLES = MAJOR_REPAIR_WAVE ? MAJOR_MAX_REPAIR_CYCLES : NORMAL_MAX_REPAIR_CYCLES;
const MAX_PREPARED_FILES = MAJOR_REPAIR_WAVE ? MAJOR_MAX_PREPARED_FILES : NORMAL_MAX_PREPARED_FILES;
const MAX_INSPECTED_FILES = MAJOR_REPAIR_WAVE ? MAJOR_MAX_INSPECTED_FILES : NORMAL_MAX_INSPECTED_FILES;
const SCOPE_POLICY = 'TASK_PREPARATION_ONLY';
const SCOPE_ENFORCEMENT = 'FAIL_CLOSED';
const TASK_AGENT_CONTRACT_VERSION = 'TASK-AGENT-PREPARATION-v4-ISOLATED-WORKSPACE';
const CONTROL_PLANE_MUTATION_POLICY = 'HUMAN_REVIEW_REQUIRED';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const now = () => new Date().toISOString();
const sha = git(['rev-parse','HEAD']);
const branch = git(['branch','--show-current']);
const repairProtocolAdmission = assertAgentAdmission({ actor: 'assistantController', branch, mutation: false });
const fingerprint = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, 16);

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function runTaskAgent(taskId = '') {
  const args = [TASK_AGENT];
  if (taskId) args.push(`--task-id=${taskId}`);
  else args.push('--all-ready');
  execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, FLIXO_TASK_AGENT_OUTPUT_DIR: TASK_AGENT_OUTPUT_DIR } });
}
function latestPacket() {
  const latest = path.join(TASK_AGENT_OUTPUT_DIR, 'latest.json');
  if (!fs.existsSync(latest)) throw new Error('TASK_AGENT_OUTPUT_MISSING');
  const index = readJson(latest);
  if (index.preparedOnly !== true || index.executionMode !== 'PREPARATION_ONLY') throw new Error('TASK_AGENT_PREPARATION_CONTRACT_VIOLATION');
  if (index.scopePolicy !== SCOPE_POLICY || index.scopeEnforcement !== SCOPE_ENFORCEMENT) throw new Error('TASK_PREPARATION_SCOPE_CONTRACT_VIOLATION');
  if (index.mainBranchMutation !== false) throw new Error('MAIN_BRANCH_MUTATION_POLICY_VIOLATION');
  if (index.repairLoop?.maxCycles !== MAX_REPAIR_CYCLES || index.repairLoop?.circuitBreaker?.maxStalledCycles !== MAX_STALLED_REPAIR_CYCLES) throw new Error('REPAIR_LOOP_BUDGET_DRIFT');
  if (index.changeBudget?.maxPreparedFiles !== MAX_PREPARED_FILES || index.changeBudget?.maxInspectedFiles !== MAX_INSPECTED_FILES) throw new Error('CHANGE_BUDGET_DRIFT');
  if (index.branchPolicy !== 'TWO_BRANCHES_ONLY_EXECUTION_AND_MAIN') throw new Error('TWO_BRANCH_POLICY_VIOLATION');
  if (branch !== 'execution' || index.executionBranch !== 'execution') throw new Error('EXECUTION_BRANCH_VIOLATION');
  if (!index.selected?.length) throw new Error('TASK_AGENT_SELECTED_TASK_MISSING');
  const first = index.selected[0];
  if (!first.output) throw new Error('TASK_AGENT_SELECTED_TASK_MISSING');
  const packet = readJson(first.output);
  if (packet.baselineSha !== sha) throw new Error('STALE_BASELINE');
  if (packet.contractVersion !== TASK_AGENT_CONTRACT_VERSION) throw new Error('TASK_AGENT_CONTRACT_VERSION_MISMATCH');
  if (packet.scopePolicy !== SCOPE_POLICY || packet.scopeEnforcement !== SCOPE_ENFORCEMENT) throw new Error('TASK_AGENT_PREPARATION_PACKET_SCOPE_VIOLATION');
  if (packet.executionAuthority !== 'TASK_PREPARATION_ONLY') throw new Error('TASK_AGENT_EXECUTION_AUTHORITY_VIOLATION');
  if (packet.mutationScope !== 'PREPARATION_ONLY_NO_REPOSITORY_MUTATION') throw new Error('TASK_AGENT_TASK_AGENT_MUTATION_SCOPE_VIOLATION');
  if (packet.humanCommandRequired !== false) throw new Error('HUMAN_COMMAND_DEPENDENCY_VIOLATION');
  if (packet.mainBranchMutation !== false) throw new Error('MAIN_BRANCH_MUTATION_POLICY_VIOLATION');
  if (packet.branchPolicy !== 'TWO_BRANCHES_ONLY_EXECUTION_AND_MAIN') throw new Error('TWO_BRANCH_POLICY_VIOLATION');
  if (packet.controlPlaneMutationPolicy !== CONTROL_PLANE_MUTATION_POLICY) throw new Error('CONTROL_PLANE_MUTATION_POLICY_VIOLATION');
  if (packet.mutationPolicy !== 'NO_DIRECT_MUTATION') throw new Error('TASK_AGENT_DIRECT_MUTATION_POLICY_VIOLATION');
  if (packet.executionBranch !== 'execution') throw new Error('TASK_PREPARATION_BRANCH_VIOLATION');
  if (packet.handoff?.scopeAuthority !== SCOPE_POLICY) throw new Error('TASK_PREPARATION_HANDOFF_SCOPE_VIOLATION');
  if (packet.failureContext?.active && (!packet.cognition || packet.cognition.decision === 'MISSING')) throw new Error('COGNITION_CONTEXT_MISSING');
  if (packet.failureContext?.active) {
    const confidence = packet.cognition?.causalConfidence;
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) throw new Error('COGNITION_CONFIDENCE_INVALID');
    if (packet.cognition?.decision === 'ALLOW_BOUNDED_MUTATION' && (confidence < 0.75 || packet.cognition?.ambiguity === true || packet.cognition?.sourceMutationAllowed !== true)) throw new Error('COGNITION_DECISION_CONFLICT');
    if (packet.cognition?.decision === 'BLOCK_EXTERNAL' && packet.cognition?.sourceMutationAllowed !== false) throw new Error('COGNITION_EXTERNAL_CONFLICT');
  }
  return { index, packet };
}
function complexityGuard(packet) {
  const fileCount = packet.preparedChanges?.length ?? 0;
  const inspectedCount = packet.inspectedFiles?.length ?? 0;
  if (fileCount > MAX_PREPARED_FILES) throw new Error('COMPLEXITY_BUDGET_EXCEEDED_PREPARED_FILES');
  if (inspectedCount > MAX_INSPECTED_FILES) throw new Error('COMPLEXITY_BUDGET_EXCEEDED_INSPECTION_FILES');
}
function buildPlan({ index, packet }) {
  const stages = [
    ['UNDERSTAND', 'TASK_AGENT'], ['INSPECT', 'INSPECTOR'], ['PLAN', 'PLANNER'],
    ['PRE_EXECUTION_VERIFY', 'VERIFIER'], ['EXECUTE', 'REPAIR_AGENT_OR_EXECUTION_AGENT'], ['TEST', 'TESTER'],
    ['VERIFY', 'VERIFIER'], ['LEARN', 'LEARNER'], ['REPAIR_LOOP', 'ORCHESTRATOR'], ['CLOSURE_GATE', 'VERIFIER'],
  ];
  const taskFingerprint = packet.errorFingerprint ?? fingerprint(`${packet.task.taskId}|${packet.task.title}`);
  return {
    schemaVersion: 7,
    authority: 'LEAN_AGENT_EXECUTION_CONTROL',
    generatedAt: now(),
    baselineSha: sha,
    executionBranch: 'execution',
    taskId: packet.task.taskId,
    selectedTaskCount: index.selectedCount ?? index.selected.length,
    status: 'ACTIVE_UNTIL_GREEN',
    executionMode: 'PREPARATION_ONLY',
    scopePolicy: SCOPE_POLICY,
    scopeEnforcement: SCOPE_ENFORCEMENT,
    executionAuthority: 'TASK_PREPARATION_ONLY',
    mutationScope: 'PREPARE_CURRENT_TASK_SCOPE_ONLY',
    humanCommandRequired: false,
    branchPolicy: 'TWO_BRANCHES_ONLY_EXECUTION_AND_MAIN',
    controlPlaneMutationPolicy: CONTROL_PLANE_MUTATION_POLICY,
    repairProtocol: repairProtocolAdmission.protocol,
    controlPlaneMutationScope: 'AUTO_REPAIR_CONTROLLER_FILES_MUST_NOT_BE_MUTATED_BY_AUTO_REPAIR',
    allowedWork: 'TASK_UNDERSTANDING_AND_BOUNDED_PREPARATION_ONLY',
    forbiddenWork: ['UNRELATED_PRODUCT_WORK','OPPORTUNISTIC_CLEANUP','GATE_WEAKENING','MAIN_MUTATION','THIRD_BRANCH_CREATION','UNAUTHORIZED_TRUST_CONTROL_CHANGES'],
    complexityBudget: { maxStages: MAX_STAGES, maxPreparedFiles: MAX_PREPARED_FILES, maxInspectedFiles: MAX_INSPECTED_FILES, onExceed: 'REQUIRES_REVIEW', profile: MAJOR_REPAIR_WAVE ? 'MAJOR' : 'NORMAL' },
    singleOrchestrator: true,
    specializedRolesAreStages: true,
    majorRepairWave: MAJOR_REPAIR_WAVE,
    parallelism: 'ONLY_FOR_INDEPENDENT_ISOLATED_WORK_WITHIN_EXECUTION',
    failClosed: true,
    mainBranchMutation: false,
    memory: { errorFingerprint: taskFingerprint, fingerprintStable: true, reuseKnownFingerprint: true, repairSummary: packet.repairSummary },
    majorChangePolicy: MAJOR_REPAIR_WAVE
      ? 'LARGE_SOURCE_CHANGESET_ALLOWED_WITHIN_ACTIVE_FAILURE_ROOT_CAUSE_AND_PROPORTIONAL_HARDENING;ALL_CANONICAL_GATES_REMAIN_MANDATORY'
      : 'NORMAL_BOUNDED_REPAIR',
    greenGate: { canonicalGreen: false, zeroRedChecks: false, freshExactShaEvidence: false, regressionProof: false, closureAllowedOnlyWhenAllRequired: true, required: ['CANONICAL_GREEN','ZERO_RED_CHECKS','FRESH_EXACT_SHA_EVIDENCE','REGRESSION_PROOF','NO_UNPROCESSED_ACTIONABLE_RED'] },
    completionPolicy: { taskRemainsOpenAfterRepair: true, codeAppliedIsNotTaskCompletion: true, repairMustTriggerFreshVerification: true, closureRequiresCanonicalGreen: true, closureRequiresNoRedChecks: true, closureRequiresFreshExactShaEvidence: true, closureRequiresZeroUnprocessedActionableRed: true, redPolicy: 'EVERY_ACTIONABLE_RED_REQUIRES_REPAIR_ATTEMPT' },
    repairLoop: { enabled: true, maxCycles: MAX_REPAIR_CYCLES, mode: 'RED_TO_GREEN', cycleRule: 'AFTER_EVERY_REPAIR_RESCAN_ALL_REQUIRED_CHECKS', openNewCycleForEveryRedCheck: true, sameCycleMayContainMultipleIndependentRedChecks: true, newFailuresBecomeNewRepairTargets: true, neverCloseOnTargetedFixAlone: true, circuitBreaker: { enabled: true, maxStalledCycles: MAX_STALLED_REPAIR_CYCLES, definition: 'SAME_FAILURE_FINGERPRINT_WITHOUT_VERIFIABLE_PROGRESS', fingerprintScope: 'RED_CHECKS_AND_REPAIR_TARGETS', progressEvidence: 'CHECK_STATE_OR_ERROR_FINGERPRINT_CHANGED', action: 'PERSIST_TASK_AND_RECOVER_AND_REDISPATCH_WITH_NEW_EVIDENCE', failClosed: true }, sessionPolicy: { maxSessionCycles: MAX_REPAIR_CYCLES, budgetIsSessionScoped: true, onBudgetExhausted: 'RECOVER_AND_REDISPATCH', taskRemainsOpen: true, closureAllowedOnlyWhenCanonicalGreen: true }, stopConditions: ['CANONICAL_GREEN'], nonGreenTerminalGuards: ['PROOF_FAILED','MAX_REPAIR_CYCLES','CIRCUIT_BREAKER_OPEN','BLOCKED','STALE_BASELINE'], onNonGreenSessionEnd: 'PERSIST_CONTINUATION_AND_REDISPATCH' },
    stages: stages.map(([stage, owner], i) => ({ order: i + 1, stage, owner, evidenceRequired: true, repeatable: stage === 'REPAIR_LOOP' || stage === 'TEST' || stage === 'VERIFY' || stage === 'LEARN' })),
    preparedChanges: packet.preparedChanges ?? [],
    inspectedFiles: packet.inspectedFiles ?? [],
    blockers: packet.blockers ?? [], verification: packet.verification ?? [], handoff: packet.handoff,
  };
}

if (!fs.existsSync(TASK_FILE)) throw new Error('TASK_FILE_NOT_FOUND=المهام.md|legacy=مهام.md');
if (branch !== 'execution') throw new Error('DIRECT_EXECUTION_REQUIRES_EXECUTION_BRANCH');
fs.mkdirSync(OUT, { recursive: true });
const taskId = process.argv.find((arg) => arg.startsWith('--task-id='))?.slice('--task-id='.length) ?? '';
runTaskAgent(taskId);
const payload = latestPacket();
complexityGuard(payload.packet);
const plan = buildPlan(payload);
fs.writeFileSync(path.join(OUT, 'latest.json'), `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify(plan, null, 2));