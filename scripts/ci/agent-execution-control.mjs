#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, 'diagnostics/agents/execution-control');
const TASK_AGENT = path.resolve(ROOT, 'scripts/ci/task-agent.mjs');
const TASK_FILE = path.resolve(ROOT, 'مهام.md');
const MAX_STAGES = 10;
const MAX_REPAIR_CYCLES = 12;

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const now = () => new Date().toISOString();
const sha = git(['rev-parse', 'HEAD']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function runTaskAgent(taskId = '') {
  const args = [TASK_AGENT];
  if (taskId) args.push(`--task-id=${taskId}`);
  execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
}
function latestPacket() {
  const latest = path.join(ROOT, 'diagnostics/agents/task-agent/latest.json');
  if (!fs.existsSync(latest)) throw new Error('TASK_AGENT_OUTPUT_MISSING');
  const index = readJson(latest);
  if (!index.preparedOnly || index.mode !== 'PREPARATION_ONLY') throw new Error('TASK_AGENT_BOUNDARY_VIOLATION');
  const first = index.selected?.[0];
  if (!first?.output) throw new Error('TASK_AGENT_SELECTED_TASK_MISSING');
  const packet = readJson(first.output);
  if (packet.baselineSha !== sha) throw new Error('STALE_BASELINE');
  if (packet.mutationPolicy !== 'NO_SOURCE_MUTATION_NO_COMMIT_NO_PUSH') throw new Error('MUTATION_POLICY_VIOLATION');
  return packet;
}
function complexityGuard(packet) {
  const fileCount = packet.preparedChanges?.length ?? 0;
  const inspectedCount = packet.inspectedFiles?.length ?? 0;
  if (fileCount > 12) throw new Error('COMPLEXITY_BUDGET_EXCEEDED_PREPARED_FILES');
  if (inspectedCount > 40) throw new Error('COMPLEXITY_BUDGET_EXCEEDED_INSPECTION_FILES');
}
function buildPlan(packet) {
  const stages = [
    ['UNDERSTAND', 'TASK_AGENT'],
    ['INSPECT', 'INSPECTOR'],
    ['PLAN', 'PLANNER'],
    ['PRE_EXECUTION_VERIFY', 'VERIFIER'],
    ['EXECUTE', 'SUPERVISING_EXECUTION_AGENT'],
    ['TEST', 'TESTER'],
    ['VERIFY', 'VERIFIER'],
    ['LEARN', 'LEARNER'],
    ['REPAIR_LOOP', 'ORCHESTRATOR'],
    ['CLOSURE_GATE', 'VERIFIER'],
  ];
  return {
    schemaVersion: 2,
    authority: 'LEAN_AGENT_EXECUTION_CONTROL',
    generatedAt: now(),
    baselineSha: sha,
    taskId: packet.task.taskId,
    status: 'ACTIVE_UNTIL_GREEN',
    complexityBudget: { maxStages: MAX_STAGES, maxPreparedFiles: 12, maxInspectedFiles: 40 },
    singleOrchestrator: true,
    specializedRolesAreStages: true,
    parallelism: 'ONLY_FOR_INDEPENDENT_ISOLATED_WORK',
    failClosed: true,
    completionPolicy: {
      taskRemainsOpenAfterRepair: true,
      codeAppliedIsNotTaskCompletion: true,
      repairMustTriggerFreshVerification: true,
      closureRequiresCanonicalGreen: true,
      closureRequiresNoRedChecks: true,
      closureRequiresFreshExactShaEvidence: true,
    },
    repairLoop: {
      enabled: true,
      maxCycles: MAX_REPAIR_CYCLES,
      mode: 'RED_TO_GREEN',
      cycleRule: 'AFTER_EVERY_REPAIR_RESCAN_ALL_REQUIRED_CHECKS',
      openNewCycleForEveryRedCheck: true,
      sameCycleMayContainMultipleIndependentRedChecks: true,
      newFailuresBecomeNewRepairTargets: true,
      neverCloseOnTargetedFixAlone: true,
      stopConditions: ['CANONICAL_GREEN', 'PROOF_FAILED', 'MAX_REPAIR_CYCLES', 'BLOCKED', 'STALE_BASELINE'],
    },
    stages: stages.map(([stage, owner], index) => ({
      order: index + 1,
      stage,
      owner,
      evidenceRequired: true,
      repeatable: stage === 'REPAIR_LOOP' || stage === 'TEST' || stage === 'VERIFY' || stage === 'LEARN',
    })),
    preparedChanges: packet.preparedChanges ?? [],
    blockers: packet.blockers ?? [],
    verification: packet.verification ?? [],
    handoff: packet.handoff,
  };
}

if (!fs.existsSync(TASK_FILE)) throw new Error('TASK_FILE_NOT_FOUND=مهام.md');
fs.mkdirSync(OUT, { recursive: true });
const taskId = process.argv.find((arg) => arg.startsWith('--task-id='))?.slice('--task-id='.length) ?? '';
runTaskAgent(taskId);
const packet = latestPacket();
complexityGuard(packet);
const plan = buildPlan(packet);
fs.writeFileSync(path.join(OUT, 'latest.json'), `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify(plan, null, 2));
