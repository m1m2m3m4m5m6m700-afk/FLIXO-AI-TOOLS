#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SHA_RE = /^[a-f0-9]{40}$/u;
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;

export const INVOCATION_STATES = Object.freeze([
  'DISPATCHED',
  'RECEIVED',
  'ACCEPTED',
  'STARTED',
  'HEARTBEAT',
  'COMPLETED',
  'VERIFIED',
  'FAILED',
  'STALE',
  'SUPERSEDED',
  'BLOCKED_CONFLICT',
]);

export const INVOCATION_TRANSITIONS = Object.freeze({
  DISPATCHED: Object.freeze(['RECEIVED', 'STALE', 'SUPERSEDED', 'BLOCKED_CONFLICT']),
  RECEIVED: Object.freeze(['ACCEPTED', 'STALE', 'SUPERSEDED', 'BLOCKED_CONFLICT']),
  ACCEPTED: Object.freeze(['STARTED', 'STALE', 'SUPERSEDED', 'BLOCKED_CONFLICT']),
  STARTED: Object.freeze(['HEARTBEAT', 'COMPLETED', 'FAILED', 'STALE', 'SUPERSEDED', 'BLOCKED_CONFLICT']),
  HEARTBEAT: Object.freeze(['HEARTBEAT', 'COMPLETED', 'FAILED', 'STALE', 'SUPERSEDED', 'BLOCKED_CONFLICT']),
  COMPLETED: Object.freeze(['VERIFIED', 'STALE', 'SUPERSEDED']),
  FAILED: Object.freeze(['STALE', 'SUPERSEDED']),
  VERIFIED: Object.freeze([]),
  STALE: Object.freeze([]),
  SUPERSEDED: Object.freeze([]),
  BLOCKED_CONFLICT: Object.freeze([]),
});

const now = () => new Date().toISOString();
const currentShaFromGit = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

const requireIdentifier = (value, label) => {
  const normalized = String(value ?? '').trim();
  if (!IDENTIFIER_RE.test(normalized)) throw new Error(`INVOCATION_${label.toUpperCase()}_INVALID`);
  return normalized;
};

export const requireSha = (value, label = 'SHA') => {
  const normalized = String(value ?? '').trim();
  if (!SHA_RE.test(normalized)) throw new Error(`INVOCATION_${label.toUpperCase()}_INVALID`);
  return normalized;
};

const requirePositiveInteger = (value, label) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) throw new Error(`INVOCATION_${label.toUpperCase()}_INVALID`);
  return normalized;
};

export const deriveFailureFingerprint = (message) => {
  const explicit = message?.failureFingerprint ?? message?.payload?.failureFingerprint;
  if (explicit) return requireIdentifier(explicit, 'failure_fingerprint');
  const basis = {
    taskId: String(message?.taskId ?? ''),
    intent: String(message?.intent ?? ''),
    scope: Array.isArray(message?.scope) ? [...message.scope] : [],
    dependencies: Array.isArray(message?.dependencies) ? [...message.dependencies] : [],
    proofObligations: Array.isArray(message?.proofObligations) ? [...message.proofObligations] : [],
  };
  return `causal:${sha256(JSON.stringify(basis)).slice(0, 32)}`;
};

const canonicalIdentity = ({ messageId, taskId, targetSha, failureFingerprint, attempt, leaseEpoch }) =>
  JSON.stringify({
    messageId,
    taskId,
    targetSha,
    failureFingerprint,
    attempt,
    leaseEpoch,
  });

export function buildInvocationIdentity({
  messageId,
  taskId,
  targetSha,
  failureFingerprint,
  attempt = 1,
  leaseEpoch = 1,
} = {}) {
  const identity = {
    messageId: requireIdentifier(messageId, 'message_id'),
    taskId: requireIdentifier(taskId, 'task_id'),
    targetSha: requireSha(targetSha, 'target_sha'),
    failureFingerprint: requireIdentifier(failureFingerprint, 'failure_fingerprint'),
    attempt: requirePositiveInteger(attempt, 'attempt'),
    leaseEpoch: requirePositiveInteger(leaseEpoch, 'lease_epoch'),
  };
  return {
    schemaVersion: 1,
    invocationId: `INV-${sha256(canonicalIdentity(identity)).slice(0, 32)}`,
    ...identity,
    supersessionKey: `SUP-${sha256(JSON.stringify({
      taskId: identity.taskId,
      failureFingerprint: identity.failureFingerprint,
    })).slice(0, 32)}`,
  };
}

