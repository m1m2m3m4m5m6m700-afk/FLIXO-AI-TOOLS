#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { AGENT_LIVENESS_PROTOCOL } from './agent-liveness-protocol.mjs';

const RESIDENT_IDS = new Set(AGENT_LIVENESS_PROTOCOL.residentRuntimeIds);

const readArg = (name, fallback = null) =>
  process.argv.find((value) => value.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const writeJson = (file, value) => {
  fs.mkdirSync(file.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};

const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');

const BATON_PROTOCOL = 'FLIXO-RESIDENT-WAKE-BATON-v1';
const ACK_PROTOCOL = 'FLIXO-RESIDENT-READY-ACK-v1';
const PROOF_PROTOCOL = 'FLIXO-RESIDENT-HANDOFF-PROOF-v1';

const assertSha = (value, error) => {
  if (!/^[a-f0-9]{40}$/iu.test(String(value ?? ''))) throw new Error(error);
};

const assertBaton = (baton) => {
  if (!baton || baton.protocol !== BATON_PROTOCOL || baton.action !== 'WAKE_NEXT_RESIDENT_BOT') throw new Error('RESIDENT_PROOF_BATON_INVALID');
  assertSha(baton.targetSha, 'RESIDENT_PROOF_BATON_EXACT_SHA_REQUIRED');
  if (!RESIDENT_IDS.has(String(baton.actor)) || !RESIDENT_IDS.has(String(baton.nextActor))) throw new Error('RESIDENT_PROOF_BATON_ACTORS_INVALID');
  if (String(baton.actor) === String(baton.nextActor)) throw new Error('RESIDENT_PROOF_BATON_SELF_HANDOFF');
  if (baton.nextMustAckBeforeRelease !== true) throw new Error('RESIDENT_PROOF_BATON_ACK_REQUIRED');
  if (Number(baton.minimumResidentFloor) !== 1) throw new Error('RESIDENT_PROOF_RESIDENT_FLOOR_INVALID');
  const issuedAt = Date.parse(String(baton.issuedAt ?? ''));
  const expiresAt = Date.parse(String(baton.expiresAt ?? ''));
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) throw new Error('RESIDENT_PROOF_BATON_TIME_INVALID');
  return { issuedAt, expiresAt };
};

export function buildResidentReadyAck({ baton, responder, now = new Date().toISOString() } = {}) {
  const { issuedAt, expiresAt } = assertBaton(baton);
  const responderId = String(responder ?? baton?.nextActor ?? '').trim();
  if (responderId !== String(baton.nextActor)) throw new Error('RESIDENT_PROOF_RESPONDER_MUST_BE_NEXT_ACTOR');
  if (!RESIDENT_IDS.has(responderId)) throw new Error('RESIDENT_PROOF_RESPONDER_INVALID');
  const observedAt = Date.parse(String(now));
  if (!Number.isFinite(observedAt)) throw new Error('RESIDENT_PROOF_ACK_TIME_INVALID');
  if (observedAt < issuedAt || observedAt > expiresAt) throw new Error('RESIDENT_PROOF_ACK_OUTSIDE_BATON_TTL');
  const batonFingerprint = sha256(JSON.stringify({
    protocol: baton.protocol,
    action: baton.action,
    actor: baton.actor,
    nextActor: baton.nextActor,
    targetSha: baton.targetSha,
    taskId: baton.taskId ?? null,
    issuedAt: baton.issuedAt,
    expiresAt: baton.expiresAt,
  }));
  return Object.freeze({
    schemaVersion: 1,
    protocol: ACK_PROTOCOL,
    action: 'RESIDENT_NEXT_READY',
    responseTo: baton.protocol,
    batonFingerprint,
    actor: String(baton.actor),
    responder: responderId,
    targetSha: String(baton.targetSha),
    taskId: baton.taskId ?? null,
    ready: true,
    readyState: 'READY_RESIDENT',
    attendanceStatus: 'READY_RESIDENT_PENDING_LIVE_HEARTBEAT',
    liveHeartbeatAck: false,
    mutationAuthority: false,
    pushAuthority: baton.pushAuthority ?? 'CHAIR_1_ONLY',
    issuedAt: baton.issuedAt,
    ackAt: new Date(observedAt).toISOString(),
    expiresAt: baton.expiresAt,
    independentObservationRequired: true,
  });
}

export function verifyResidentHandoffProof({ baton, ack, observer = 'FLIXO_EXECUTION_WATCHDOG', now = Date.now() } = {}) {
  const { issuedAt, expiresAt } = assertBaton(baton);
  if (!ack || ack.protocol !== ACK_PROTOCOL || ack.action !== 'RESIDENT_NEXT_READY') throw new Error('RESIDENT_PROOF_ACK_INVALID');
  if (ack.responseTo !== BATON_PROTOCOL) throw new Error('RESIDENT_PROOF_ACK_PROTOCOL_MISMATCH');
  if (ack.actor !== baton.actor || ack.responder !== baton.nextActor) throw new Error('RESIDENT_PROOF_ACK_ACTOR_MISMATCH');
  if (ack.targetSha !== baton.targetSha) throw new Error('RESIDENT_PROOF_ACK_SHA_MISMATCH');
  if (ack.ready !== true || ack.readyState !== 'READY_RESIDENT') throw new Error('RESIDENT_PROOF_ACK_NOT_READY');
  if (ack.liveHeartbeatAck === true) throw new Error('RESIDENT_PROOF_READY_ACK_CANNOT_CLAIM_LIVE_HEARTBEAT');
  if (ack.independentObservationRequired !== true) throw new Error('RESIDENT_PROOF_INDEPENDENT_OBSERVER_REQUIRED');
  if (String(observer) === String(baton.actor) || String(observer) === String(baton.nextActor)) throw new Error('RESIDENT_PROOF_OBSERVER_NOT_INDEPENDENT');
  const ackAt = Date.parse(String(ack.ackAt ?? ''));
  const nowMs = typeof now === 'string' ? Date.parse(now) : Number(now);
  if (!Number.isFinite(ackAt) || !Number.isFinite(nowMs)) throw new Error('RESIDENT_PROOF_OBSERVATION_TIME_INVALID');
  if (ackAt < issuedAt || ackAt > expiresAt) throw new Error('RESIDENT_PROOF_ACK_EXPIRED');
  if (nowMs < issuedAt || nowMs > expiresAt) throw new Error('RESIDENT_PROOF_BATON_EXPIRED');
  const expectedFingerprint = sha256(JSON.stringify({
    protocol: baton.protocol,
    action: baton.action,
    actor: baton.actor,
    nextActor: baton.nextActor,
    targetSha: baton.targetSha,
    taskId: baton.taskId ?? null,
    issuedAt: baton.issuedAt,
    expiresAt: baton.expiresAt,
  }));
  if (ack.batonFingerprint !== expectedFingerprint) throw new Error('RESIDENT_PROOF_BATON_FINGERPRINT_MISMATCH');
  return Object.freeze({
    schemaVersion: 1,
    protocol: PROOF_PROTOCOL,
    status: 'PASS',
    observer: String(observer),
    independentObserver: true,
    batonValid: true,
    ackValid: true,
    targetSha: String(baton.targetSha),
    actor: String(baton.actor),
    nextActor: String(baton.nextActor),
    readyBeforeRelease: true,
    releaseAllowed: true,
    liveHeartbeatStillRequired: true,
    minimumResidentFloor: 1,
    verifiedAt: new Date(nowMs).toISOString(),
  });
}

const isMain = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;

if (isMain) {
  try {
    const command = process.argv[2] ?? 'help';
    if (command === 'issue') {
      const baton = readJson(readArg('baton'));
      const wake = readJson(readArg('wake'));
      if (wake.targetSha !== baton.targetSha) throw new Error('RESIDENT_PROOF_WAKE_SHA_MISMATCH');
      const readyRuntimeSeats = new Set([...(Array.isArray(wake.stagedRuntimeIds) ? wake.stagedRuntimeIds : []), ...(Array.isArray(wake.nextRuntimeIds) ? wake.nextRuntimeIds : [])].map(String));
      if (!readyRuntimeSeats.has(String(baton.nextActor))) throw new Error('RESIDENT_PROOF_NEXT_ACTOR_NOT_READY_IN_WAKE_REPORT');
      const ack = buildResidentReadyAck({
        baton,
        responder: readArg('responder', baton.nextActor),
        now: readArg('now') ?? new Date().toISOString(),
      });
      writeJson(readArg('output'), ack);
      console.log(JSON.stringify({ status: 'PASS', ack }, null, 2));
    } else if (command === 'verify') {
      const baton = readJson(readArg('baton'));
      const ack = readJson(readArg('ack'));
      const proof = verifyResidentHandoffProof({
        baton,
        ack,
        observer: readArg('observer', 'FLIXO_EXECUTION_WATCHDOG'),
        now: readArg('now') ?? Date.now(),
      });
      const output = readArg('output');
      if (output) writeJson(output, proof);
      console.log(JSON.stringify(proof, null, 2));
    } else {
      throw new Error('Usage: resident-wake-proof.mjs issue|verify --baton=... --ack=...');
    }
  } catch (error) {
    console.error('RESIDENT_WAKE_PROOF_BLOCK=' + String(error?.message ?? error));
    process.exitCode = 1;
  }
}
