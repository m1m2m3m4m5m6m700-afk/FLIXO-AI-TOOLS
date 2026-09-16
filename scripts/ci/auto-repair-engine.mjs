import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { repairPolicy, isPathAllowed } from './auto-repair-policy.mjs';
import { fingerprintFailure, normalizeFailure, extractFeatures, loadMemory, findCase, findSimilarCases, scorePlaybook, writeMemory, recordOutcome } from './auto-repair-learning.mjs';
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
const features = extractFeatures(log);
const evidencePath = '/tmp/flixo-repair-evidence.json';
const git = (args, options = {}) => execFileSync('git', ['-C', targetDir, ...args], { encoding: 'utf8', ...options });
const memory = loadMemory();
const known = findCase(memory, fingerprint);
const similar = findSimilarCases(memory, { fingerprint, normalized: normalizedFailure, features });

if ((known?.attempts ?? 0) >= repairPolicy.maxAttemptsPerFingerprint) {
  console.log('AUTO_REPAIR_RESULT=LEARNING_MEMORY_BLOCK');
  process.exit(0);
}
if (repairPolicy.requireCleanGitBeforeRepair && git(['status', '--porcelain']).trim()) throw new Error('AUTO_REPAIR_DIRTY_WORKTREE');

const plan = planRepair(log);
const specialist = selectSpecialist(plan.features);
let selected = plan.selected;
const historicalRules = [
  ...(known?.rules ?? []),
  ...similar.flatMap(({ case: item }) => item.rules ?? []),
];
const historicalCandidate = plan.candidates.find((candidate) => historicalRules.includes(candidate.id) && candidate.mutate && candidate.confidence >= 90);
if (historicalCandidate && (!selected || scorePlaybook(memory, specialist?.id ?? 'unknown', historicalCandidate.id) >= scorePlaybook(memory, specialist?.id ?? 'unknown', selected.id))) selected = historicalCandidate;
const targetSha = git(['rev-parse', 'HEAD']).trim();
const evidence = { schemaVersion: 4, fingerprint, targetSha, features, specialist, candidates: plan.candidates, selected: selected?.id ?? null, historical: { exact: Boolean(known), similar: similar.map(({ case: item, score }) => ({ fingerprint: item.fingerprint, score, rules: item.rules ?? [] })) }, outcome: 'diagnostic-only', changedPaths: [], updatedAt: new Date().toISOString() };

if (!selected) {
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', outcome: 'proposed', verification: 'none', preventionRule: 'No safe mutation candidate; escalate with evidence.' });
  writeMemory(memory);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=none\nAUTO_REPAIR_FINGERPRINT=${fingerprint}`);
  process.exit(0);
}

const gate = confidenceGate({ selected, features: plan.features, maxFiles: repairPolicy.maxChangedFiles, maxLines: repairPolicy.maxChangedLines });
evidence.confidenceGate = gate;
if (!gate.allowed) {
  evidence.outcome = 'proposal-only';
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'proposed', verification: 'confidence-gate-blocked', preventionRule: 'Require guarded or human-gated repair for this class.' });
  writeMemory(memory);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=${selected.id}`);
  process.exit(0);
}

const before = snapshot(targetDir);
evidence.reproductionCommands = impactedTests(plan.features);
evidence.reproductionBefore = reproduce(targetDir, evidence.reproductionCommands);

try {
  evidence.repair = runAstRepair(targetDir, selected);
  const changed = git(['diff', '--binary']);
  const diffSummary = summarizeDiff(changed);
  evidence.diff = diffSummary;
  evidence.changedPaths = diffSummary.files;
  if (!diffSummary.files.length || diffSummary.files.length > repairPolicy.maxChangedFiles || diffSummary.lines > repairPolicy.maxChangedLines || diffSummary.files.some((path) => !isPathAllowed(path))) {
    evidence.outcome = 'blocked';
    rollback(targetDir, before);
    recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'blocked', verification: 'scope-policy', provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: 'Reject repairs outside the bounded change policy.' });
    writeMemory(memory);
    writeEvidence(evidencePath, evidence);
    process.exitCode = 2;
  } else {
    evidence.reproductionAfter = reproduce(targetDir, evidence.reproductionCommands);
    evidence.regression = runRegression(targetDir, [['npm', ['run', 'typecheck']], ['npm', ['run', 'test:static']], ['npm', ['run', 'test:build']]]);
    const rootCauseProof = {
      required: true,
      reproductionWasFailing: evidence.reproductionBefore.results.length > 0 && !evidence.reproductionBefore.ok,
      reproductionRecovered: evidence.reproductionAfter.results.length > 0 && evidence.reproductionAfter.ok,
      regressionPassed: evidence.regression.ok,
      commandsPresent: evidence.reproductionCommands.length > 0,
    };
    evidence.rootCauseProof = rootCauseProof;
    evidence.recurrenceProof = { required: true, firstPass: false, secondPass: false };
    if (rootCauseProof.commandsPresent && rootCauseProof.reproductionWasFailing && rootCauseProof.reproductionRecovered) {
      const secondReproduction = reproduce(targetDir, evidence.reproductionCommands);
      evidence.recurrenceProof.firstPass = true;
      evidence.recurrenceProof.secondPass = secondReproduction.ok;
      evidence.recurrenceProof.secondRun = secondReproduction;
    }
    const verified = rootCauseProof.reproductionWasFailing && rootCauseProof.reproductionRecovered && rootCauseProof.regressionPassed && rootCauseProof.commandsPresent && evidence.recurrenceProof.firstPass && evidence.recurrenceProof.secondPass;
    if (!verified) {
      // Canonical fail-closed terminal marker: root-cause-proof-failed.
      rollback(targetDir, before);
      evidence.outcome = 'rolled-back';
      evidence.rollback = true;
      recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'failure', verification: 'root-cause-or-recurrence-proof-failed', provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: 'A repair is not successful until the original failure is reproduced before repair, passes after repair twice, and regression passes.' });
      writeMemory(memory);
      writeEvidence(evidencePath, evidence);
      process.exitCode = 3;
    } else {
      evidence.outcome = 'verified-repair';
      recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'success', verification: 'root-cause-proof+recurrence-proof+typecheck+static+build', provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: `Prevent recurrence of ${fingerprint} by retaining verified rule ${selected.id}.` });
      writeMemory(memory);
      writeEvidence(evidencePath, evidence);
    }
  }
} catch (error) {
  rollback(targetDir, before);
  evidence.outcome = 'rolled-back';
  evidence.error = String(error?.message ?? error);
  evidence.rollback = true;
  recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'failure', verification: 'exception', provenance: { targetSha }, preventionRule: 'Do not repeat an exception-producing repair without new evidence.' });
  writeMemory(memory);
  writeEvidence(evidencePath, evidence);
  process.exitCode = 4;
}