export function buildInvocationFromMessage(message, { currentSha = currentShaFromGit(), at = now() } = {}) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('INVOCATION_MESSAGE_INVALID');
  const targetSha = requireSha(message.entrySha, 'target_sha');
  const observedSha = requireSha(currentSha, 'current_sha');
  if (targetSha !== observedSha) throw new Error('INVOCATION_STALE_TARGET_SHA');
  const identity = buildInvocationIdentity({
    messageId: message.messageId,
    taskId: message.taskId,
    targetSha,
    failureFingerprint: deriveFailureFingerprint(message),
    attempt: message?.payload?.attempt ?? message?.attempt ?? 1,
    leaseEpoch: message?.payload?.leaseEpoch ?? message?.leaseEpoch ?? 1,
  });
  const invocation = {
    ...identity,
    idempotencyKey: String(message.idempotencyKey ?? message.messageId),
    actor: String(message.actor ?? ''),
    recipient: String(message.recipient ?? ''),
    state: 'DISPATCHED',
    entrySha: targetSha,
    targetSha,
    createdAt: String(at),
    updatedAt: String(at),
    currentShaAtAdmission: observedSha,
    evidenceRefs: [],
    supersededBySha: null,
  };
  return assertInvocation(invocation);
}

export function assertInvocation(invocation) {
  if (!invocation || typeof invocation !== 'object' || Array.isArray(invocation)) throw new Error('INVOCATION_INVALID');
  for (const field of ['messageId', 'taskId', 'failureFingerprint', 'invocationId', 'supersessionKey']) requireIdentifier(invocation[field], field);
  requireSha(invocation.targetSha, 'target_sha');
  requireSha(invocation.entrySha, 'entry_sha');
  if (invocation.entrySha !== invocation.targetSha) throw new Error('INVOCATION_ENTRY_TARGET_SHA_MISMATCH');
  requirePositiveInteger(invocation.attempt, 'attempt');
  requirePositiveInteger(invocation.leaseEpoch, 'lease_epoch');
  if (!INVOCATION_STATES.includes(String(invocation.state))) throw new Error('INVOCATION_STATE_INVALID');
  if (!String(invocation.createdAt ?? '').trim() || !String(invocation.updatedAt ?? '').trim()) throw new Error('INVOCATION_TIMESTAMPS_REQUIRED');
  return invocation;
}

export function assertInvocationCurrent(invocation, currentSha = currentShaFromGit()) {
  assertInvocation(invocation);
  const observedSha = requireSha(currentSha, 'current_sha');
  if (invocation.targetSha !== observedSha) throw new Error('INVOCATION_STALE_TARGET_SHA');
  if (invocation.state === 'STALE' || invocation.state === 'SUPERSEDED') throw new Error(`INVOCATION_NOT_CURRENT=${invocation.state}`);
  return true;
}

export function canTransition(fromState, toState) {
  return INVOCATION_TRANSITIONS[String(fromState)]?.includes(String(toState)) === true;
}

export function transitionInvocation(invocation, toState, {
  currentSha = currentShaFromGit(),
  at = now(),
  evidenceRef = null,
  metadata = {},
} = {}) {
  assertInvocation(invocation);
  const next = String(toState);
  if (!INVOCATION_STATES.includes(next)) throw new Error('INVOCATION_NEXT_STATE_INVALID');
  if (!canTransition(invocation.state, next)) {
    throw new Error(`INVOCATION_TRANSITION_FORBIDDEN=${invocation.state}->${next}`);
  }
  const observedSha = requireSha(currentSha, 'current_sha');
  if (!['STALE', 'SUPERSEDED'].includes(next) && invocation.targetSha !== observedSha) {
    throw new Error('INVOCATION_STALE_TARGET_SHA');
  }
  if (next === 'VERIFIED' && invocation.targetSha !== observedSha) throw new Error('INVOCATION_VERIFICATION_STALE');
  return assertInvocation({
    ...invocation,
    state: next,
    updatedAt: String(at),
    evidenceRefs: evidenceRef ? [...new Set([...(invocation.evidenceRefs ?? []), String(evidenceRef)])] : [...(invocation.evidenceRefs ?? [])],
    ...metadata,
  });
}

