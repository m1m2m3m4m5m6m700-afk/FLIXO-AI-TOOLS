import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { repairPolicy, isPathAllowed } from './auto-repair-policy.mjs';
import { fingerprintFailure, normalizeFailure, extractFeatures, loadMemory, findCase, findSimilarCases, scorePlaybook, writeMemory, recordOutcome } from './auto-repair-learning.mjs';
import { createProtocolState, transitionProtocol, classifyRisk, validateEvidence } from './auto-repair-protocol.mjs';
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
const detectedFeatures = extractFeatures(log);
const similar = findSimilarCases(memory, { fingerprint, normalized: normalizedFailure, features: detectedFeatures });
const features = [...new Set([...detectedFeatures, ...(known?.features ?? []), ...similar.flatMap(({ case: item }) => item.features ?? [])])];
const targetSha = git(['rev-parse', 'HEAD']).trim();
const protocol = createProtocolState({ fingerprint, targetSha, maxAttempts: repairPolicy.maxAttemptsPerFingerprint });
const advance = (next, evidence = {}) => transitionProtocol(protocol, next, evidence);

advance('EVIDENCE_LOCK', { complete: Boolean(fingerprint && targetSha) });
advance('RCA');

if ((known?.attempts ?? 0) >= repairPolicy.maxAttemptsPerFingerprint) {
  advance('ESCALATE');
  console.log('AUTO_REPAIR_RESULT=LEARNING_MEMORY_BLOCK');
  process.exit(0);
}
if (repairPolicy.requireCleanGitBeforeRepair && git(['status', '--porcelain']).trim()) throw new Error('AUTO_REPAIR_DIRTY_WORKTREE');

const plan = planRepair(log, memory);
const specialist = selectSpecialist(features);
advance('RISK_GATE');
let selected = plan.selected;
const historicalRules = [...(known?.rules ?? []), ...similar.flatMap(({ case: item }) => item.rules ?? [])];
const historicalCandidate = plan.candidates.find((candidate) => historicalRules.includes(candidate.id) && candidate.mutate && candidate.adaptiveConfidence >= 90);
if (historicalCandidate && (!selected || scorePlaybook(memory, specialist?.id ?? 'unknown', historicalCandidate.id) >= scorePlaybook(memory, specialist?.id ?? 'unknown', selected.id))) selected = historicalCandidate;
const selectedRisk = classifyRisk({ confidence: selected?.adaptiveConfidence ?? selected?.confidence ?? 0 });
const attempt = (known?.attempts ?? 0) + 1;
const evidence = {
  schemaVersion: 5,
  protocolVersion: 1,
  protocol: protocol.transitions,
  fingerprint,
  targetSha,
  features,
  specialist,
  attempt,
  attemptBudget: repairPolicy.maxAttemptsPerFingerprint,
  candidates: plan.candidates,
  selected: selected?.id ?? null,
  risk: selectedRisk,
  historical: { exact: Boolean(known), similar: similar.map(({ case: item, score }) => ({ fingerprint: item.fingerprint, score, rules: item.rules ?? [] })) },
  provenance: { failedSha: targetSha, changedPaths: [], rule: selected?.id ?? null },
  outcome: 'diagnostic-only',
  changedPaths: [],
  updatedAt: new Date().toISOString(),
};

