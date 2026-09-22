#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const CELL_LAB_PROTOCOL_ID = 'CELL-LAB-COLLABORATIVE-CONSENSUS';
export const CELL_LAB_PROTOCOL_VERSION = '1.0.0';
export const CELL_LAB_ROOT = 'diagnostics/agents/cell-lab';
export const CELL_LAB_CONSENSUS_DIR = path.join(CELL_LAB_ROOT, 'consensus');
export const REQUIRED_CORE_PARTICIPANTS = Object.freeze(['MASTER-1','MASTER-2','MASTER-3']);

const ROOT = process.cwd();
const abs = (p) => path.resolve(ROOT, p);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const shaOk = (value) => /^[0-9a-f]{40}$/u.test(String(value ?? ''));
const nonEmpty = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('CELL_LAB_REQUIRED_' + name.toUpperCase());
  return value.trim();
};
const arr = (value, name) => {
  if (!Array.isArray(value) || value.length === 0) throw new Error('CELL_LAB_' + name.toUpperCase() + '_REQUIRED');
  return value;
};

export function consensusPath(taskId) {
  const safe = String(taskId ?? '').trim().replace(/[^A-Za-z0-9._-]/gu, '_');
  if (!safe) throw new Error('CELL_LAB_TASK_ID_REQUIRED');
  return path.join(CELL_LAB_CONSENSUS_DIR, safe + '.json');
}

export function validateCellLabConsensus(packet, { taskId, exactSha, mutationOwner = null } = {}) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) throw new Error('CELL_LAB_PACKET_INVALID');
  if (packet.protocolId !== CELL_LAB_PROTOCOL_ID || packet.protocolVersion !== CELL_LAB_PROTOCOL_VERSION) throw new Error('CELL_LAB_PROTOCOL_INVALID');
  if (!packet.labId || !String(packet.labId).startsWith('CELL-LAB-')) throw new Error('CELL_LAB_ID_INVALID');
  if (packet.taskId !== taskId) throw new Error('CELL_LAB_TASK_MISMATCH');
  if (!shaOk(packet.exactSha) || packet.exactSha !== exactSha) throw new Error('CELL_LAB_EXACT_SHA_MISMATCH');
  nonEmpty(packet.objective, 'objective');
  nonEmpty(packet.integratedPlan, 'integrated_plan');
  nonEmpty(packet.planHash, 'plan_hash');
  const expectedPlanHash = crypto.createHash('sha256').update(packet.integratedPlan, 'utf8').digest('hex');
  if (packet.planHash !== expectedPlanHash) throw new Error('CELL_LAB_PLAN_HASH_MISMATCH');
  if (packet.status !== 'AGREED') throw new Error('CELL_LAB_CONSENSUS_NOT_AGREED');
  if (packet.executionReady !== true) throw new Error('CELL_LAB_EXECUTION_NOT_READY');
  if (packet.discussionClosed !== true) throw new Error('CELL_LAB_DISCUSSION_NOT_CLOSED');

  const participants = arr(packet.participants, 'participants');
  for (const required of REQUIRED_CORE_PARTICIPANTS) {
    if (!participants.some((item) => item?.id === required)) throw new Error('CELL_LAB_CORE_PARTICIPANT_MISSING=' + required);
  }
  if (mutationOwner && !participants.some((item) => item?.id === mutationOwner || item?.agentId === mutationOwner)) {
    throw new Error('CELL_LAB_MUTATION_OWNER_MISSING');
  }

  const discussions = arr(packet.discussions, 'discussions');
  const validKinds = new Set(['OPINION','QUESTION','CHALLENGE','DECISION']);
  for (const item of discussions) {
    if (!item || !validKinds.has(item.kind)) throw new Error('CELL_LAB_DISCUSSION_ITEM_INVALID');
    nonEmpty(String(item.actor ?? ''), 'discussion_actor');
    nonEmpty(String(item.text ?? ''), 'discussion_text');
    arr(item.responses ?? [], 'responses');
    nonEmpty(String(item.resolution ?? ''), 'resolution');
  }

  for (const participant of participants) {
    if (!participant?.id) throw new Error('CELL_LAB_PARTICIPANT_ID_INVALID');
    if (!['AGREED','DISSENT_RESOLVED'].includes(participant.status)) throw new Error('CELL_LAB_PARTICIPANT_STATUS_INVALID=' + participant.id);
    nonEmpty(String(participant.basis ?? ''), 'participant_basis');
  }

  const questions = discussions.filter((item) => item.kind === 'QUESTION');
  if (questions.some((item) => item.status !== 'ANSWERED' && item.status !== 'ACCEPTED_AS_RISK')) throw new Error('CELL_LAB_UNRESOLVED_QUESTION');
  if (!Array.isArray(packet.dissentResolved)) throw new Error('CELL_LAB_DISSENT_REGISTER_REQUIRED');
  for (const dissent of packet.dissentResolved) {
    if (!dissent?.participant || !dissent?.resolution) throw new Error('CELL_LAB_DISSENT_UNRESOLVED');
  }

  const decisions = discussions.filter((item) => item.kind === 'DECISION');
  if (!decisions.length) throw new Error('CELL_LAB_FINAL_DECISION_REQUIRED');
  if (decisions.some((item) => item.status !== 'AGREED')) throw new Error('CELL_LAB_DECISION_NOT_AGREED');

  if (packet.remainingQuestions?.length) throw new Error('CELL_LAB_REMAINING_QUESTIONS');
  if (packet.unresolvedConflicts?.length) throw new Error('CELL_LAB_UNRESOLVED_CONFLICTS');
  if (!Array.isArray(packet.proofObligations) || packet.proofObligations.length === 0) throw new Error('CELL_LAB_PROOF_OBLIGATIONS_REQUIRED');
  if (!Array.isArray(packet.stopConditions) || packet.stopConditions.length === 0) throw new Error('CELL_LAB_STOP_CONDITIONS_REQUIRED');
  return Object.freeze({
    protocolId: CELL_LAB_PROTOCOL_ID,
    protocolVersion: CELL_LAB_PROTOCOL_VERSION,
    labId: packet.labId,
    taskId: packet.taskId,
    exactSha: packet.exactSha,
    status: packet.status,
    executionReady: true,
    participantCount: participants.length,
    discussionCount: discussions.length,
    planHash: packet.planHash,
  });
}

export function loadAndValidateCellLabConsensus({ file, taskId, exactSha, mutationOwner = null } = {}) {
  const resolved = abs(file || consensusPath(taskId));
  if (!fs.existsSync(resolved)) throw new Error('CELL_LAB_CONSENSUS_FILE_MISSING=' + path.relative(ROOT, resolved));
  return validateCellLabConsensus(readJson(resolved), { taskId, exactSha, mutationOwner });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = String(process.argv[2] ?? '').trim().toLowerCase();
  const getArg = (name) => {
    const prefix = '--' + name + '=';
    const item = process.argv.find((value) => value.startsWith(prefix));
    return item ? item.slice(prefix.length) : '';
  };
  if (command !== 'validate') throw new Error('Usage: cell-lab-consensus.mjs validate --task=<id> --sha=<exactSha> [--file=<path>] [--owner=<agent>]');
  const result = loadAndValidateCellLabConsensus({
    file: getArg('file') || undefined,
    taskId: getArg('task'),
    exactSha: getArg('sha'),
    mutationOwner: getArg('owner') || null,
  });
  console.log(JSON.stringify({ status: 'PASS', ...result }, null, 2));
}