export function supersedeInvocation(invocation, {
  newerSha,
  currentSha = newerSha,
  at = now(),
  evidenceRef = null,
} = {}) {
  const latestSha = requireSha(newerSha, 'newer_sha');
  const observedSha = requireSha(currentSha, 'current_sha');
  if (latestSha !== observedSha) throw new Error('INVOCATION_SUPERSESSION_SHA_NOT_CURRENT');
  assertInvocation(invocation);
  if (latestSha === invocation.targetSha) throw new Error('INVOCATION_SUPERSESSION_REQUIRES_NEWER_SHA');
  return transitionInvocation(invocation, 'SUPERSEDED', {
    currentSha: observedSha,
    at,
    evidenceRef,
    metadata: {
      supersededBySha: latestSha,
    },
  });
}

export function isRecoveryAdmissible({
  leaseExpired,
  heartbeatValid,
  newerInvocationExists,
  exactShaCurrent,
  competingOwner,
} = {}) {
  return leaseExpired === true &&
    heartbeatValid === false &&
    newerInvocationExists === false &&
    exactShaCurrent === true &&
    competingOwner === false;
}

export function assertRecoveryAdmissible(input) {
  if (!isRecoveryAdmissible(input)) throw new Error('INVOCATION_RECOVERY_NOT_ADMISSIBLE');
  return true;
}

export function buildRecoveryDecision(input) {
  return {
    admissible: isRecoveryAdmissible(input),
    rule: 'LEASE_EXPIRED + NO_VALID_HEARTBEAT + NO_NEWER_INVOCATION + EXACT_SHA_CURRENT + NO_COMPETING_OWNER',
  };
}

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token.startsWith('--')) continue;
  const eq = token.indexOf('=');
  const key = token.slice(2, eq >= 0 ? eq : undefined);
  const value = eq >= 0 ? token.slice(eq + 1) : process.argv[index + 1];
  args.set(key, value ?? '');
}
const command = String(process.argv[2] ?? '').trim().toLowerCase();
const getArg = (key, fallback = '') => String(args.get(key) ?? fallback).trim();

if (command === 'build') {
  const messageFile = path.resolve(ROOT, getArg('message-file'));
  const outputFile = path.resolve(ROOT, getArg('output', '/tmp/flixo-invocation.json'));
  if (!messageFile || !fs.existsSync(messageFile)) throw new Error('INVOCATION_MESSAGE_FILE_MISSING');
  const message = JSON.parse(fs.readFileSync(messageFile, 'utf8'));
  const invocation = buildInvocationFromMessage(message, {
    currentSha: getArg('current-sha', currentShaFromGit()),
  });
  fs.writeFileSync(outputFile, `${JSON.stringify(invocation, null, 2)}\\n`);
  console.log(JSON.stringify(invocation, null, 2));
} else if (command === 'validate') {
  const invocationFile = path.resolve(ROOT, getArg('invocation-file'));
  if (!invocationFile || !fs.existsSync(invocationFile)) throw new Error('INVOCATION_FILE_MISSING');
  const invocation = assertInvocation(JSON.parse(fs.readFileSync(invocationFile, 'utf8')));
  if (getArg('current-sha')) assertInvocationCurrent(invocation, getArg('current-sha'));
  console.log(JSON.stringify({
    status: 'VALID',
    invocationId: invocation.invocationId,
    targetSha: invocation.targetSha,
    state: invocation.state,
    supersessionKey: invocation.supersessionKey,
  }, null, 2));
} else if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  throw new Error('Usage: invocation-contract.mjs build|validate');
}
