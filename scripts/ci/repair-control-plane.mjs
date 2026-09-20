#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';

export const CONTROL_PLANE_SCHEMA_VERSION = 1;
export const CONTROL_PLANE_AUTHORITY = 'FLIXO_REPAIR_CONTROL_PLANE';

export const REPAIR_STATES = Object.freeze([
  'DETECTED',
  'CLAIMED',
  'EVIDENCE_LOCKED',
  'RCA',
  'REPAIR_PLANNED',
  'MUTATING',
  'LOCAL_VERIFICATION',
  'PUBLISHED_TO_EXECUTION',
  'CANONICAL_CI',
  'RED_AGAIN',
  'GREEN',
  'PROMOTION',
  'CLOSED',
  'BLOCKED',
]);

const TRANSITIONS = Object.freeze({
  DETECTED: ['CLAIMED', 'BLOCKED'],
  CLAIMED: ['EVIDENCE_LOCKED', 'BLOCKED'],
  'EVIDENCE_LOCKED': ['RCA', 'BLOCKED'],
  RCA: ['REPAIR_PLANNED', 'BLOCKED'],
  REPAIR_PLANNED: ['MUTATING', 'BLOCKED'],
  MUTATING: ['LOCAL_VERIFICATION', 'BLOCKED'],
  LOCAL_VERIFICATION: ['PUBLISHED_TO_EXECUTION', 'REPAIR_PLANNED', 'BLOCKED'],
  PUBLISHED_TO_EXECUTION: ['CANONICAL_CI', 'BLOCKED'],
  CANONICAL_CI: ['GREEN', 'RED_AGAIN', 'BLOCKED'],
  RED_AGAIN: ['RCA', 'BLOCKED'],
  GREEN: ['PROMOTION', 'BLOCKED'],
  PROMOTION: ['CLOSED', 'BLOCKED'],
  CLOSED: [],
  BLOCKED: [],
});

export const CIRCUIT_BREAKER = Object.freeze({
  maxStalledCycles: 3,
  definition: 'SAME_REPAIR_KEY_WITH_NO_EXIT_SHA_CHANGE_AND_NO_VERIFICATION_PROGRESS',
  failClosed: true,
});

export const LEASE_STATES = Object.freeze([
  'LEASE_CLAIMED',
  'LEASE_ACTIVE',
  'LEASE_VERIFIED',
  'LEASE_BLOCKED',
  'LEASE_STALE',
  'LEASE_CIRCUIT_OPEN',
]);

export const REPAIR_OUTCOMES = Object.freeze([
  'VERIFIED_REPAIR',
  'VERIFIED_HISTORICAL_REVERT',
  'BLOCKED_EXTERNAL',
  'BLOCKED_RCA',
  'FAILED_REPAIR',
  'CRASHED',
  'STALE',
]);

const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');
const isSha = (value) => /^[a-f0-9]{40}$/iu.test(String(value ?? ''));
const requireText = (name, value) => {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`CONTROL_PLANE_${name.toUpperCase()}_REQUIRED`);
  return text;
};

export function deriveRepairIdentity({ failureFingerprint, failedSha, targetRunId, branch = 'execution' }) {
  requireText('failureFingerprint', failureFingerprint);
  requireText('targetRunId', targetRunId);
  if (!['execution', 'main'].includes(branch)) throw new Error('CONTROL_PLANE_REPAIR_BRANCH_BLOCKED');
  if (!isSha(failedSha)) throw new Error('CONTROL_PLANE_FAILED_SHA_INVALID');
  const cycleKey = `${branch}:${failedSha}:${failureFingerprint}:${targetRunId}`;
  const digest = sha256(cycleKey);
  return Object.freeze({
    cycleKey,
    claimKey: `claim-${digest}`,
    repairChainId: `RC-${digest.slice(0, 20)}`,
    leaseRef: `refs/tags/flixo-repair-lease-${digest}`,
    recoveryRefPrefix: `refs/tags/flixo-repair-lease-recovery-${digest}`,
    eventRefPrefix: `refs/tags/flixo-repair-event-${digest}`,
  });
}


const safeRefToken = (value) => String(value ?? '')
  .trim()
  .replace(/[^A-Za-z0-9._-]+/gu, '-')
  .replace(/^-+|-+$/gu, '')
  .slice(0, 120) || 'unknown';

