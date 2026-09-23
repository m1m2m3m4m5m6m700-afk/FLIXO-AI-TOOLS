#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  AGENT_LIVENESS_PROTOCOL,
  assertLivenessDefinition,
  assertState,
  checkHeartbeat,
  checkProgress,
  completionGate,
} from './agent-liveness-protocol.mjs';

export const MISSION_CONTINUITY_PROTOCOL = Object.freeze({
  protocolId: 'FLIXO-MISSION-CONTINUITY-v1',
  schemaVersion: 1,
  branch: 'execution',
  terminalState: 'CLOSED',
  residentState: 'READY_RESIDENT',
  forbiddenStates: Object.freeze(['SLEEP', 'IDLE', 'SILENT', 'ABANDONED', 'STOPPED', 'TERMINATED']),
  recoveryReasons: Object.freeze([
    'HEARTBEAT_MISSING', 'HEARTBEAT_STALE', 'NO_PROGRESS', 'WORKFLOW_FAILED',
    'WORKFLOW_TIMED_OUT', 'WORKFLOW_CANCELLED', 'SESSION_CRASHED',
    'LEASE_EXPIRED', 'EXACT_SHA_DRIFT', 'UNEXPECTED_EXIT',
  ]),
});

const SHA_RE = /^[0-9a-f]{40}$/iu;
const DEFAULT_ROOT = 'diagnostics/mission-continuity';

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const item = process.argv.find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : fallback;
}

function safeId(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(normalized)) {
    throw new Error(`MISSION_CONTINUITY_${label.toUpperCase()}_INVALID`);
  }
  return normalized;
}

function sha(value, label) {
  if (!SHA_RE.test(String(value ?? ''))) {
    throw new Error(`MISSION_CONTINUITY_${label.toUpperCase()}_SHA_INVALID`);
  }
  return String(value).toLowerCase();
}

function stateRoot(root) {
  return path.resolve(root || process.env.FLIXO_MISSION_STATE_ROOT || DEFAULT_ROOT);
}

function statePath(missionId, root) {
  return path.join(stateRoot(root), `${safeId(missionId, 'mission_id')}.json`);
}

function eventsPath(missionId, root) {
  return path.join(stateRoot(root), `${safeId(missionId, 'mission_id')}.events.jsonl`);
}

function digest(value) {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
    .digest('hex');
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`MISSION_CONTINUITY_STATE_INVALID=${file}`);
  }
  return parsed;
}

function writeAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

function emit(missionId, root, state, type, payload = {}) {
  const event = {
    schemaVersion: 1,
    protocol: MISSION_CONTINUITY_PROTOCOL.protocolId,
    missionId: state.missionId,
    taskId: state.taskId,
    sequence: state.revision,
    type,
    state: state.state,
    exactSha: state.currentSha,
    at: new Date().toISOString(),
    payload,
  };
  event.digest = digest(event);
  fs.mkdirSync(stateRoot(root), { recursive: true });
  fs.appendFileSync(eventsPath(missionId, root), JSON.stringify(event) + '\n', 'utf8');
}

function assertMission(state) {
  if (!state || typeof state !== 'object') throw new Error('MISSION_CONTINUITY_STATE_REQUIRED');
  safeId(state.missionId, 'mission_id');
  safeId(state.taskId, 'task_id');
  sha(state.entrySha, 'entry');
  sha(state.currentSha, 'current');
  if (state.branch !== 'execution') throw new Error('MISSION_CONTINUITY_BRANCH_INVALID');
  if (!Number.isInteger(state.revision) || state.revision < 1) throw new Error('MISSION_CONTINUITY_REVISION_INVALID');
  if (!Number.isInteger(state.attempt) || state.attempt < 1) throw new Error('MISSION_CONTINUITY_ATTEMPT_INVALID');
  if (MISSION_CONTINUITY_PROTOCOL.forbiddenStates.includes(String(state.state))) {
    throw new Error(`MISSION_CONTINUITY_FORBIDDEN_STATE=${state.state}`);
  }
  return state;
}

