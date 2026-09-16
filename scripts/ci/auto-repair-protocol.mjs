const STATES = Object.freeze([
  'DISCOVERY',
  'EVIDENCE_LOCK',
  'RCA',
  'RISK_GATE',
  'PLAN',
  'REPRODUCE',
  'REPAIR',
  'SCOPE_VERIFY',
  'REGRESSION_VERIFY',
  'ORIGINAL_GATE_VERIFY',
  'LEARN',
  'PREVENT',
  'CLOSE',
  'ESCALATE',
]);

const TRANSITIONS = Object.freeze({
  DISCOVERY: ['EVIDENCE_LOCK', 'ESCALATE'],
  EVIDENCE_LOCK: ['RCA', 'ESCALATE'],
  RCA: ['RISK_GATE', 'ESCALATE'],
  RISK_GATE: ['PLAN', 'ESCALATE'],
  PLAN: ['REPRODUCE', 'ESCALATE'],
  REPRODUCE: ['REPAIR', 'ESCALATE'],
  REPAIR: ['SCOPE_VERIFY', 'ESCALATE'],
  SCOPE_VERIFY: ['REGRESSION_VERIFY', 'ESCALATE'],
  REGRESSION_VERIFY: ['ORIGINAL_GATE_VERIFY', 'ESCALATE'],
  ORIGINAL_GATE_VERIFY: ['LEARN', 'ESCALATE'],
  LEARN: ['PREVENT', 'ESCALATE'],
  PREVENT: ['CLOSE', 'ESCALATE'],
  CLOSE: [],
  ESCALATE: [],
});

export const PROTOCOL_VERSION = 1;
export const PROTOCOL_STATES = STATES;

export function createProtocolState({ fingerprint, targetSha, maxAttempts = 2 } = {}) {
  if (!fingerprint || !targetSha) throw new Error('PROTOCOL_MISSING_IDENTITY');
  return {
    version: PROTOCOL_VERSION,
    state: 'DISCOVERY',
    fingerprint,
    targetSha,
    maxAttempts,
    attempt: 0,
    evidenceLocked: false,
    transitions: [{ from: null, to: 'DISCOVERY', at: new Date().toISOString() }],
  };
}

export function transitionProtocol(state, next, evidence = {}) {
  if (!state || !STATES.includes(next)) throw new Error('PROTOCOL_INVALID_STATE');
  if (!TRANSITIONS[state.state]?.includes(next)) {
    throw new Error(`PROTOCOL_ILLEGAL_TRANSITION:${state.state}->${next}`);
  }
  if (next === 'EVIDENCE_LOCK' && !evidence.complete) throw new Error('PROTOCOL_EVIDENCE_INCOMPLETE');
  if (next === 'REPAIR' && state.attempt >= state.maxAttempts) throw new Error('PROTOCOL_ATTEMPT_BUDGET_EXCEEDED');
  if (next === 'CLOSE' && !evidence.proven) throw new Error('PROTOCOL_CLOSE_WITHOUT_PROOF');
  state.transitions.push({ from: state.state, to: next, at: new Date().toISOString() });
  state.state = next;
  if (next === 'EVIDENCE_LOCK') state.evidenceLocked = true;
  if (next === 'REPAIR') state.attempt += 1;
  return state;
}

export function assertProtocolClosed(state) {
  if (state.state !== 'CLOSE') throw new Error(`PROTOCOL_NOT_CLOSED:${state.state}`);
  if (!state.evidenceLocked) throw new Error('PROTOCOL_EVIDENCE_NOT_LOCKED');
  return true;
}

export function classifyRisk({ protectedPath = false, workflowPath = false, securitySensitive = false, confidence = 0 } = {}) {
  if (protectedPath || workflowPath || securitySensitive) return 'HUMAN-GATE';
  if (confidence >= 90) return 'AUTO-FIX';
  if (confidence >= 70) return 'GUARDED-FIX';
  return 'HUMAN-GATE';
}

export function validateEvidence(evidence = {}) {
  const required = ['fingerprint', 'targetSha', 'outcome', 'changedPaths'];
  const missing = required.filter((key) => evidence[key] === undefined || evidence[key] === null);
  if (missing.length) return { ok: false, missing };
  if (!Array.isArray(evidence.changedPaths)) return { ok: false, missing: ['changedPaths[]'] };
  if (evidence.outcome === 'verified-repair' && (!evidence.reproductionAfter?.ok || !evidence.regression?.ok)) {
    return { ok: false, missing: ['verified-regression-evidence'] };
  }
  return { ok: true, missing: [] };
}