export function deriveLeaseEventRef({ identity, eventType, eventId }) {
  if (!identity?.eventRefPrefix) throw new Error('CONTROL_PLANE_LEASE_IDENTITY_REQUIRED');
  if (!eventType) throw new Error('CONTROL_PLANE_LEASE_EVENT_TYPE_REQUIRED');
  if (!eventId) throw new Error('CONTROL_PLANE_LEASE_EVENT_ID_REQUIRED');
  const event = safeRefToken(eventType).toLowerCase();
  const id = safeRefToken(eventId);
  return `${identity.eventRefPrefix}-${event}-${id}`;
}

export function deriveRecoveryRef({ identity, attempt }) {
  if (!identity?.recoveryRefPrefix) throw new Error('CONTROL_PLANE_LEASE_IDENTITY_REQUIRED');
  const n = Number(attempt);
  if (!Number.isInteger(n) || n < 2) throw new Error('CONTROL_PLANE_RECOVERY_ATTEMPT_INVALID');
  return `${identity.recoveryRefPrefix}-${n}`;
}

export function classifyRepairOutcome({ outcome, failedSha, exitSha, verificationProgress = false } = {}) {
  if (!REPAIR_OUTCOMES.includes(String(outcome))) throw new Error(`CONTROL_PLANE_UNKNOWN_REPAIR_OUTCOME=${outcome}`);
  return Object.freeze({
    outcome,
    failedSha: String(failedSha ?? ''),
    exitSha: String(exitSha ?? ''),
    verificationProgress: Boolean(verificationProgress),
    noProgress: Boolean(failedSha && exitSha && failedSha === exitSha && verificationProgress !== true),
  });
}

export function evaluateNoProgress({ repairKey, outcomes = [] } = {}) {
  const key = requireText('repairKey', repairKey);
  const ordered = [...outcomes]
    .filter((item) => String(item?.repairKey ?? '') === key)
    .sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
  let consecutiveNoProgress = 0;
  for (const item of ordered) {
    const noProgress = item?.noProgress === true || (
      String(item?.failedSha ?? '') !== '' &&
      String(item?.exitSha ?? '') === String(item.failedSha) &&
      item?.verificationProgress !== true
    );
    if (!noProgress) break;
    consecutiveNoProgress += 1;
  }
  return Object.freeze({
    repairKey: key,
    attempts: ordered.length,
    consecutiveNoProgress,
    circuitOpen: consecutiveNoProgress >= CIRCUIT_BREAKER.maxStalledCycles,
  });
}

export function staleRecoveryDecision({
  now = Date.now(),
  leaseCreatedAt,
  staleAfterMs = 60 * 60 * 1000,
  currentExecutionSha,
  failedSha,
  activeRuns = [],
  outcomes = [],
  repairKey,
} = {}) {
  const ageMs = Math.max(0, Number(now) - Date.parse(String(leaseCreatedAt ?? '')));
  const progress = evaluateNoProgress({ repairKey, outcomes });
  const verified = outcomes.some((item) => ['VERIFIED_REPAIR', 'VERIFIED_HISTORICAL_REVERT'].includes(item?.outcome));
  const reasons = [];
  const strategyRotationRequired = progress.circuitOpen;
  if (!Number.isFinite(ageMs) || ageMs < staleAfterMs) reasons.push('LEASE_NOT_OLD_ENOUGH');
  if (activeRuns.length > 0) reasons.push('ACTIVE_REPAIR_SESSION_PRESENT');
  if (String(currentExecutionSha ?? '') !== String(failedSha ?? '')) reasons.push('EXECUTION_SHA_CHANGED');
  if (verified) reasons.push('SUCCESSFUL_REPAIR_ALREADY_VERIFIED');
  if (progress.circuitOpen) reasons.push('NO_PROGRESS_REQUIRES_STRATEGY_ROTATION');
  return Object.freeze({
    eligible: reasons.length === 0,
    ageMs,
    noProgress: progress,
    successfulVerificationPresent: verified,
    strategyRotationRequired,
    reasons,
  });
}

