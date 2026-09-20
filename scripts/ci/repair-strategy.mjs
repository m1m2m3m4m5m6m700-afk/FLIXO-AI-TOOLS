import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { INTRACTABLE_THRESHOLD, fingerprintFailure } from './auto-repair-learning.mjs';
import { loadAttemptLedger, isRepairRejected, rejectionReasons } from './repair-attempt-ledger.mjs';

const memoryPath = process.env.FLIXO_REPAIR_MEMORY ?? 'diagnostics/auto-repair/memory.json';
const intractablePath = process.env.FLIXO_INTRACTABLE_ERRORS ?? 'diagnostics/auto-repair/intractable-errors.json';
const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
const chainId = String(process.env.FLIXO_REPAIR_CHAIN_ID ?? process.env.TARGET_RUN_ID ?? '').trim();
const caseFingerprint = String(process.env.FLIXO_FAILURE_FINGERPRINT ?? '').trim();
const attemptLedgerPath = process.env.FLIXO_REPAIR_ATTEMPT_LEDGER ?? '/tmp/flixo-repair-attempt-ledger.json';

const strategies = [
  ['reproduce-exact', 'Reproduce the exact failure on the exact target SHA before changing source.'],
  ['minimize-failure', 'Reduce the failure to the smallest reproducible command, file, or test surface.'],
  ['diff-forensics', 'Inspect the target diff and recent history for the first causal change.'],
  ['environment-audit', 'Audit Node, package-lock, browser, OS, cache, and dependency/environment differences.'],
  ['workflow-forensics', 'Inspect workflow ordering, permissions, concurrency, artifacts, and CI-only assumptions.'],
  ['observability-trace', 'Add bounded diagnostic evidence or tracing without changing the acceptance criteria.'],
  ['historical-analogy', 'Compare prior successful and rejected cases, lessons, anti-lessons, and playbooks.'],
  ['synthetic-reproduction', 'Build a minimal synthetic reproduction or focused regression test for the suspected root cause.'],
  ['alternate-hypothesis', 'Reject the leading hypothesis and test a materially different evidence-backed repair hypothesis.'],
  ['supervising-escalation', 'Prepare a complete teaching packet for the supervising agent; do not repeat prior repairs.'],
];

function readJson(path, fallback) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return fallback; }
}

