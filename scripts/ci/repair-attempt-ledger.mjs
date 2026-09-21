import fs from 'node:fs';
import crypto from 'node:crypto';

export const ATTEMPT_LEDGER_VERSION = 1;
const MAX_ATTEMPTS = 1000;
const SHA_RE = /^[a-f0-9]{40}$/u;

export function emptyAttemptLedger({ chainId = null, caseFingerprint = null } = {}) {
  return {
    version: ATTEMPT_LEDGER_VERSION,
    protocol: 'FLIXO-REPAIR-NO-REPEAT-v1',
    chainId: chainId ? String(chainId) : null,
    caseFingerprint: caseFingerprint ? String(caseFingerprint) : null,
    attempts: [],
    rejected: [],
  };
}

export function normalizeAttemptLedger(source = {}, defaults = {}) {
  const base = emptyAttemptLedger(defaults);
  const ledger = { ...base, ...source };
  ledger.version = ATTEMPT_LEDGER_VERSION;
  ledger.protocol = 'FLIXO-REPAIR-NO-REPEAT-v1';
  ledger.chainId = ledger.chainId ? String(ledger.chainId) : (defaults.chainId ? String(defaults.chainId) : null);
  ledger.caseFingerprint = ledger.caseFingerprint ? String(ledger.caseFingerprint) : (defaults.caseFingerprint ? String(defaults.caseFingerprint) : null);
  ledger.attempts = Array.isArray(ledger.attempts) ? ledger.attempts.slice(-MAX_ATTEMPTS) : [];
  ledger.rejected = Array.isArray(ledger.rejected) ? ledger.rejected.slice(-MAX_ATTEMPTS) : [];
  return ledger;
}

export function loadAttemptLedger(path, defaults = {}) {
  try {
    return normalizeAttemptLedger(JSON.parse(fs.readFileSync(path, 'utf8')), defaults);
  } catch {
    return emptyAttemptLedger(defaults);
  }
}

export function saveAttemptLedger(path, ledger) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  const normalized = normalizeAttemptLedger(ledger, { chainId: ledger?.chainId, caseFingerprint: ledger?.caseFingerprint });
  fs.writeFileSync(path, JSON.stringify(normalized, null, 2) + '\n');
  return normalized;
}

export function repairScopeKey({ chainId, caseFingerprint } = {}) {
  return String(chainId ?? '') + '|' + String(caseFingerprint ?? '');
}

export function repairAttemptKey({ chainId, caseFingerprint, strategyId = null, ruleId = null } = {}) {
  return crypto.createHash('sha256').update(JSON.stringify({
    scope: repairScopeKey({ chainId, caseFingerprint }),
    strategyId: strategyId ? String(strategyId) : null,
    ruleId: ruleId ? String(ruleId) : null,
  })).digest('hex');
}

function scopeMatches(item, scope) {
  return String(item?.chainId ?? '') === String(scope.chainId ?? '')
    && String(item?.caseFingerprint ?? '') === String(scope.caseFingerprint ?? '');
}

export function isRepairRejected(ledger, { chainId, caseFingerprint, strategyId = null, ruleId = null } = {}) {
  const scope = { chainId, caseFingerprint };
  return (ledger?.rejected ?? []).some((item) => {
    if (!scopeMatches(item, scope)) return false;
    const sameStrategy = Boolean(strategyId) && String(item.strategyId ?? '') === String(strategyId);
    const sameRule = Boolean(ruleId) && String(item.ruleId ?? '') === String(ruleId);
    return sameStrategy || sameRule;
  });
}

export function rejectionReasons(ledger, { chainId, caseFingerprint, strategyId = null, ruleId = null } = {}) {
  const scope = { chainId, caseFingerprint };
  return (ledger?.rejected ?? [])
    .filter((item) => scopeMatches(item, scope))
    .filter((item) => (strategyId && String(item.strategyId ?? '') === String(strategyId)) || (ruleId && String(item.ruleId ?? '') === String(ruleId)))
    .map((item) => ({
      strategyId: item.strategyId ?? null,
      ruleId: item.ruleId ?? null,
      outcome: item.outcome ?? null,
      reason: item.reason ?? null,
      failedSha: item.failedSha ?? null,
      runId: item.runId ?? null,
      at: item.at ?? null,
    }));
}