export function createRepairCycle({
  failureFingerprint,
  failedSha,
  targetRunId,
  executionSha,
  mainSha = null,
  observedBranch = 'execution',
  owner = null,
  createdAt = new Date().toISOString(),
} = {}) {
  if (observedBranch !== 'execution') throw new Error('CONTROL_PLANE_REPAIR_BRANCH_BLOCKED');
  if (!isSha(executionSha)) throw new Error('CONTROL_PLANE_EXECUTION_SHA_INVALID');
  if (mainSha !== null && !isSha(mainSha)) throw new Error('CONTROL_PLANE_MAIN_SHA_INVALID');
  const identity = deriveRepairIdentity({ failureFingerprint, failedSha, targetRunId, branch: observedBranch });
  return Object.freeze({
    schemaVersion: CONTROL_PLANE_SCHEMA_VERSION,
    authority: CONTROL_PLANE_AUTHORITY,
    ...identity,
    state: 'DETECTED',
    targetRunId: requireText('targetRunId', targetRunId),
    failureFingerprint: String(failureFingerprint),
    failedSha: String(failedSha),
    executionSha: String(executionSha),
    mainSha: mainSha ?? null,
    observedBranch,
    owner: owner ?? null,
    attempt: 0,
    stalledCycles: 0,
    strategyHistory: [],
    evidence: [],
    events: [{
      from: null,
      to: 'DETECTED',
      at: createdAt,
      actor: owner ?? 'WATCHER',
      reason: 'RED_OBSERVED',
    }],
    createdAt,
    updatedAt: createdAt,
  });
}

export function assertTransition(from, to) {
  if (!REPAIR_STATES.includes(from) || !REPAIR_STATES.includes(to)) {
    throw new Error(`CONTROL_PLANE_UNKNOWN_STATE=${from}->${to}`);
  }
  if (!TRANSITIONS[from].includes(to)) {
    throw new Error(`CONTROL_PLANE_INVALID_TRANSITION=${from}->${to}`);
  }
  return true;
}

export function transitionRepairCycle(cycle, to, {
  actor = 'CONTROL_PLANE',
  reason = 'STATE_TRANSITION',
  at = new Date().toISOString(),
  evidence = null,
  patch = {},
} = {}) {
  assertTransition(cycle.state, to);
  if (to === 'MUTATING' && cycle.observedBranch !== 'execution') {
    throw new Error('CONTROL_PLANE_MUTATION_BRANCH_BLOCKED');
  }
  if (to === 'PUBLISHED_TO_EXECUTION' && cycle.observedBranch !== 'execution') {
    throw new Error('CONTROL_PLANE_PUBLICATION_BRANCH_BLOCKED');
  }
  if (to === 'CANONICAL_CI' && !isSha(cycle.executionSha)) {
    throw new Error('CONTROL_PLANE_CANONICAL_SHA_REQUIRED');
  }
  const next = {
    ...cycle,
    ...patch,
    state: to,
    updatedAt: at,
    events: [
      ...(cycle.events ?? []),
      { from: cycle.state, to, at, actor, reason },
    ],
  };
  if (evidence !== null) next.evidence = [...(cycle.evidence ?? []), evidence];
  return Object.freeze(next);
}

export function claimRepairCycle(cycle, {
  owner = 'DAILY_FLIXO_GREEN_GATE',
  at = new Date().toISOString(),
} = {}) {
  if (cycle.state !== 'DETECTED') {
    throw new Error(`CONTROL_PLANE_CLAIM_STATE_BLOCKED=${cycle.state}`);
  }
  if (!String(owner).trim()) throw new Error('CONTROL_PLANE_CLAIM_OWNER_REQUIRED');
  return transitionRepairCycle(cycle, 'CLAIMED', {
    actor: owner,
    reason: 'ATOMIC_CLAIM_AUTHORIZED',
    at,
    patch: { owner: String(owner) },
  });
}

export function recordStrategyAttempt(cycle, {
  strategy,
  progress,
  at = new Date().toISOString(),
} = {}) {
  const id = requireText('strategy', strategy);
  const attempts = [...(cycle.strategyHistory ?? []), {
    strategy: id,
    progress: Boolean(progress),
    at,
  }];
  const stalledCycles = progress ? 0 : Number(cycle.stalledCycles ?? 0) + 1;
  const circuitOpen = stalledCycles >= CIRCUIT_BREAKER.maxStalledCycles;
  return Object.freeze({
    ...cycle,
    strategyHistory: attempts,
    stalledCycles,
    updatedAt: at,
    circuitOpen,
    nextAction: circuitOpen
      ? 'ROTATE_STRATEGY_AND_REQUIRE_NEW_EVIDENCE'
      : 'CONTINUE_CURRENT_REPAIR_CHAIN',
  });
}