function priorRepairArtifactCount() {
  const token = process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const targetRunId = process.env.TARGET_RUN_ID;
  if (!token || !repo || !targetRunId) return 0;
  const result = spawnSync('gh', ['api', `repos/${repo}/actions/artifacts`, '--paginate', '--slurp', '--jq', '.[].artifacts[].name'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) return 0;
  const prefix = `flixo-auto-repair-${targetRunId}-`;
  return result.stdout.split('\n').filter((name) => name.startsWith(prefix)).length;
}

const twinProposalPath = process.env.FLIXO_TWIN_PROPOSAL_PATH ?? '';
const twinProposal = twinProposalPath ? readJson(twinProposalPath, null) : null;
const twinA = process.env.FLIXO_TWIN_A_PATH ? readJson(process.env.FLIXO_TWIN_A_PATH, null) : null;
const twinB = process.env.FLIXO_TWIN_B_PATH ? readJson(process.env.FLIXO_TWIN_B_PATH, null) : null;
const selectedRepairStrategy = String(twinSelection?.selection?.selectedStrategy ?? '').trim();
const twinPreferredStrategy = selectedRepairStrategy
  || String(twinProposal?.challenge?.preferredAlternativeStrategy ?? twinA?.challenge?.preferredAlternativeStrategy ?? twinB?.challenge?.preferredAlternativeStrategy ?? '').trim();
const twinSelection = process.env.FLIXO_SELECTION_PATH ? readJson(process.env.FLIXO_SELECTION_PATH, null) : null;
const memory = readJson(memoryPath, { cases: [] });
const intractable = readJson(intractablePath, { cases: [] });
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const fingerprint = fingerprintFailure(log);
const attemptLedger = loadAttemptLedger(attemptLedgerPath, { chainId });
const stableCaseFingerprint = caseFingerprint || attemptLedger.caseFingerprint || fingerprint;
attemptLedger.caseFingerprint = stableCaseFingerprint;
const entry = (memory.cases ?? []).find((item) => item.fingerprint === fingerprint);
const record = (intractable.cases ?? []).find((item) => item.fingerprint === fingerprint);
const attempts = Number(entry?.attempts ?? 0);
const persistedAttempts = priorRepairArtifactCount();
const nextAttempt = Math.max(attempts + 1, persistedAttempts + 1);
const priorStrategies = [
  ...(entry?.outcomes ?? []).map((item) => item?.provenance?.strategyId).filter(Boolean),
  ...(entry?.rejectedStrategies ?? []),
  ...(entry?.strategies ?? []),
].map(String);
const unusedIndexes = strategies.map((_, i) => i).filter((i) => !priorStrategies.includes(strategies[i][0]));
const ledgerAvailableIndexes = unusedIndexes.filter((i) => !isRepairRejected(attemptLedger, { chainId, caseFingerprint: stableCaseFingerprint, strategyId: strategies[i][0] }));
const divergentIndexes = ledgerAvailableIndexes.filter((i) => strategies[i][0] !== twinPreferredStrategy);
if (!ledgerAvailableIndexes.length) {
  const rejected = strategies.map((item) => item[0]).filter((id) => isRepairRejected(attemptLedger, { chainId, caseFingerprint: stableCaseFingerprint, strategyId: id }));
  const reasons = rejectionReasons(attemptLedger, { chainId, caseFingerprint: stableCaseFingerprint }).slice(-20);
  throw new Error('REPAIR_NO_UNUSED_STRATEGY_FOR_ACTIVE_CASE rejected=' + rejected.join(',') + ' reasons=' + JSON.stringify(reasons));
}
const selectedIndex = selectedRepairStrategy
  ? strategies.findIndex(([id]) => id === selectedRepairStrategy)
  : -1;
const index = selectedIndex >= 0 && ledgerAvailableIndexes.includes(selectedIndex)
  ? selectedIndex
  : (divergentIndexes[0] ?? ledgerAvailableIndexes[0]);
const [strategyId, strategy] = strategies[index];
const threshold = INTRACTABLE_THRESHOLD;
const teachingEscalation = record?.status === 'INTRACTABLE' || nextAttempt > threshold;
const sameStrategyRepeated = priorStrategies.filter((value) => value === strategyId).length > 0;
const teachingPacket = {
  state: teachingEscalation ? 'SUPERVISING_TEACHING_REQUIRED' : 'LEARNING_CONTEXT_REQUIRED',
  attempt: nextAttempt,
  priorStrategies: [...new Set(priorStrategies)].slice(-20),
  doNotRepeat: [...new Set([...(entry?.revertedRules ?? []), ...(entry?.rules ?? [])])].slice(-20),
  requiredHypothesisChange: teachingEscalation,
  requiredEvidenceDelta: teachingEscalation ? ['new-root-cause-evidence', 'new-reproduction-or-disproof', 'new-verification-proof'] : ['exact-failure-evidence'],
  exitCriteria: 'verified-repair-on-exact-target-sha-and-canonical-green',
};

fs.writeFileSync('/tmp/flixo-repair-strategy.json', `${JSON.stringify({
  fingerprint,
  stableCaseFingerprint,
  chainId: chainId || null,
  attempt: nextAttempt,
  priorRepairArtifacts: persistedAttempts,
  rejectedByDurableLedger: rejectionReasons(attemptLedger, { chainId, caseFingerprint: stableCaseFingerprint }).slice(-20),
  strategyId,
  strategy,
  intractable: false,
  teachingEscalation,
  sameStrategyRepeated,
  teachingPacket,
  cycle: nextAttempt,
  twin: {
    present: Boolean(twinProposal || twinA || twinB || twinSelection),
    preferredStrategy: twinPreferredStrategy || null,
    executorStrategy: strategyId,
    divergent: Boolean(twinPreferredStrategy) && strategyId !== twinPreferredStrategy,
    disposition: twinSelection?.selection?.disposition ?? twinProposal?.challenge?.disposition ?? (twinA || twinB ? 'TWO_TWINS' : 'NO_TWIN'),
    selector: {
      selected: twinSelection?.selection?.selected ?? null,
      selectedStrategy: twinSelection?.selection?.selectedStrategy ?? null,
      ranked: twinSelection?.selection?.ranked ?? []
    }
  },
  protocol: teachingEscalation ? 'SUPERVISING-REPAIR-TEACHING-v2-CONTINUE-REPAIR' : 'SUPERVISING-REPAIR-TEACHING-v2',
}, null, 2)}\n`);
fs.writeFileSync('/tmp/flixo-intractable-state', 'false\n');
console.log(JSON.stringify({ fingerprint, attempt: nextAttempt, priorRepairArtifacts: persistedAttempts, strategyId, teachingEscalation, sameStrategyRepeated, teachingPacket, intractable: false, policy: 'EVERY_ACTIONABLE_RED_REQUIRES_NEW_EVIDENCE_OR_STRATEGY' }));
