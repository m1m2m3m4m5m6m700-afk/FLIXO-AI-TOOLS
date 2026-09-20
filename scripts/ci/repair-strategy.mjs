import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { INTRACTABLE_THRESHOLD, fingerprintFailure } from './auto-repair-learning.mjs';
import { reasonFailure } from './auto-repair/reasoning.mjs';
import { buildCausalDiscriminator } from './action-causal-discriminator.mjs';
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

const ROOT_CAUSE_METHODS = Object.freeze({
  lint: ['source-line-isolation', 'symbol-usage-trace', 'minimal-ast-repair'],
  format: ['format-only-repro', 'generated-source-check', 'formatter-config-provenance'],
  typescript: ['diagnostic-chain', 'import-export-lineage', 'type-boundary-isolation'],
  'typescript-async-contract': ['promise-contract-trace', 'await-propagation', 'return-boundary-isolation'],
  playwright: ['browser-minimal-repro', 'lifecycle-barrier-trace', 'cross-browser-differential'],
  'webkit-render': ['frame-completion-trace', 'gpu-state-observation', 'cross-browser-differential'],
  build: ['dependency-graph-trace', 'generated-artifact-diff', 'clean-build-repro'],
  certification: ['evidence-lineage-audit', 'semantic-identity-trace', 'fresh-sha-revalidation'],
  'contract-drift': ['canonical-source-trace', 'validator-vs-runtime-diff', 'contract-owner-audit'],
  'liveness-contract': ['state-machine-trace', 'lease-transition-audit', 'stale-session-falsification'],
  'noncanonical-automation': ['dispatch-owner-trace', 'duplicate-trigger-audit', 'workflow-authority-falsification'],
  'external-tooling': ['provider-isolation', 'source-mutation-ban', 'external-recovery-revalidation'],
  unknown: ['exact-reproduction', 'broad-causal-scan', 'supervising-escalation'],
});

const STRATEGY_FAMILIES = Object.freeze({
  'reproduce-exact': new Set(['lint', 'format', 'typescript', 'typescript-async-contract', 'playwright', 'webkit-render', 'build']),
  'minimize-failure': new Set(['lint', 'format', 'typescript', 'playwright', 'build']),
  'diff-forensics': new Set(['typescript', 'build', 'contract-drift', 'certification']),
  'environment-audit': new Set(['typescript', 'build', 'playwright', 'webkit-render', 'external-tooling']),
  'workflow-forensics': new Set(['noncanonical-automation', 'liveness-contract', 'contract-drift', 'certification', 'external-tooling']),
  'observability-trace': new Set(['playwright', 'webkit-render', 'liveness-contract', 'certification']),
  'historical-analogy': new Set(['lint', 'format', 'typescript', 'build', 'playwright', 'webkit-render', 'certification', 'contract-drift']),
  'synthetic-reproduction': new Set(['lint', 'typescript', 'playwright', 'webkit-render', 'build', 'contract-drift']),
  'alternate-hypothesis': new Set(['lint', 'format', 'typescript', 'playwright', 'webkit-render', 'build', 'certification', 'contract-drift', 'liveness-contract']),
  'supervising-escalation': new Set(['unknown', 'external-tooling', 'certification', 'contract-drift', 'liveness-contract']),
});

const SECURITY_PATTERNS = Object.freeze([
  { id: 'workflow-input-taint', pattern: /github\.event\.inputs\.[A-Za-z0-9_]+[^\n]*run:|\$\{\{\s*inputs\.[A-Za-z0-9_]+\s*\}\}/iu, className: 'INPUT_TAINT', severity: 'HIGH' },
  { id: 'env-taint', pattern: /GITHUB_ENV[^\n]*\$[A-Z_][A-Z0-9_]*|echo\s+.*>>\s*\$GITHUB_ENV/iu, className: 'ENV_TAINT', severity: 'HIGH' },
  { id: 'artifact-boundary', pattern: /download-artifact|gh\s+run\s+download/iu, className: 'ARTIFACT_PROVENANCE', severity: 'HIGH' },
  { id: 'workflow-write', pattern: /permissions:[\s\S]{0,600}contents:\s*write|permissions:\s*write-all/iu, className: 'TOKEN_WRITE', severity: 'MEDIUM' },
  { id: 'targeted-comment-api', pattern: /gh\s+issue\s+comment|issues\/\d+\/comments/iu, className: 'COMMENT_TRANSPORT', severity: 'MEDIUM' },
  { id: 'pull-request-target', pattern: /pull_request_target/iu, className: 'TRUSTED_WORKFLOW_BOUNDARY', severity: 'CRITICAL' },
]);

