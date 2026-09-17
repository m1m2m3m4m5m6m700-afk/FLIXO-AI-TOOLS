#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, 'diagnostics/agents/execution-control');
const TASK_AGENT = path.resolve(ROOT, 'scripts/ci/task-agent.mjs');
const TASK_FILE = path.resolve(ROOT, 'مهام.md');
const MAX_STAGES = 10;
const MAX_REPAIR_CYCLES = 12;
const MAX_STALLED_REPAIR_CYCLES = 3;
const MAX_PREPARED_FILES = 12;
const MAX_INSPECTED_FILES = 40;

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const now = () => new Date().toISOString();
const sha = git(['rev-parse','HEAD']);
const branch = git(['branch','--show-current']);
const fingerprint = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, 16);

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function runTaskAgent(taskId = '') {
  const args = [TASK_AGENT];
  if (taskId) args.push(`--task-id=${taskId}`);
  else args.push('--all-ready');
  execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
}
function latestPacket() {
  const latest = path.join(ROOT, 'diagnostics/agents/task-agent/latest.json');
  if (!fs.existsSync(latest)) throw new Error('TASK_AGENT_OUTPUT_MISSING');
  const index = readJson(latest);
  if (index.preparedOnly !== false || !String(index.executionMode).includes('DIRECT_ON_ISOLATED_REPAIR_BRANCH')) throw new Error('TASK_AGENT_DIRECT_EXECUTION_CONTRACT_VIOLATION');
  if (!index.selected?.length) throw new Error('TASK_AGENT_SELECTED_TASK_MISSING');
  const first = index.selected[0];
  if (!first.output) throw new Error('TASK_AGENT_SELECTED_TASK_MISSING');
  const packet = readJson(first.output);
  if (packet.baselineSha !== sha) throw new Error('STALE_BASELINE');
  if (packet.mutationPolicy !== 'DIRECT_SOURCE_MUTATION_COMMIT_PUSH_ON_REPAIR_BRANCH') throw new Error('DIRECT_MUTATION_POLICY_VIOLATION');
  if (!packet.executionBranch || packet.executionBranch === 'main' || packet.executionBranch !== branch) throw new Error('DIRECT_EXECUTION_BRANCH_VIOLATION');
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
    ['PRE_EXECUTION_VERIFY', 'VERIFIER'], ['EXECUTE', 'TASK_AGENT'], ['TEST', 'TESTER'],
    ['VERIFY', 'VERIFIER'], ['LEARN', 'LEARNER'], ['REPAIR_LOOP', 'ORCHESTRATOR'], ['CLOSURE_GATE', 'VERIFIER'],
  ];
  const taskFingerprint = packet.errorFingerprint ?? fingerprint(`${packet.task.taskId}|${packet.task.title}`);
  return {
    schemaVersion: 5,
    authority: 'LEAN_AGENT_EXECUTION_CONTROL',
    generatedAt: now(),
    baselineSha: sha,
    executionBranch: branch,
    taskId: packet.task.taskId,
    selectedTaskCount: index.selectedCount ?? index.selected.length,
    status: 'ACTIVE_UNTIL_GREEN',
    executionMode: 'DIRECT_ON_ISOLATED_REPAIR_BRANCH',
    complexityBudget: { maxStages: MAX_STAGES, maxPreparedFiles: MAX_PREPARED_FILES, maxInspectedFiles: MAX_INSPECTED_FILES, onExceed: 'REQUIRES_REVIEW' },
    singleOrchestrator: true,
    specializedRolesAreStages: true,
    parallelism: 'ONLY_FOR_INDEPENDENT_ISOLATED_WORK',
    failClosed: true,
    mainBranchMutation: false,
    memory: { errorFingerprint: taskFingerprint, fingerprintStable: true, reuseKnownFingerprint: true, repairSummary: packet.repairSummary },
    greenGate: { canonicalGreen: false, zeroRedChecks: false, freshExactShaEvidence: false, regressionProof: false, closureAllowedOnlyWhenAllRequired: true, required: ['CANONICAL_GREEN','ZERO_RED_CHECKS','FRESH_EXACT_SHA_EVIDENCE','REGRESSION_PROOF'] },
    completionPolicy: { taskRemainsOpenAfterRepair: true, codeAppliedIsNotTaskCompletion: true, repairMustTriggerFreshVerification: true, closureRequiresCanonicalGreen: true, closureRequiresNoRedChecks: true, closureRequiresFreshExactShaEvidence: true },
    repairLoop: { enabled: true, maxCycles: MAX_REPAIR_CYCLES, mode: 'RED_TO_GREEN', cycleRule: 'AFTER_EVERY_REPAIR_RESCAN_ALL_REQUIRED_CHECKS', openNewCycleForEveryRedCheck: true, sameCycleMayContainMultipleIndependentRedChecks: true, newFailuresBecomeNewRepairTargets: true, neverCloseOnTargetedFixAlone: true, circuitBreaker: { enabled: true, maxStalledCycles: MAX_STALLED_REPAIR_CYCLES, definition: 'SAME_FAILURE_FINGERPRINT_WITHOUT_VERIFIABLE_PROGRESS', fingerprintScope: 'RED_CHECKS_AND_REPAIR_TARGETS', progressEvidence: 'CHECK_STATE_OR_ERROR_FINGERPRINT_CHANGED', action: 'REQUIRES_REVIEW', failClosed: true }, stopConditions: ['CANONICAL_GREEN','PROOF_FAILED','MAX_REPAIR_CYCLES','CIRCUIT_BREAKER_OPEN','BLOCKED','STALE_BASELINE'] },
    stages: stages.map(([stage, owner], i) => ({ order: i + 1, stage, owner, evidenceRequired: true, repeatable: stage === 'REPAIR_LOOP' || stage === 'TEST' || stage === 'VERIFY' || stage === 'LEARN' })),
    preparedChanges: packet.preparedChanges ?? [],
    blockers: packet.blockers ?? [], verification: packet.verification ?? [], handoff: packet.handoff,
  };
}

if (!fs.existsSync(TASK_FILE)) throw new Error('TASK_FILE_NOT_FOUND=مهام.md');
if (!branch || branch === 'main') throw new Error('DIRECT_EXECUTION_REQUIRES_ISOLATED_BRANCH');
fs.mkdirSync(OUT, { recursive: true });
const taskId = process.argv.find((arg) => arg.startsWith('--task-id='))?.slice('--task-id='.length) ?? '';
runTaskAgent(taskId);
const payload = latestPacket();
complexityGuard(payload.packet);
const plan = buildPlan(payload);
fs.writeFileSync(path.join(OUT, 'latest.json'), `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify(plan, null, 2));
