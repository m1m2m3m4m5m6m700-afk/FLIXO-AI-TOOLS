import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { repairPolicy, isPathAllowed } from './auto-repair-policy.mjs';
import { fingerprintFailure, normalizeFailure, loadMemory, findCase, findSimilarCases, scorePlaybook, writeMemory, recordOutcome } from './auto-repair-learning.mjs';
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
const normalizedFailure = normalizeFailure(log);
const evidencePath = '/tmp/flixo-repair-evidence.json';
const git = (args, options = {}) => execFileSync('git', ['-C', targetDir, ...args], { encoding: 'utf8', ...options });
const memory = loadMemory();
const known = findCase(memory, fingerprint);
const similar = findSimilarCases(memory, { fingerprint, normalized: normalizedFailure, features: [] });
const features = [...new Set([...(known?.features ?? []), ...similar.flatMap(({ case: item }) => item.features ?? [])])];

if ((known?.attempts ?? 0) >= repairPolicy.maxAttemptsPerFingerprint) {
  console.log('AUTO_REPAIR_RESULT=LEARNING_MEMORY_BLOCK');
  process.exit(0);
}
if (repairPolicy.requireCleanGitBeforeRepair && git(['status', '--porcelain']).trim()) throw new Error('AUTO_REPAIR_DIRTY_WORKTREE');

const plan = planRepair(log, memory);
const specialist = selectSpecialist(plan.features);
let selected = plan.selected;
const historicalRules = [...(known?.rules ?? []), ...similar.flatMap(({ case: item }) => item.rules ?? [])];
const historicalCandidate = plan.candidates.find((candidate) => historicalRules.includes(candidate.id) && candidate.mutate && candidate.adaptiveConfidence >= 90);
if (historicalCandidate && (!selected || scorePlaybook(memory, specialist?.id ?? 'unknown', historicalCandidate.id) >= scorePlaybook(memory, specialist?.id ?? 'unknown', selected.id))) selected = historicalCandidate;
const targetSha = git(['rev-parse', 'HEAD']).trim();
const attempt = (known?.attempts ?? 0) + 1;
const evidence = {
  schemaVersion: 4,
  fingerprint,
  targetSha,
  features: plan.features,
  specialist,
  attempt,
  attemptBudget: repairPolicy.maxAttemptsPerFingerprint,
  candidates: plan.candidates,
  selected: selected?.id ?? null,
  risk: selected?.risk ?? 'human-gate',
  historical: { exact: Boolean(known), similar: similar.map(({ case: item, score }) => ({ fingerprint: item.fingerprint, score, rules: item.rules ?? [] })) },
  provenance: { failedSha: targetSha, changedPaths: [], rule: selected?.id ?? null },
  outcome: 'diagnostic-only',
  changedPaths: [],
  updatedAt: new Date().toISOString(),
};

if (!selected) {
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, { fingerprint, normalizedFailure, features: plan.features, rootCause: specialist?.id ?? 'unknown', outcome: 'proposed', verification: 'none', risk: 'human-gate', preventionRule: 'No safe mutation candidate; escalate with evidence.' });
  writeMemory(memory);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=none\nAUTO_REPAIR_FINGERPRINT=${fingerprint}`);
  process.exit(0);
}

const gate = confidenceGate({ selected, features: plan.features, maxFiles: repairPolicy.maxChangedFiles, maxLines: repairPolicy.maxChangedLines });
evidence.confidenceGate = gate;
if (!gate.allowed) {
  evidence.outcome = 'proposal-only';
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, { fingerprint, normalizedFailure, features: plan.features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'proposed', verification: 'confidence-gate-blocked', risk: selected.risk, preventionRule: 'Require guarded or human-gated repair for this class.' });
  writeMemory(memory);
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
  evidence.provenance.changedPaths = diffSummary.files;
  if (!diffSummary.files.length || diffSummary.files.length > repairPolicy.maxChangedFiles || diffSummary.lines > repairPolicy.maxChangedLines || diffSummary.files.some((path) => !isPathAllowed(path))) {
    evidence.outcome = 'blocked';
    rollback(targetDir, before);
    recordOutcome(memory, { fingerprint, normalizedFailure, features: plan.features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'blocked', verification: 'scope-policy', risk: selected.risk, provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: 'Reject repairs outside the bounded change policy.' });
    writeMemory(memory);
    writeEvidence(evidencePath, evidence);
    process.exitCode = 2;
  } else {
    evidence.reproductionAfter = reproduce(targetDir, impactedTests(plan.features));
    const regressionCommands = [['npm', ['run', 'typecheck']], ['npm', ['run', 'test:static']], ['npm', ['run', 'test:build']]];
    const originalGate = process.env.FLIXO_ORIGINAL_GATE;
    if (originalGate === 'browser' || plan.features.includes('playwright') || plan.features.includes('webkit')) regressionCommands.push(['npm', ['run', 'test:browser']]);
    if (originalGate === 'certification' || plan.features.includes('certification')) regressionCommands.push(['npm', ['run', 'verify:ci-cd-trust']]);
    evidence.regression = runRegression(targetDir, regressionCommands);
    evidence.originalGate = originalGate ?? (plan.features.includes('playwright') || plan.features.includes('webkit') ? 'browser' : plan.features.includes('certification') ? 'certification' : 'static+build');
    if (!evidence.reproductionAfter.ok || !evidence.regression.ok) {
      rollback(targetDir, before);
      evidence.outcome = 'rolled-back';
      evidence.rollback = true;
      recordOutcome(memory, { fingerprint, normalizedFailure, features: plan.features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'failure', verification: 'reproduction/regression-failed', risk: selected.risk, provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: 'Do not reuse this rule until a later verified success supersedes the failed attempt.' });
      writeMemory(memory);
      writeEvidence(evidencePath, evidence);
      process.exitCode = 3;
    } else {
      evidence.outcome = 'verified-repair';
      evidence.verification = { reproduction: true, regression: true, originalGate: evidence.originalGate };
      recordOutcome(memory, { fingerprint, normalizedFailure, features: plan.features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'success', verification: `typecheck+static+build+${evidence.originalGate}`, risk: selected.risk, provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: `Prevent recurrence of ${fingerprint} by retaining verified rule ${selected.id}.` });
      writeMemory(memory);
      writeEvidence(evidencePath, evidence);
    }
  }
} catch (error) {
  rollback(targetDir, before);
  evidence.outcome = 'rolled-back';
  evidence.error = String(error?.message ?? error);
  evidence.rollback = true;
  recordOutcome(memory, { fingerprint, normalizedFailure, features: plan.features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'failure', verification: 'exception', risk: selected.risk, provenance: { targetSha }, preventionRule: 'Do not repeat an exception-producing repair without new evidence.' });
  writeMemory(memory);
  writeEvidence(evidencePath, evidence);
  process.exitCode = 4;
}