function canonicalSecuritySurface(targetDir) {
  const roots = ['.github/workflows', 'scripts/ci'];
  const findings = [];
  for (const root of roots) {
    const absolute = targetDir.replace(/[/\\]$/u, '') + '/' + root;
    if (!fs.existsSync(absolute)) continue;
    const files = fs.readdirSync(absolute).filter((name) => /\.(?:ya?ml|mjs|js|ts)$/u.test(name)).slice(0, root === '.github/workflows' ? 80 : 120);
    for (const name of files) {
      const file = absolute + '/' + name;
      let text = '';
      try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
      for (const rule of SECURITY_PATTERNS) if (rule.pattern.test(text)) findings.push({ id: rule.id, className: rule.className, severity: rule.severity, path: root + '/' + name, status: 'SIGNAL_REQUIRES_REVIEW' });
    }
  }
  const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
  return findings.sort((a, b) => (rank[a.severity] - rank[b.severity]) || a.path.localeCompare(b.path) || a.id.localeCompare(b.id)).slice(0, 40);
}

function strategyOutcomeStats(memory, id, rootCause) {
  let successes = 0; let failures = 0; let observations = 0; let contextual = 0;
  for (const entry of memory.cases ?? []) {
    for (const outcome of entry.outcomes ?? []) {
      if (outcome?.provenance?.strategyId !== id || outcome.outcome === 'blocked-external') continue;
      if (!['success', 'failure', 'unrepaired', 'blocked', 'reverted-repair'].includes(outcome.outcome)) continue;
      observations += 1;
      if (outcome.outcome === 'success') successes += 1; else failures += 1;
      if (rootCause && entry.rootCause === rootCause) contextual += 1;
    }
  }
  return { successes, failures, observations, contextual };
}

function causalIntelligence(log, memory, stableCaseFingerprint, targetDir) {
  let reasoning = null;
  try { reasoning = reasonFailure(log, { targetDir, historical: (memory.cases ?? []).map((entry) => ({ rootCause: entry.rootCause, successes: entry.successes, attempts: entry.attempts })) }); } catch { reasoning = null; }
  let discriminator = null;
  try {
    discriminator = buildCausalDiscriminator({
      failureLog: log,
      exactCases: (memory.cases ?? []).filter((entry) => entry.fingerprint === stableCaseFingerprint),
      doNotRepeat: [...new Set((memory.cases ?? []).filter((entry) => entry.fingerprint === stableCaseFingerprint).flatMap((entry) => [...(entry.revertedRules ?? []), ...(entry.failedStrategies ?? [])]))],
      fingerprint: stableCaseFingerprint,
      targetSha: process.env.FLIXO_EXPECTED_TARGET_SHA ?? process.env.FLIXO_TARGET_SHA ?? '',
    });
  } catch { discriminator = null; }
  const rootCause = String(reasoning?.rootCause ?? discriminator?.hypotheses?.[0]?.id ?? 'unknown');
  const rootMethods = ROOT_CAUSE_METHODS[rootCause] ?? ROOT_CAUSE_METHODS.unknown;
  return Object.freeze({
    version: 'V12',
    rootCause,
    confidence: Number(reasoning?.causalConfidence ?? 0),
    ambiguity: reasoning?.ambiguity === true || discriminator?.ranking?.ambiguous === true,
    decision: reasoning?.decision ?? discriminator?.decision ?? 'PROPOSE_ONLY',
    mutationAllowed: reasoning?.sourceMutationAllowed === true && discriminator?.failClosed !== true,
    rootMethods,
    topHypotheses: (reasoning?.hypotheses ?? discriminator?.hypotheses ?? []).slice(0, 5).map((item) => ({ id: item.id, score: item.score ?? item.evidenceScore ?? null, evidenceAnchors: item.directMatches ?? item.evidenceAnchors ?? 0, suppressedBy: item.suppressedBy ?? null })),
    falsification: (reasoning?.falsificationChecks ?? []).slice(0, 8),
    evidenceProfile: reasoning?.evidenceProfile ?? null,
    discriminatorScore: discriminator?.capabilityScore ?? null,
    stableFingerprint: stableCaseFingerprint || null,
  });
}