function transition(state, nextState) {
  if (MISSION_CONTINUITY_PROTOCOL.forbiddenStates.includes(nextState)) {
    throw new Error(`MISSION_CONTINUITY_FORBIDDEN_STATE=${nextState}`);
  }
  if (state.state === 'CLOSED' && nextState !== 'CLOSED') {
    throw new Error('MISSION_CONTINUITY_CLOSED_REOPEN_FORBIDDEN');
  }
  if (state.state === nextState) return;
  if (nextState === 'CLOSED') return;
  assertState(nextState, { workAssigned: true });
  const allowed = {
    BOOTING: ['ACTIVE', 'RECOVERING'],
    ACTIVE: ['ACTIVE', 'WAITING_EXTERNAL', 'RECOVERING', 'VERIFYING'],
    WAITING_EXTERNAL: ['WAITING_EXTERNAL', 'ACTIVE', 'RECOVERING', 'BLOCKED_EXTERNAL'],
    RECOVERING: ['RECOVERING', 'ACTIVE', 'VERIFYING'],
    VERIFYING: ['VERIFYING', 'ACTIVE', 'RECOVERING'],
    BLOCKED_EXTERNAL: ['BLOCKED_EXTERNAL', 'ACTIVE', 'RECOVERING', 'VERIFYING'],
  };
  if (!(allowed[state.state] ?? []).includes(nextState)) {
    throw new Error(`MISSION_CONTINUITY_TRANSITION_BLOCKED=${state.state}->${nextState}`);
  }
  state.state = nextState;
}

function save(missionId, root, state, type, payload = {}) {
  state.revision += 1;
  state.updatedAt = new Date().toISOString();
  assertMission(state);
  emit(missionId, root, state, type, payload);
  writeAtomic(statePath(missionId, root), state);
  return state;
}

