#!/usr/bin/env node
import { deriveRepairIdentity, deriveLeaseEventRef, deriveRecoveryRef, evaluateNoProgress, staleRecoveryDecision, REPAIR_OUTCOMES } from './repair-control-plane.mjs';

const API_VERSION = '2022-11-28';
const DEFAULT_STALE_AFTER_MS = 60 * 60 * 1000;

const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
  const [key, ...rest] = arg.slice(2).split('=');
  return [key, rest.join('=')];
}));
const command = process.argv[2];
const getArg = (name, fallback = '') => String(args[name] ?? fallback).trim();

const repo = getArg('repo', process.env.GITHUB_REPOSITORY);
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const apiRoot = process.env.FLIXO_REPAIR_LEASE_API_ROOT || 'https://api.github.com';

async function api(method, path, body = undefined, { root = apiRoot, authToken = token } = {}) {
  if (!repo) throw new Error('REPAIR_LEASE_REPOSITORY_REQUIRED');
  if (!authToken) throw new Error('REPAIR_LEASE_GITHUB_TOKEN_REQUIRED');
  const response = await fetch(`${root}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${authToken}`,
      'x-github-api-version': API_VERSION,
      'content-type': 'application/json',
      'user-agent': 'FLIXO-repair-lease',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = { raw }; }
  return { status: response.status, ok: response.ok, data };
}

export function statusDecision(status) {
  if (status === 201) return 'ACQUIRED';
  if (status === 422) return 'ALREADY_CLAIMED';
  if (status === 401 || status === 403) return 'AUTH_FAILURE';
  if (status >= 500 && status <= 599) return 'PROVIDER_FAILURE';
  return 'FAIL_CLOSED';
}

function requireSha(value, name) {
  if (!/^[a-f0-9]{40}$/iu.test(String(value ?? ''))) throw new Error(`REPAIR_LEASE_${name.toUpperCase()}_INVALID`);
  return String(value);
}

function identityFromArgs() {
  const failedSha = requireSha(getArg('failedSha'), 'failedSha');
  return deriveRepairIdentity({
    failureFingerprint: getArg('fingerprint'),
    failedSha,
    targetRunId: getArg('targetRunId'),
    branch: getArg('branch', 'execution'),
  });
}

function tagObjectName(prefix, attempt, runId) {
  const safe = String(runId || 'unknown').replace(/[^A-Za-z0-9._-]+/gu, '-').slice(0, 40) || 'unknown';
  return `${prefix}-${Number(attempt)}-${safe}`;
}