function rankIntelligentStrategies({ memory, causal, rejected, priorStrategies, twinPreferredStrategy }) {
  const rootCause = causal.rootCause;
  const ranked = strategies.map(([id, description], order) => {
    const stats = strategyOutcomeStats(memory, id, rootCause);
    const familyMatch = STRATEGY_FAMILIES[id]?.has(rootCause) ? 1 : 0;
    const rejectionPenalty = rejected.has(id) ? 1 : 0;
    const repeatCount = priorStrategies.filter((value) => value === id).length;
    const successRate = stats.observations ? stats.successes / stats.observations : 0;
    const empiricalSignal = Math.min(1, stats.observations / 6);
    const contextualSignal = stats.observations ? Math.min(1, stats.contextual / stats.observations) : 0;
    const twinSignal = twinPreferredStrategy === id ? 1 : 0;
    const evidenceSignal = causal.rootCause !== 'unknown' ? familyMatch : id === 'supervising-escalation' ? 1 : 0;
    const score = Number((evidenceSignal * 0.32 + contextualSignal * 0.18 + successRate * 0.18 + empiricalSignal * 0.10 + twinSignal * 0.12 - Math.min(0.24, repeatCount * 0.06) - rejectionPenalty * 0.70).toFixed(5));
    return { id, description, order, score, rootCause, familyMatch: Boolean(familyMatch), twinPreferred: twinSignal === 1, observations: stats.observations, successes: stats.successes, failures: stats.failures, successRate: Number(successRate.toFixed(4)), contextualRate: Number(contextualSignal.toFixed(4)), repeatCount, rejected: rejectionPenalty === 1 };
  }).filter((item) => !item.rejected).sort((a, b) => b.score - a.score || a.repeatCount - b.repeatCount || a.order - b.order);
  const portfolio = ranked.slice(0, 4);
  return { ranked: ranked.slice(0, 8), portfolio, selected: portfolio[0] ?? null, runnerUp: portfolio[1] ?? null, separation: portfolio[1] ? Number((portfolio[0].score - portfolio[1].score).toFixed(5)) : 1, exploration: portfolio.slice(1).map((item, index) => ({ phase: index + 1, strategyId: item.id, purpose: index === 0 ? 'STRONGEST_ALTERNATIVE' : index === 1 ? 'INDEPENDENT_DIAGNOSTIC' : 'RECOVERY_ESCALATION' })) };
}

