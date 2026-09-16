import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { repairPolicy, isPathAllowed } from './auto-repair-policy.mjs';
import { fingerprintFailure, loadMemory, findCase, writeMemory, recordOutcome } from './auto-repair-learning.mjs';
import { planRepair } from './auto-repair/planner.mjs';
import { selectSpecialist } from './auto-repair/specialists.mjs';
import { confidenceGate } from './auto-repair/confidence.mjs';
import { runAstRepair } from './auto-repair/ast-repair.mjs';
import { reproduce, impactedTests } from './auto-repair/reproduction.mjs';
import { runRegression } from './auto-repair/regression.mjs';
import { summarizeDiff, writeEvidence } from './auto-repair/evidence.mjs';
import { snapshot, rollback } from './auto-repair/rollback.mjs';

const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const targetDir = process.env.FLIXO_TARGET_DIR ?? process.cwd();
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const fingerprint = fingerprintFailure(log);
const evidencePath = '/tmp/flixo-repair-evidence.json';
const git = (args, options = {}) => execFileSync('git', ['-C', targetDir, ...args], { encoding: 'utf8', ...options });
const memory = loadMemory();
const known = findCase(memory, fingerprint);

if ((known?.attempts ?? 0) >= repairPolicy.maxAttemptsPerFingerprint) {
  console.log('AUTO_REPAIR_RESULT=LEARNING_MEMORY_BLOCK');
  process.exit(0);
}
if (repairPolicy.requireCleanGitBeforeRepair && git(['status', '--porcelain']).trim()) throw new Error('AUTO_REPAIR_DIRTY_WORKTREE');

const plan = planRepair(log);
const specialist = selectSpecialist(plan.features);
const selected = plan.selected;
const targetSha = git(['rev-parse', 'HEAD']).trim();
const evidence = { schemaVersion: 2, fingerprint, targetSha, features: plan.features, specialist, candidates: plan.candidates, selected: selected?.id ?? null, outcome: 'diagnostic-only', changedPaths: [], updatedAt: new Date().toISOString() };

if (!selected) {
  writeEvidence(evidencePath, evidence);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=none\nAUTO_REPAIR_FINGERPRINT=${fingerprint}`);
  process.exit(0);
}

const gate = confidenceGate({ selected, features: plan.features, maxFiles: repairPolicy.maxChangedFiles, maxLines: repairPolicy.maxChangedLines });
evidence.confidenceGate = gate;
if (!gate.allowed) {
  evidence.outcome = 'proposal-only';
  writeEvidence(evidencePath, evidence);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=${selected.id}`);
  process.exit(0);
}

const before = snapshot(targetDir);
evidence.reproductionBefore = reproduce(targetDir, impactedTests(plan.features));

try {
  evidence.repair = runAstRepair(targetDir, selected);
  const changed = git(['diff', '--binary']);
  const diffSummary = summarizeDiff(changed);
  evidence.diff = diffSummary;
  evidence.changedPaths = diffSummary.files;
  if (!diffSummary.files.length || diffSummary.files.length > repairPolicy.maxChangedFiles || diffSummary.lines > repairPolicy.maxChangedLines || diffSummary.files.some((path) => !isPathAllowed(path))) {
    evidence.outcome = 'blocked';
    rollback(targetDir, before);
    writeEvidence(evidencePath, evidence);
    process.exitCode = 2;
  } else {
    evidence.reproductionAfter = reproduce(targetDir, impactedTests(plan.features));
    evidence.regression = runRegression(targetDir, [['npm', ['run', 'typecheck']], ['npm', ['run', 'test:static']], ['npm', ['run', 'test:build']]]);
    if (!evidence.reproductionAfter.ok || !evidence.regression.ok) {
      rollback(targetDir, before);
      evidence.outcome = 'rolled-back';
      evidence.rollback = true;
      writeEvidence(evidencePath, evidence);
      process.exitCode = 3;
    } else {
      evidence.outcome = 'verified-repair';
      writeEvidence(evidencePath, evidence);
      recordOutcome(memory, { fingerprint, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'success', verification: 'typecheck+static+build+reproduction' });
      writeMemory(memory);
    }
  }
} catch (error) {
  rollback(targetDir, before);
  evidence.outcome = 'rolled-back';
  evidence.error = String(error?.message ?? error);
  evidence.rollback = true;
  writeEvidence(evidencePath, evidence);
  process.exitCode = 4;
}