async function createAnnotatedTag(refName, objectSha, metadata) {
  const tagName = refName.replace(/^refs\/tags\//u, '');
  const tag = await api('POST', `/repos/${repo}/git/tags`, {
    tag: tagName,
    message: JSON.stringify(metadata),
    object: objectSha,
    type: 'commit',
  });
  if (tag.status !== 201) return { status: tag.status, decision: statusDecision(tag.status), tag: null };
  return { status: tag.status, decision: 'TAG_OBJECT_CREATED', tag: tag.data?.sha ?? null };
}

export async function createRefAtomically({ apiRoot: root = 'https://api.github.com', repoName, authToken, refName, objectSha } = {}) {
  if (!repoName) throw new Error('REPAIR_LEASE_REPOSITORY_REQUIRED');
  if (!authToken) throw new Error('REPAIR_LEASE_GITHUB_TOKEN_REQUIRED');
  const response = await fetch(`${root}/repos/${repoName}/git/refs`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${authToken}`,
      'x-github-api-version': API_VERSION,
      'content-type': 'application/json',
      'user-agent': 'FLIXO-repair-lease',
    },
    body: JSON.stringify({ ref: refName, sha: objectSha }),
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = { raw }; }
  return { status: response.status, decision: statusDecision(response.status), data };
}

async function createRef(refName, objectSha) {
  return createRefAtomically({ apiRoot, repoName: repo, authToken: token, refName, objectSha });
}

async function readRef(refName) {
  const encoded = refName.replace(/^refs\//u, '').split('/').map(encodeURIComponent).join('/');
  const result = await api('GET', `/repos/${repo}/git/ref/${encoded}`);
  if (!result.ok) return { status: result.status, data: null };
  return { status: result.status, data: result.data };
}

async function readTagObject(tagSha) {
  const result = await api('GET', `/repos/${repo}/git/tags/${encodeURIComponent(tagSha)}`);
  if (!result.ok) return { status: result.status, metadata: null };
  let metadata = null;
  try { metadata = JSON.parse(String(result.data?.message ?? '')); } catch { metadata = null; }
  return { status: result.status, metadata, data: result.data };
}

async function readLeaseMetadata(leaseRef, failedSha) {
  const ref = await readRef(leaseRef);
  if (!ref.data) return { exists: false, legacy: false, metadata: null, status: ref.status };
  const type = String(ref.data?.object?.type ?? '');
  const sha = String(ref.data?.object?.sha ?? '');
  if (type === 'tag') {
    const tag = await readTagObject(sha);
    if (tag.metadata) return { exists: true, legacy: false, metadata: tag.metadata, status: 200 };
  }
  const commit = await api('GET', `/repos/${repo}/commits/${encodeURIComponent(sha)}`);
  const createdAt = commit.data?.commit?.author?.date ?? commit.data?.commit?.committer?.date ?? null;
  return {
    exists: true,
    legacy: true,
    metadata: {
      schemaVersion: 1,
      kind: 'FLIXO_REPAIR_LEASE_LEGACY',
      leaseRef,
      failedSha,
      createdAt,
      updatedAt: createdAt,
      state: 'LEASE_CLAIMED',
      legacy: true,
    },
    status: 200,
  };
}

async function listRefs(prefix) {
  const routePrefix = prefix.replace(/^refs\/tags\//u, '');
  const result = await api('GET', `/repos/${repo}/git/matching-refs/tags/${encodeURIComponent(routePrefix).replace(/%2F/gu, '/')}`);
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data;
}

async function listEventMetadata(identity) {
  const refs = await listRefs(identity.eventRefPrefix);
  const items = [];
  for (const ref of refs) {
    const sha = String(ref?.object?.sha ?? '');
    if (String(ref?.object?.type) !== 'tag' || !sha) continue;
    const tag = await readTagObject(sha);
    if (tag.metadata) items.push(tag.metadata);
  }
  return items;
}

async function listRecoveryAttempts(identity) {
  const refs = await listRefs(identity.recoveryRefPrefix);
  return refs.map((ref) => {
    const name = String(ref?.ref ?? '');
    const match = name.match(/-(\d+)$/u);
    return match ? Number(match[1]) : 1;
  }).filter(Number.isInteger);
}

async function readWorkflowRun(runId) {
  const result = await api('GET', `/repos/${repo}/actions/runs/${encodeURIComponent(String(runId))}`);
  return { status: result.status, data: result.data };
}

const crashConclusions = new Set(['failure', 'timed_out', 'cancelled']);

async function activeRepairRuns(identity, failedSha) {
  const result = await api('GET', `/repos/${repo}/actions/workflows/auto-repair.yml/runs?branch=execution&per_page=100`);
  if (!result.ok) return [{ status: 'UNKNOWN', reason: `ACTIONS_API_${result.status}` }];
  return (result.data?.workflow_runs ?? []).filter((run) => {
    const status = String(run.status ?? '');
    if (status === 'completed') return false;
    if (String(run.head_sha ?? '') !== String(failedSha)) return false;
    const title = String(run.name ?? '');
    const html = String(run.html_url ?? '');
    return title.includes(identity.repairChainId) || title.includes(String(identity.cycleKey)) || html.includes(String(run.id));
  }).map((run) => ({
    databaseId: run.id,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.head_sha,
    name: run.name,
  }));
}

async function emitEvent(identity, eventType, eventId, payload) {
  const ref = deriveLeaseEventRef({ identity, eventType, eventId });
  const metadata = {
    schemaVersion: 2,
    kind: 'FLIXO_REPAIR_LEASE_EVENT',
    eventType: String(eventType).toUpperCase(),
    ref,
    ...payload,
    at: payload.at ?? new Date().toISOString(),
  };
  const tag = await createAnnotatedTag(ref, payload.failedSha, metadata);
  if (tag.status !== 201) return { ...metadata, ref, status: tag.status, decision: tag.decision };
  const claim = await createRef(ref, tag.tag);
  return { ...metadata, ref, status: claim.status, decision: claim.decision };
}

async function commandClaim() {
  const identity = identityFromArgs();
  const failedSha = getArg('failedSha');
  const attempt = 1;
  const leaseOwner = getArg('leaseOwner', 'DAILY_FLIXO_GREEN_GATE');
  const repairRunId = getArg('repairRunId', '');
  const now = new Date().toISOString();
  const claimMetadata = {
    schemaVersion: 2,
    kind: 'FLIXO_REPAIR_LEASE_ATTESTATION',
    leaseRef: identity.leaseRef,
    claimKey: identity.claimKey,
    repairChainId: identity.repairChainId,
    cycleKey: identity.cycleKey,
    branch: 'execution',
    failedSha,
    failureFingerprint: getArg('fingerprint'),
    targetRunId: getArg('targetRunId'),
    leaseOwner,
    repairRunId: repairRunId || null,
    attempt,
    state: 'LEASE_CLAIMED',
    createdAt: now,
    updatedAt: now,
  };
  const tag = await createAnnotatedTag(identity.leaseRef, failedSha, claimMetadata);
  if (tag.status !== 201) {
    console.log(JSON.stringify({ status: tag.decision, httpStatus: tag.status, leaseRef: identity.leaseRef, repairChainId: identity.repairChainId }, null, 2));
    return;
  }
  const ref = await createRef(identity.leaseRef, tag.tag);
  if (ref.status === 201) {
    await emitEvent(identity, 'STATE', `claim-${identity.claimKey}`, {
      repairKey: identity.claimKey,
      leaseRef: identity.leaseRef,
      failedSha,
      targetRunId: getArg('targetRunId'),
      repairRunId: repairRunId || null,
      attempt,
      leaseOwner,
      state: 'LEASE_CLAIMED',
      leaseState: 'LEASE_CLAIMED',
      at: now,
    });
  }
  console.log(JSON.stringify({
    status: ref.decision,
    httpStatus: ref.status,
    leaseRef: identity.leaseRef,
    repairChainId: identity.repairChainId,
    claimKey: identity.claimKey,
    attempt,
  }, null, 2));
  if (!['ACQUIRED', 'ALREADY_CLAIMED'].includes(ref.decision)) process.exitCode = 1;
}

async function commandVerify() {
  const identity = identityFromArgs();
  const failedSha = getArg('failedSha');
  const attempt = Number(getArg('attempt', '1'));
  const meta = await readLeaseMetadata(identity.leaseRef, failedSha);
  if (!meta.exists) throw new Error('REPAIR_LEASE_MISSING');
  if (meta.metadata?.failedSha && meta.metadata.failedSha !== failedSha) throw new Error('REPAIR_LEASE_FAILED_SHA_MISMATCH');
  if (attempt > 1) {
    const recoveryRef = deriveRecoveryRef({ identity, attempt });
    const recovery = await readRef(recoveryRef);
    if (!recovery.data) throw new Error('REPAIR_RECOVERY_LEASE_MISSING');
  }
  const repairRunId = getArg('repairRunId', process.env.GITHUB_RUN_ID);
  await emitEvent(identity, 'STATE', `active-${repairRunId}`, {
    repairKey: identity.claimKey,
    repairChainId: identity.repairChainId,
    failedSha,
    targetRunId: getArg('targetRunId'),
    repairRunId,
    attempt,
    leaseOwner: getArg('leaseOwner', 'AUTO_REPAIR_BOT'),
    leaseState: 'LEASE_ACTIVE',
  });
  console.log(JSON.stringify({ status: 'LEASE_ACTIVE', leaseRef: identity.leaseRef, repairChainId: identity.repairChainId, attempt }, null, 2));
}

async function commandOutcome() {
  const identity = identityFromArgs();
  const failedSha = getArg('failedSha');
  const exitSha = getArg('exitSha');
  const outcome = getArg('outcome');
  if (!REPAIR_OUTCOMES.includes(outcome)) throw new Error(`REPAIR_LEASE_OUTCOME_INVALID=${outcome}`);
  const verificationProgress = getArg('verificationProgress', 'false') === 'true';
  const repairRunId = getArg('repairRunId', process.env.GITHUB_RUN_ID);
  const attempt = Number(getArg('attempt', '1'));
  const at = new Date().toISOString();
  const metadata = {
    repairKey: identity.claimKey,
    leaseRef: identity.leaseRef,
    leaseOwner: getArg('leaseOwner', 'AUTO_REPAIR_BOT'),
    repairRunId,
    targetRunId: getArg('targetRunId'),
    failedSha,
    failureFingerprint: getArg('fingerprint'),
    branch: 'execution',
    attempt,
    strategy: getArg('strategy'),
    outcome,
    exitSha,
    verification: getArg('verification', 'unknown'),
    verificationProgress,
    noProgress: Boolean(exitSha && exitSha === failedSha && !verificationProgress),
    state: ['VERIFIED_REPAIR', 'VERIFIED_HISTORICAL_REVERT'].includes(outcome) ? 'LEASE_VERIFIED' : outcome === 'STALE' ? 'LEASE_STALE' : 'LEASE_BLOCKED',
    generatedAt: at,
    at,
  };
  const stateEvent = await emitEvent(identity, 'STATE', `${repairRunId}-${metadata.state}`, metadata);
  const outcomeEvent = await emitEvent(identity, 'OUTCOME', `${repairRunId}-${outcome}`, metadata);
  console.log(JSON.stringify({ ...metadata, stateEvent, outcomeEvent }, null, 2));
}

async function commandRecover() {
  const identity = identityFromArgs();
  const failedSha = getArg('failedSha');
  const meta = await readLeaseMetadata(identity.leaseRef, failedSha);
  if (!meta.exists) throw new Error('REPAIR_LEASE_NOT_FOUND_FOR_RECOVERY');
  const events = await listEventMetadata(identity);
  const outcomes = events.filter((item) => item?.eventType === 'OUTCOME' && item?.outcome && item?.repairKey === identity.claimKey);
  const latestActiveState = [...events]
    .filter((item) => item?.eventType === 'STATE' && item?.leaseState === 'LEASE_ACTIVE' && item?.repairKey === identity.claimKey)
    .sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))[0] ?? null;

  if (latestActiveState?.repairRunId && !outcomes.some((item) => String(item.repairRunId) === String(latestActiveState.repairRunId))) {
    const repairRun = await readWorkflowRun(latestActiveState.repairRunId);
    if (repairRun.status === 200 && repairRun.data?.status === 'completed') {
      const conclusion = String(repairRun.data?.conclusion ?? '');
      if (conclusion === 'success') {
        await emitEvent(identity, 'STATE', `attestation-missing-${repairRun.data.id}`, {
          repairKey: identity.claimKey,
          leaseRef: identity.leaseRef,
          failedSha,
          targetRunId: getArg('targetRunId'),
          repairRunId: repairRun.data.id,
          attempt: latestActiveState.attempt ?? 1,
          state: 'LEASE_BLOCKED',
          leaseState: 'LEASE_BLOCKED',
          reason: 'RUN_COMPLETED_WITHOUT_OUTCOME_ATTESTATION',
          verification: 'workflow-run-success-without-durable-outcome',
          at: new Date().toISOString(),
        });
        console.log(JSON.stringify({
          status: 'SUCCESS_WITHOUT_ATTESTATION',
          repairRunId: repairRun.data.id,
          reason: 'RUN_COMPLETED_WITHOUT_OUTCOME_ATTESTATION',
        }, null, 2));
        return;
      }
      if (crashConclusions.has(conclusion)) {
        const crashMetadata = {
          repairKey: identity.claimKey,
          leaseRef: identity.leaseRef,
          leaseOwner: latestActiveState.leaseOwner ?? 'AUTO_REPAIR_BOT',
          repairRunId: repairRun.data.id,
          targetRunId: getArg('targetRunId'),
          failedSha,
          failureFingerprint: getArg('fingerprint'),
          branch: 'execution',
          attempt: latestActiveState.attempt ?? 1,
          strategy: latestActiveState.strategy ?? 'unknown',
          outcome: 'CRASHED',
          exitSha: failedSha,
          verification: `workflow-run-${conclusion}-without-outcome-attestation`,
          verificationProgress: false,
          noProgress: true,
          state: 'LEASE_BLOCKED',
          generatedAt: new Date().toISOString(),
          at: new Date().toISOString(),
        };
        await emitEvent(identity, 'OUTCOME', `${repairRun.data.id}-CRASHED`, crashMetadata);
        outcomes.push({ ...crashMetadata, eventType: 'OUTCOME' });
      }
    } else if (![200, 404].includes(repairRun.status)) {
      console.log(JSON.stringify({
        status: 'FAIL_CLOSED',
        reason: `REPAIR_RUN_EVIDENCE_UNAVAILABLE_${repairRun.status}`,
      }, null, 2));
      process.exitCode = 1;
      return;
    }
  }

  const active = await activeRepairRuns(identity, failedSha);
  const currentRef = await readRef('refs/heads/execution');
  const currentExecutionSha = String(currentRef?.data?.object?.sha ?? '');
  const decision = staleRecoveryDecision({
    leaseCreatedAt: meta.metadata?.createdAt,
    staleAfterMs: Number(getArg('staleAfterMs', String(DEFAULT_STALE_AFTER_MS))),
    currentExecutionSha,
    failedSha,
    activeRuns: active,
    outcomes,
    repairKey: identity.claimKey,
  });
  if (active.some((item) => item.status === 'UNKNOWN')) {
    console.log(JSON.stringify({ status: 'FAIL_CLOSED', reason: 'ACTIVE_SESSION_EVIDENCE_UNAVAILABLE', active, decision }, null, 2));
    process.exitCode = 1;
    return;
  }
  if (!decision.eligible) {
    const status = decision.reasons.includes('NO_PROGRESS_CIRCUIT_OPEN') ? 'CIRCUIT_OPEN'
      : decision.reasons.includes('ACTIVE_REPAIR_SESSION_PRESENT') ? 'ACTIVE'
      : decision.reasons.includes('EXECUTION_SHA_CHANGED') ? 'MUTATION_OR_NEW_SHA'
      : decision.reasons.includes('SUCCESSFUL_REPAIR_ALREADY_VERIFIED') ? 'VERIFIED'
      : 'NOT_STALE';
    if (status === 'CIRCUIT_OPEN') {
      await emitEvent(identity, 'STATE', `circuit-${process.env.GITHUB_RUN_ID || Date.now()}`, {
        repairKey: identity.claimKey,
        leaseRef: identity.leaseRef,
        failedSha,
        targetRunId: getArg('targetRunId'),
        repairRunId: process.env.GITHUB_RUN_ID || null,
        attempt: Number(getArg('attempt', '1')),
        state: 'LEASE_CIRCUIT_OPEN',
        verification: 'no-progress-circuit-open',
        verificationProgress: false,
        at: new Date().toISOString(),
      });
    }
    console.log(JSON.stringify({ status, decision, active }, null, 2));
    return;
  }

  const existingAttempts = await listRecoveryAttempts(identity);
  const nextAttempt = Math.max(1, ...existingAttempts) + 1;
  const recoveryRef = deriveRecoveryRef({ identity, attempt: nextAttempt });
  const recoveryMetadata = {
    schemaVersion: 2,
    kind: 'FLIXO_REPAIR_LEASE_RECOVERY',
    repairKey: identity.claimKey,
    leaseRef: identity.leaseRef,
    recoveryRef,
    repairChainId: identity.repairChainId,
    cycleKey: identity.cycleKey,
    branch: 'execution',
    failedSha,
    failureFingerprint: getArg('fingerprint'),
    targetRunId: getArg('targetRunId'),
    leaseOwner: getArg('leaseOwner', 'DAILY_FLIXO_GREEN_GATE'),
    repairRunId: null,
    attempt: nextAttempt,
    state: 'LEASE_STALE',
    previousNoProgressCycles: decision.noProgress.consecutiveNoProgress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recoveryReason: decision.reasons,
  };
  const tag = await createAnnotatedTag(recoveryRef, failedSha, recoveryMetadata);
  if (tag.status !== 201) {
    console.log(JSON.stringify({ status: tag.decision, httpStatus: tag.status, recoveryRef, attempt: nextAttempt }, null, 2));
    if (!['ACQUIRED', 'ALREADY_CLAIMED'].includes(tag.decision)) process.exitCode = 1;
    return;
  }
  const ref = await createRef(recoveryRef, tag.tag);
  if (ref.status === 201) {
    await emitEvent(identity, 'STATE', `stale-${nextAttempt}-${process.env.GITHUB_RUN_ID || Date.now()}`, {
      ...recoveryMetadata,
      state: 'LEASE_STALE',
      repairRunId: process.env.GITHUB_RUN_ID || null,
      at: new Date().toISOString(),
    });
  }
  console.log(JSON.stringify({
    status: ref.decision === 'ACQUIRED' ? 'RECOVERY_ACQUIRED' : ref.decision === 'ALREADY_CLAIMED' ? 'RECOVERY_ALREADY_CLAIMED' : ref.decision,
    httpStatus: ref.status,
    recoveryRef,
    attempt: nextAttempt,
    repairChainId: identity.repairChainId,
    decision,
  }, null, 2));
  if (!['ACQUIRED', 'ALREADY_CLAIMED'].includes(ref.decision)) process.exitCode = 1;
}

function usage() {
  throw new Error('Usage: repair-lease.mjs claim|verify|outcome|recover');
}

if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] ?? '').href) {
  try {
    if (command === 'claim') await commandClaim();
    else if (command === 'verify') await commandVerify();
    else if (command === 'outcome') await commandOutcome();
    else if (command === 'recover') await commandRecover();
    else usage();
  } catch (error) {
    console.error(String(error?.stack ?? error));
    process.exitCode = 1;
  }
}

export { identityFromArgs };