function buildFalsificationPlan(causal, strategyRanking) {
  const top = causal.topHypotheses?.[0] ?? null;
  const runner = causal.topHypotheses?.find((item) => item.id !== top?.id && !item.suppressedBy) ?? null;
  const checks = [
    { id: 'HYPOTHESIS_SEPARATION', action: 'Disprove the strongest competing hypothesis before mutation.', target: runner?.id ?? 'UNKNOWN' },
    { id: 'MECHANISM_PROOF', action: 'Show trigger → propagation → causal source → symptom.', target: top?.id ?? causal.rootCause },
    { id: 'SOURCE_OWNERSHIP', action: 'Verify the proposed file is the canonical causal owner and not a downstream symptom.', target: 'canonical-source' },
    { id: 'REGRESSION_CAUSALITY', action: 'Run the smallest failing regression before and twice after repair.', target: causal.rootMethods?.[0] ?? 'exact-reproduction' },
    { id: 'SECURITY_BOUNDARY', action: 'Audit input, artifact, permission, environment and token boundaries touched by the repair.', target: 'security-surface' },
    { id: 'RECURRENCE_GUARD', action: 'Reject the strategy when its previous failure lacks materially new evidence.', target: strategyRanking.selected?.id ?? 'none' },
  ];
  return checks;
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
const twinSelection = process.env.FLIXO_SELECTION_PATH ? readJson(process.env.FLIXO_SELECTION_PATH, null) : null;
const selectedRepairStrategy = String(twinSelection?.selection?.selectedStrategy ?? '').trim();
const twinPreferredStrategy = selectedRepairStrategy
  || String(twinProposal?.challenge?.preferredAlternativeStrategy ?? twinA?.challenge?.preferredAlternativeStrategy ?? twinB?.challenge?.preferredAlternativeStrategy ?? '').trim();
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
const rejected = new Set([
  ...(entry?.revertedRules ?? []),
  ...(rejectionReasons(attemptLedger, { chainId, caseFingerprint: stableCaseFingerprint }).map((item) => item?.strategyId)),
].filter(Boolean).map(String));
const causal = causalIntelligence(log, memory, stableCaseFingerprint, process.cwd());
const securityFindings = canonicalSecuritySurface(process.cwd());
const intelligentRanking = rankIntelligentStrategies({ memory, causal, rejected, priorStrategies, twinPreferredStrategy });
const unusedIndexes = strategies.map((_, i) => i).filter((i) => !priorStrategies.includes(strategies[i][0])).filter((i) => !rejected.has(strategies[i][0]));
const ledgerAvailableIndexes = unusedIndexes.filter((i) => !isRepairRejected(attemptLedger, { chainId, caseFingerprint: stableCaseFingerprint, strategyId: strategies[i][0] }));
const divergentIndexes = ledgerAvailableIndexes.filter((i) => strategies[i][0] !== twinPreferredStrategy);
const allStrategiesExhausted = ledgerAvailableIndexes.length === 0;
const rotationIndexes = strategies.map((_, i) => i).filter((i) => !twinPreferredStrategy || strategies[i][0] !== twinPreferredStrategy);
const availableIndexes = allStrategiesExhausted ? (rotationIndexes.length ? rotationIndexes : strategies.map((_, i) => i)) : ledgerAvailableIndexes;
const selectedIndex = selectedRepairStrategy ? strategies.findIndex(([id]) => id === selectedRepairStrategy) : -1;
const intelligentSelectedId = intelligentRanking.selected?.id ?? null;
const intelligentIndex = intelligentSelectedId ? strategies.findIndex(([id]) => id === intelligentSelectedId) : -1;
const index = selectedIndex >= 0 && availableIndexes.includes(selectedIndex)
  ? selectedIndex
  : intelligentIndex >= 0 && availableIndexes.includes(intelligentIndex)
    ? intelligentIndex
    : (divergentIndexes[0] ?? availableIndexes[(Math.max(0, nextAttempt - 1)) % availableIndexes.length]);
const [strategyId, strategy] = strategies[index];
const threshold = INTRACTABLE_THRESHOLD;
const teachingEscalation = record?.status === 'INTRACTABLE' || nextAttempt > threshold || allStrategiesExhausted;
const sameStrategyRepeated = priorStrategies.filter((value) => value === strategyId).length > 0;
if (allStrategiesExhausted) {
  console.log(JSON.stringify({
    strategyRotation: 'FULL_ROTATION_AFTER_EXHAUSTION',
    attempt: nextAttempt,
    priorStrategies: [...new Set(priorStrategies)].slice(-20),
    selectedStrategy: strategyId,
    evidenceRequired: true,
  }));
}
const teachingPacket = {
  state: teachingEscalation ? 'SUPERVISING_TEACHING_REQUIRED' : 'LEARNING_CONTEXT_REQUIRED',
  attempt: nextAttempt,
  priorStrategies: [...new Set(priorStrategies)].slice(-20),
  doNotRepeat: [...new Set([...(entry?.revertedRules ?? []), ...(entry?.rules ?? [])])].slice(-20),
  requiredHypothesisChange: teachingEscalation,
  requiredEvidenceDelta: teachingEscalation ? ['new-root-cause-evidence', 'new-reproduction-or-disproof', 'new-verification-proof'] : ['exact-failure-evidence'],
  exitCriteria: 'verified-repair-on-exact-target-sha-and-canonical-green',
  intelligence: {
    version: 'V12',
    causal,
    strategyPortfolio: intelligentRanking.portfolio,
    falsificationPlan: buildFalsificationPlan(causal, intelligentRanking),
    securitySignals: securityFindings,
    selectedBy: selectedRepairStrategy ? 'TWIN_OR_EXTERNAL_SELECTION' : intelligentSelectedId ? 'V12_CAUSAL_PORTFOLIO' : 'DETERMINISTIC_ROTATION',
    noBlindRepeat: true,
  },
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
  intelligence: {
    version: 'V12',
    causal,
    rankedStrategies: intelligentRanking.ranked,
    portfolio: intelligentRanking.portfolio,
    falsificationPlan: buildFalsificationPlan(causal, intelligentRanking),
    securitySignals: securityFindings,
    selectedBy: selectedRepairStrategy ? 'TWIN_OR_EXTERNAL_SELECTION' : intelligentSelectedId ? 'V12_CAUSAL_PORTFOLIO' : 'DETERMINISTIC_ROTATION',
    exactShaRequired: true,
    mutationAuthority: 'REPAIR_ENGINE_ONLY',
    greenAuthority: 'CANONICAL_CI_ONLY',
  },
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
  protocol: 'SUPERVISING-REPAIR-TEACHING-v3-V12-CAUSAL',
}, null, 2)}\n`);
fs.writeFileSync('/tmp/flixo-intractable-state', 'false\n');
console.log(JSON.stringify({ fingerprint, attempt: nextAttempt, priorRepairArtifacts: persistedAttempts, strategyId, teachingEscalation, sameStrategyRepeated, teachingPacket, intractable: false, policy: 'EVERY_ACTIONABLE_RED_REQUIRES_NEW_EVIDENCE_OR_STRATEGY' }));