export function assertClosure(cycle, {
  canonicalGreen = false,
  zeroRedChecks = false,
  freshExactShaEvidence = false,
  regressionProof = false,
  noUnprocessedActionableRed = false,
} = {}) {
  if (cycle.state !== 'PROMOTION') throw new Error('CONTROL_PLANE_CLOSURE_STATE_BLOCKED');
  const gates = { canonicalGreen, zeroRedChecks, freshExactShaEvidence, regressionProof, noUnprocessedActionableRed };
  const failed = Object.entries(gates).filter(([, ok]) => ok !== true).map(([key]) => key);
  if (failed.length) throw new Error(`CONTROL_PLANE_CLOSURE_BLOCKED=${failed.join(',')}`);
  return true;
}

export function controlPlaneSchema() {
  return Object.freeze({
    schemaVersion: CONTROL_PLANE_SCHEMA_VERSION,
    authority: CONTROL_PLANE_AUTHORITY,
    states: REPAIR_STATES,
    transitions: TRANSITIONS,
    circuitBreaker: CIRCUIT_BREAKER,
    invariants: [
      'EXECUTION_IS_ONLY_MUTATION_BRANCH',
      'MAIN_IS_NEVER_MUTATED_BY_REPAIR_AGENT',
      'CANONICAL_CI_IS_FINAL_GREEN_AUTHORITY',
      'RED_REMAINS_OPEN_UNTIL_VERIFIED_GREEN',
      'STALE_SHA_BLOCKS_PUBLICATION',
        'DUPLICATE_CLAIMS_SHARE_A_DETERMINISTIC_CLAIM_KEY',
      'GLOBAL_REPAIR_LEASE_IS_ATOMIC_AND_DURABLE',
      'GLOBAL_REPAIR_LEASE_IS_HTTP_STATUS_DRIVEN',
      'GLOBAL_REPAIR_LEASE_IS_NOT_A_BRANCH',
      'REPAIR_IDENTITY_HAS_ONE_CANONICAL_SOURCE',
      'STALE_LEASE_REQUIRES_ACTIVE_SESSION_AND_SHA_GATES',
      'NO_PROGRESS_REQUIRES_SAME_REPAIR_KEY_NO_EXIT_SHA_CHANGE_AND_NO_VERIFICATION_PROGRESS',
    ],
  });
}

function cli() {
  const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=')];
  }));
  const command = process.argv[2];
  if (command === 'schema') {
    console.log(JSON.stringify(controlPlaneSchema(), null, 2));
    return;
  }
  if (command === 'identity') {
    const identity = deriveRepairIdentity({
      failureFingerprint: args.fingerprint,
      failedSha: args.failedSha,
      targetRunId: args.targetRunId,
      branch: args.branch || 'execution',
    });
    console.log(JSON.stringify(identity, null, 2));
    return;
  }
  if (command === 'lease-ref') {
    const identity = deriveRepairIdentity({
      failureFingerprint: args.fingerprint,
      failedSha: args.failedSha,
      targetRunId: args.targetRunId,
      branch: args.branch || 'execution',
    });
    console.log(identity.leaseRef);
    return;
  }
  if (command === 'claim') {
    const cycle = createRepairCycle({
      failureFingerprint: args.fingerprint,
      failedSha: args.failedSha,
      targetRunId: args.targetRunId,
      executionSha: args.executionSha,
      mainSha: args.mainSha || null,
      observedBranch: args.branch || 'execution',
      owner: args.owner || 'DAILY_FLIXO_GREEN_GATE',
    });
    const claimed = claimRepairCycle(cycle, { owner: args.owner || 'DAILY_FLIXO_GREEN_GATE' });
    console.log(JSON.stringify(claimed, null, 2));
    return;
  }
  if (command === 'advance') {
    const file = requireText('file', args.file);
    const to = requireText('state', args.to);
    const cycle = JSON.parse(fs.readFileSync(file, 'utf8'));
    const next = transitionRepairCycle(cycle, to, {
      actor: args.actor || 'CONTROL_PLANE',
      reason: args.reason || 'STATE_TRANSITION',
    });
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    console.log(JSON.stringify(next, null, 2));
    return;
  }
  throw new Error('Usage: repair-control-plane.mjs schema|identity|lease-ref|claim|advance');
}

const invokedDirectly = Boolean(process.argv[1] && /(?:^|[\\/])repair-control-plane\.mjs$/u.test(process.argv[1]));
if (invokedDirectly) {
  try {
    cli();
  } catch (error) {
    console.error(String(error?.message ?? error));
    process.exit(1);
  }
}