if (!selected || selectedRisk === 'HUMAN-GATE') {
  advance('ESCALATE');
  evidence.protocol = protocol.transitions;
  evidence.outcome = 'proposal-only';
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected?.id, outcome: 'proposed', verification: 'none', risk: selectedRisk, preventionRule: 'No autonomous repair is permitted for this risk class; escalate with evidence.' });
  writeMemory(memory);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=${selected?.id ?? 'none'}\nAUTO_REPAIR_FINGERPRINT=${fingerprint}`);
  process.exit(0);
}

advance('PLAN');
const gate = confidenceGate({ selected, features, maxFiles: repairPolicy.maxChangedFiles, maxLines: repairPolicy.maxChangedLines });
evidence.confidenceGate = gate;
if (!gate.allowed) {
  advance('ESCALATE');
  evidence.protocol = protocol.transitions;
  evidence.outcome = 'proposal-only';
  writeEvidence(evidencePath, evidence);
  recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'proposed', verification: 'confidence-gate-blocked', risk: selectedRisk, preventionRule: 'Require guarded or human-gated repair for this class.' });
  writeMemory(memory);
  console.log(`AUTO_REPAIR_RESULT=PROPOSAL_ONLY\nAUTO_REPAIR_PLAN=${selected.id}`);
  process.exit(0);
}

const before = snapshot(targetDir);
advance('REPRODUCE');
evidence.reproductionBefore = reproduce(targetDir, impactedTests(features));

try {
  advance('REPAIR');
  evidence.repair = runAstRepair(targetDir, selected);
  const changed = git(['diff', '--binary']);
  const diffSummary = summarizeDiff(changed);
  evidence.diff = diffSummary;
  evidence.changedPaths = diffSummary.files;
  evidence.provenance.changedPaths = diffSummary.files;
  advance('SCOPE_VERIFY');
  if (!diffSummary.files.length || diffSummary.files.length > repairPolicy.maxChangedFiles || diffSummary.lines > repairPolicy.maxChangedLines || diffSummary.files.some((path) => !isPathAllowed(path))) {
    evidence.outcome = 'blocked';
    rollback(targetDir, before);
    advance('ESCALATE');
    evidence.protocol = protocol.transitions;
    recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'blocked', verification: 'scope-policy', risk: selectedRisk, provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: 'Reject repairs outside the bounded change policy.' });
    writeMemory(memory);
    writeEvidence(evidencePath, evidence);
    process.exitCode = 2;
  } else {
    advance('REGRESSION_VERIFY');
    evidence.reproductionAfter = reproduce(targetDir, impactedTests(features));
    const regressionCommands = [['npm', ['run', 'typecheck']], ['npm', ['run', 'test:static']], ['npm', ['run', 'test:build']]];
    const originalGate = process.env.FLIXO_ORIGINAL_GATE;
    if (originalGate === 'browser' || features.includes('playwright') || features.includes('webkit')) regressionCommands.push(['npm', ['run', 'test:browser']]);
    if (originalGate === 'certification' || features.includes('certification')) regressionCommands.push(['npm', ['run', 'verify:ci-cd-trust']]);
    evidence.regression = runRegression(targetDir, regressionCommands);
    evidence.originalGate = originalGate ?? (features.includes('playwright') || features.includes('webkit') ? 'browser' : features.includes('certification') ? 'certification' : 'static+build');
    advance('ORIGINAL_GATE_VERIFY');
    if (!evidence.reproductionAfter.ok || !evidence.regression.ok) {
      rollback(targetDir, before);
      evidence.outcome = 'rolled-back';
      evidence.rollback = true;
      advance('ESCALATE');
      evidence.protocol = protocol.transitions;
      recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'failure', verification: 'reproduction/regression-failed', risk: selectedRisk, provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: 'Do not reuse this rule until a later verified success supersedes the failed attempt.' });
      writeMemory(memory);
      writeEvidence(evidencePath, evidence);
      process.exitCode = 3;
    } else {
      evidence.outcome = 'verified-repair';
      evidence.verification = { reproduction: true, regression: true, originalGate: evidence.originalGate };
      advance('LEARN');
      recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'success', verification: `typecheck+static+build+${evidence.originalGate}`, risk: selectedRisk, provenance: { targetSha, changedPaths: diffSummary.files }, preventionRule: `Prevent recurrence of ${fingerprint} by retaining verified rule ${selected.id}.` });
      writeMemory(memory);
      advance('PREVENT');
      const evidenceCheck = validateEvidence(evidence);
      if (!evidenceCheck.ok) throw new Error(`PROTOCOL_EVIDENCE_INVALID:${evidenceCheck.missing.join(',')}`);
      advance('CLOSE', { proven: true });
      evidence.protocol = protocol.transitions;
      writeEvidence(evidencePath, evidence);
    }
  }
} catch (error) {
  rollback(targetDir, before);
  evidence.outcome = 'rolled-back';
  evidence.error = String(error?.message ?? error);
  evidence.rollback = true;
  if (protocol.state !== 'ESCALATE' && protocol.state !== 'CLOSE') advance('ESCALATE');
  evidence.protocol = protocol.transitions;
  recordOutcome(memory, { fingerprint, normalizedFailure, features, rootCause: specialist?.id ?? 'unknown', rule: selected.id, outcome: 'failure', verification: 'exception', risk: selectedRisk, provenance: { targetSha }, preventionRule: 'Do not repeat an exception-producing repair without new evidence.' });
  writeMemory(memory);
  writeEvidence(evidencePath, evidence);
}