export function createMission({ missionId, taskId, entrySha, sessionId = null, ownerAgent = 'MASTER_REPAIR', root } = {}) {
  assertLivenessDefinition();
  const id = safeId(missionId, 'mission_id');
  const existing = readJson(statePath(id, root));
  if (existing) return { created: false, state: assertMission(existing) };
  const entry = sha(entrySha, 'entry');
  const state = {
    protocol: MISSION_CONTINUITY_PROTOCOL.protocolId,
    schemaVersion: 1,
    missionId: id,
    taskId: safeId(taskId, 'task_id'),
    sessionId: sessionId ? safeId(sessionId, 'session_id') : null,
    ownerAgent: String(ownerAgent ?? 'MASTER_REPAIR'),
    branch: 'execution',
    entrySha: entry,
    currentSha: entry,
    state: 'BOOTING',
    open: true,
    terminal: false,
    attempt: 1,
    revision: 1,
    consecutiveNoProgress: 0,
    recoveryCount: 0,
    checkpoint: {
      step: 'BOOT',
      proven: true,
      digest: digest({ missionId: id, taskId, entrySha: entry, step: 'BOOT' }),
    },
    lastHeartbeatAt: null,
    lastProgressAt: null,
    lastRecoveryAt: null,
    lastFailureReason: null,
    lastWorkflowConclusion: null,
    completionEvidence: {
      exactShaVerified: false,
      requiredRedCount: null,
      regressionPassed: false,
      learningRecorded: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeAtomic(statePath(id, root), state);
  emit(id, root, state, 'MISSION_CREATED', { entrySha: entry });
  return { created: true, state };
}

export function loadMission({ missionId, root } = {}) {
  const id = safeId(missionId, 'mission_id');
  const state = readJson(statePath(id, root));
  if (!state) throw new Error(`MISSION_CONTINUITY_NOT_FOUND=${id}`);
  return assertMission(state);
}

export function heartbeat({ missionId, exactSha, progress = false, state = 'ACTIVE', root, at = new Date().toISOString() } = {}) {
  const current = loadMission({ missionId, root });
  const currentSha = sha(exactSha ?? current.currentSha, 'current');
  if (currentSha !== current.currentSha) throw new Error('MISSION_CONTINUITY_HEARTBEAT_EXACT_SHA_DRIFT');
  transition(current, state);
  current.lastHeartbeatAt = String(at);
  if (progress) {
    current.lastProgressAt = String(at);
    current.consecutiveNoProgress = 0;
    current.checkpoint = {
      step: `PROGRESS:${current.revision + 1}`,
      proven: true,
      digest: digest({ missionId: current.missionId, sha: currentSha, at, progress: true }),
    };
  }
  return save(missionId, root, current, 'HEARTBEAT', { progress: Boolean(progress) });
}

export function checkpoint({ missionId, exactSha, step, proven = true, progress = true, root } = {}) {
  const current = loadMission({ missionId, root });
  const currentSha = sha(exactSha ?? current.currentSha, 'current');
  if (currentSha !== current.currentSha) throw new Error('MISSION_CONTINUITY_CHECKPOINT_SHA_DRIFT');
  const checkpointStep = String(step ?? '').trim();
  if (!checkpointStep) throw new Error('MISSION_CONTINUITY_CHECKPOINT_STEP_REQUIRED');
  transition(current, 'ACTIVE');
  current.checkpoint = {
    step: checkpointStep,
    proven: proven === true,
    digest: digest({ missionId: current.missionId, taskId: current.taskId, sha: currentSha, checkpointStep, proven }),
  };
  current.lastHeartbeatAt = new Date().toISOString();
  if (progress) current.lastProgressAt = current.lastHeartbeatAt;
  current.consecutiveNoProgress = 0;
  return save(missionId, root, current, 'CHECKPOINT', { step: checkpointStep, proven: proven === true });
}

export function recover({ missionId, reason, exactSha, workflowConclusion = null, root } = {}) {
  const current = loadMission({ missionId, root });
  const currentSha = sha(exactSha ?? current.currentSha, 'current');
  if (currentSha !== current.currentSha) {
    current.lastFailureReason = 'EXACT_SHA_DRIFT';
    current.currentSha = currentSha;
  }
  const recoveryReason = String(reason ?? 'UNEXPECTED_EXIT');
  if (!MISSION_CONTINUITY_PROTOCOL.recoveryReasons.includes(recoveryReason)) {
    throw new Error(`MISSION_CONTINUITY_RECOVERY_REASON_INVALID=${recoveryReason}`);
  }
  current.recoveryCount += 1;
  current.attempt += 1;
  current.consecutiveNoProgress = 0;
  current.lastFailureReason = recoveryReason;
  current.lastWorkflowConclusion = workflowConclusion == null ? null : String(workflowConclusion);
  current.lastRecoveryAt = new Date().toISOString();
  current.checkpoint = {
    step: 'RECOVERY_REENTRY',
    proven: true,
    digest: digest({ missionId: current.missionId, sha: current.currentSha, recoveryReason, attempt: current.attempt }),
  };
  transition(current, 'RECOVERING');
  return save(missionId, root, current, 'RECOVERY_REQUIRED', { reason: recoveryReason, attempt: current.attempt });
}

export function continuityDecision({ missionId, exactSha, workflowConclusion = null, now = Date.now(), root } = {}) {
  const current = loadMission({ missionId, root });
  const currentSha = sha(exactSha ?? current.currentSha, 'current');
  if (currentSha !== current.currentSha) {
    return { action: 'RECOVER', reason: 'EXACT_SHA_DRIFT', missionId: current.missionId, exactSha: currentSha, state: current.state };
  }
  if (current.terminal === true && current.state === 'CLOSED') {
    return { action: 'RESIDENT', reason: 'CANONICAL_COMPLETION_PROVEN', missionId: current.missionId, exactSha: currentSha, state: 'CLOSED' };
  }
  const conclusion = String(workflowConclusion ?? '').toLowerCase();
  if (conclusion === 'failure') return { action: 'RECOVER', reason: 'WORKFLOW_FAILED', missionId: current.missionId, exactSha: currentSha, state: current.state };
  if (conclusion === 'timed_out') return { action: 'RECOVER', reason: 'WORKFLOW_TIMED_OUT', missionId: current.missionId, exactSha: currentSha, state: current.state };
  if (conclusion === 'cancelled') return { action: 'RECOVER', reason: 'WORKFLOW_CANCELLED', missionId: current.missionId, exactSha: currentSha, state: current.state };
  const heartbeatResult = checkHeartbeat({
    state: current.state,
    workAssigned: true,
    lastHeartbeatAt: current.lastHeartbeatAt,
    now,
  });
  if (!heartbeatResult.ok) {
    return { action: 'RECOVER', reason: heartbeatResult.reason, missionId: current.missionId, exactSha: currentSha, state: current.state };
  }
  const progressResult = checkProgress({
    state: current.state,
    workAssigned: true,
    lastProgressAt: current.lastProgressAt,
    now,
    consecutiveNoProgress: current.consecutiveNoProgress,
  });
  if (!progressResult.ok) {
    if (progressResult.action === 'STRATEGY_ROTATION_REQUIRED') {
      return {
        action: 'ROTATE_STRATEGY',
        reason: 'NO_PROGRESS',
        missionId: current.missionId,
        exactSha: currentSha,
        state: current.state,
        consecutiveNoProgress: progressResult.consecutiveNoProgress,
      };
    }
    return {
      action: 'RECOVER',
      reason: 'NO_PROGRESS',
      missionId: current.missionId,
      exactSha: currentSha,
      state: current.state,
      consecutiveNoProgress: progressResult.consecutiveNoProgress,
    };
  }
  return { action: 'CONTINUE', reason: 'LIVE_AND_PROGRESSING', missionId: current.missionId, exactSha: currentSha, state: current.state };
}

export function advanceSha({ missionId, nextSha, reason, root } = {}) {
  const current = loadMission({ missionId, root });
  const previousSha = current.currentSha;
  const targetSha = sha(nextSha, 'next');
  if (targetSha === previousSha) throw new Error('MISSION_CONTINUITY_SHA_ADVANCE_NOOP');
  const explanation = String(reason ?? '').trim();
  if (!explanation) throw new Error('MISSION_CONTINUITY_SHA_ADVANCE_REASON_REQUIRED');
  current.currentSha = targetSha;
  current.consecutiveNoProgress = 0;
  current.lastHeartbeatAt = new Date().toISOString();
  current.lastProgressAt = current.lastHeartbeatAt;
  current.checkpoint = {
    step: 'SHA_ADVANCED',
    proven: true,
    digest: digest({ previousSha, nextSha: targetSha, reason: explanation }),
  };
  transition(current, 'ACTIVE');
  return save(missionId, root, current, 'SHA_ADVANCED', { previousSha, nextSha: targetSha, reason: explanation });
}

export function complete({ missionId, exactSha, requiredRedCount, regressionPassed, learningRecorded, root } = {}) {
  const current = loadMission({ missionId, root });
  const currentSha = sha(exactSha ?? current.currentSha, 'current');
  if (currentSha !== current.currentSha) throw new Error('MISSION_CONTINUITY_COMPLETION_SHA_MISMATCH');
  transition(current, 'VERIFYING');
  completionGate({
    state: 'VERIFYING',
    workAssigned: true,
    exactShaVerified: true,
    requiredRedCount,
    regressionPassed,
    learningRecorded,
  });
  current.completionEvidence = {
    exactShaVerified: true,
    requiredRedCount: Number(requiredRedCount),
    regressionPassed: regressionPassed === true,
    learningRecorded: learningRecorded === true,
  };
  current.state = 'CLOSED';
  current.open = false;
  current.terminal = true;
  current.lastHeartbeatAt = new Date().toISOString();
  current.lastProgressAt = current.lastHeartbeatAt;
  current.checkpoint = {
    step: 'CLOSED',
    proven: true,
    digest: digest({ missionId: current.missionId, sha: currentSha, completion: current.completionEvidence }),
  };
  return save(missionId, root, current, 'MISSION_CLOSED', { residentState: MISSION_CONTINUITY_PROTOCOL.residentState });
}

export function validateMission({ missionId, root } = {}) {
  assertLivenessDefinition();
  const current = loadMission({ missionId, root });
  if (current.branch !== 'execution') throw new Error('MISSION_CONTINUITY_EXECUTION_BRANCH_REQUIRED');
  if (current.open !== (current.terminal !== true)) throw new Error('MISSION_CONTINUITY_OPEN_TERMINAL_INCONSISTENCY');
  if (current.state === 'CLOSED' && current.terminal !== true) throw new Error('MISSION_CONTINUITY_CLOSED_TERMINAL_REQUIRED');
  if (current.state !== 'CLOSED' && current.terminal === true) throw new Error('MISSION_CONTINUITY_OPEN_TERMINAL_FORBIDDEN');
  return true;
}

async function main() {
  const command = process.argv[2] ?? 'validate';
  const missionId = arg('mission');
  const root = arg('root', undefined);
  try {
    if (command === 'create') {
      console.log(JSON.stringify(createMission({ missionId, taskId: arg('task'), entrySha: arg('sha'), sessionId: arg('session'), ownerAgent: arg('agent', 'MASTER_REPAIR'), root }), null, 2));
    } else if (command === 'show') {
      console.log(JSON.stringify(loadMission({ missionId, root }), null, 2));
    } else if (command === 'heartbeat') {
      console.log(JSON.stringify(heartbeat({ missionId, exactSha: arg('sha'), progress: arg('progress', 'false') === 'true', state: arg('state', 'ACTIVE'), root }), null, 2));
    } else if (command === 'checkpoint') {
      console.log(JSON.stringify(checkpoint({ missionId, exactSha: arg('sha'), step: arg('step'), proven: arg('proven', 'true') === 'true', progress: arg('progress', 'true') === 'true', root }), null, 2));
    } else if (command === 'recover') {
      console.log(JSON.stringify(recover({ missionId, exactSha: arg('sha'), reason: arg('reason'), workflowConclusion: arg('workflow'), root }), null, 2));
    } else if (command === 'decide') {
      console.log(JSON.stringify(continuityDecision({ missionId, exactSha: arg('sha'), workflowConclusion: arg('workflow'), root }), null, 2));
    } else if (command === 'advance-sha') {
      console.log(JSON.stringify(advanceSha({ missionId, nextSha: arg('sha'), reason: arg('reason'), root }), null, 2));
    } else if (command === 'complete') {
      console.log(JSON.stringify(complete({
        missionId,
        exactSha: arg('sha'),
        requiredRedCount: Number(arg('reds', '-1')),
        regressionPassed: arg('regression', 'false') === 'true',
        learningRecorded: arg('learning', 'false') === 'true',
        root,
      }), null, 2));
    } else if (command === 'validate') {
      if (missionId) validateMission({ missionId, root }); else assertLivenessDefinition();
      console.log(JSON.stringify({
        status: 'PASS',
        protocol: MISSION_CONTINUITY_PROTOCOL.protocolId,
        branch: MISSION_CONTINUITY_PROTOCOL.branch,
        terminalState: MISSION_CONTINUITY_PROTOCOL.terminalState,
        residentState: MISSION_CONTINUITY_PROTOCOL.residentState,
        forbiddenStates: MISSION_CONTINUITY_PROTOCOL.forbiddenStates,
        livenessVersion: AGENT_LIVENESS_PROTOCOL.protocolVersion,
      }, null, 2));
    } else {
      throw new Error('Usage: mission-continuity-engine.mjs create|show|heartbeat|checkpoint|recover|decide|advance-sha|complete|validate');
    }
  } catch (error) {
    console.error(`MISSION_CONTINUITY_FAIL_CLOSED=${String(error?.stack ?? error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) await main();