export function recordRejectedAttempt(ledger, {
  chainId,
  caseFingerprint,
  runId = null,
  failedSha = null,
  strategyId = null,
  ruleId = null,
  outcome = 'failure',
  reason = 'repair-attempt-failed',
  changedPaths = [],
} = {}) {
  if (!chainId || !caseFingerprint) throw new Error('REPAIR_ATTEMPT_LEDGER_IDENTITY_REQUIRED');
  if (failedSha && !SHA_RE.test(String(failedSha))) throw new Error('REPAIR_ATTEMPT_LEDGER_FAILED_SHA_INVALID');
  const normalized = normalizeAttemptLedger(ledger, { chainId, caseFingerprint });
  const attempt = {
    chainId: String(chainId),
    caseFingerprint: String(caseFingerprint),
    runId: runId == null ? null : String(runId),
    failedSha: failedSha == null ? null : String(failedSha),
    strategyId: strategyId == null || strategyId === '' ? null : String(strategyId),
    ruleId: ruleId == null || ruleId === '' ? null : String(ruleId),
    outcome: String(outcome),
    reason: String(reason),
    changedPaths: [...new Set((Array.isArray(changedPaths) ? changedPaths : []).map(String).filter(Boolean))].slice(0, 32),
    key: repairAttemptKey({ chainId, caseFingerprint, strategyId, ruleId }),
    at: new Date().toISOString(),
  };
  normalized.attempts.push(attempt);
  const exact = normalized.rejected.find((item) => item.key === attempt.key && item.chainId === attempt.chainId && item.caseFingerprint === attempt.caseFingerprint);
  if (exact) {
    exact.seen = Number(exact.seen ?? 1) + 1;
    exact.lastRunId = attempt.runId;
    exact.lastAt = attempt.at;
    exact.reason = attempt.reason;
  } else {
    normalized.rejected.push({
      ...attempt,
      seen: 1,
      lastRunId: attempt.runId,
      lastAt: attempt.at,
    });
  }
  normalized.attempts = normalized.attempts.slice(-MAX_ATTEMPTS);
  normalized.rejected = normalized.rejected.slice(-MAX_ATTEMPTS);
  return normalized;
}

function env(name, fallback = '') {
  return process.env[name] ?? fallback;
}

if (process.argv[1]?.endsWith('repair-attempt-ledger.mjs')) {
  const command = process.argv[2] ?? 'contract';
  const path = env('FLIXO_REPAIR_ATTEMPT_LEDGER', '/tmp/flixo-repair-attempt-ledger.json');
  const chainId = env('FLIXO_REPAIR_CHAIN_ID');
  const caseFingerprint = env('FLIXO_FAILURE_FINGERPRINT') || env('FLIXO_LEDGER_CASE_FINGERPRINT');

  if (command === 'init') {
    saveAttemptLedger(path, emptyAttemptLedger({ chainId, caseFingerprint }));
    console.log(JSON.stringify({ status: 'PASS', chainId: chainId || null, caseFingerprint: caseFingerprint || null, rejected: 0 }));
  } else if (command === 'record') {
    const evidencePath = env('FLIXO_REPAIR_EVIDENCE_PATH', '/tmp/flixo-repair-evidence.json');
    let evidence = {};
    try { evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8')); } catch { /* missing evidence is represented by the empty record */ }
    let strategyPlan = {};
    try { strategyPlan = JSON.parse(fs.readFileSync('/tmp/flixo-repair-strategy.json', 'utf8')); } catch { /* absent strategy plan is allowed during pre-repair recording */ }
    const strategy = env('FLIXO_REPAIR_STRATEGY_ID') || strategyPlan?.strategyId || evidence?.selected || null;
    const rule = evidence?.selected || evidence?.historicalRollback?.rule || env('FLIXO_REPAIR_RULE') || null;
    const outcome = env('FLIXO_LEDGER_OUTCOME', evidence?.outcome || 'failure');
    const ledger = loadAttemptLedger(path, { chainId, caseFingerprint });
    const updated = recordRejectedAttempt(ledger, {
      chainId,
      caseFingerprint,
      runId: env('GITHUB_RUN_ID') || env('TARGET_RUN_ID') || null,
      failedSha: env('FLIXO_FAILED_SHA') || evidence?.targetSha || null,
      strategyId: strategy,
      ruleId: rule,
      outcome,
      reason: env('FLIXO_LEDGER_REASON', evidence?.escalation?.reason || 'repair-attempt-failed'),
      changedPaths: evidence?.changedPaths || [],
    });
    saveAttemptLedger(path, updated);
    console.log(JSON.stringify({
      status: 'PASS',
      chainId,
      caseFingerprint,
      strategyId: strategy,
      ruleId: rule,
      outcome,
      rejectedCount: updated.rejected.length,
    }));
  } else if (command === 'check') {
    const strategyId = env('FLIXO_REPAIR_STRATEGY_ID');
    const ruleId = env('FLIXO_REPAIR_RULE');
    const ledger = loadAttemptLedger(path, { chainId, caseFingerprint });
    const rejected = isRepairRejected(ledger, { chainId, caseFingerprint, strategyId, ruleId });
    console.log(JSON.stringify({ rejected, reasons: rejectionReasons(ledger, { chainId, caseFingerprint, strategyId, ruleId }) }));
    if (rejected) process.exit(2);
  } else {
    console.log(JSON.stringify({ version: ATTEMPT_LEDGER_VERSION, protocol: 'FLIXO-REPAIR-NO-REPEAT-v1', commands: ['init', 'record', 'check'] }));
  }
}
