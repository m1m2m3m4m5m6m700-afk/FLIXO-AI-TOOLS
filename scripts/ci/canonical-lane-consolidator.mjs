#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const CANONICAL_LANE = 'execution';
export const CONSOLIDATION_PROTOCOL = 'FLIXO-CANONICAL-LANE-CONSOLIDATION-v1';

const SHA_RE = /^[0-9a-f]{40}$/iu;
const HASH_RE = /^[0-9a-f]{64}$/iu;

const digest = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeFiles(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(clean).filter(Boolean))].sort();
}

function normalizeCommit(commit) {
  const c = commit && typeof commit === 'object' ? commit : {};
  const sha = clean(c.sha);
  if (!SHA_RE.test(sha)) throw new Error('CANONICAL_LANE_COMMIT_SHA_INVALID');
  const parents = Array.isArray(c.parents) ? c.parents.map(clean).filter(Boolean) : [];
  if (parents.some((parent) => !SHA_RE.test(parent))) throw new Error('CANONICAL_LANE_COMMIT_PARENT_INVALID');
  return Object.freeze({
    sha,
    parents: [...new Set(parents)],
    changedFiles: normalizeFiles(c.changedFiles),
    patchSha256: c.patchSha256 == null ? null : clean(c.patchSha256),
    message: clean(c.message),
  });
}

export function normalizePushPacket(packet, index = 0) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    throw new Error('CANONICAL_LANE_PACKET_INVALID');
  }
  const agentId = clean(packet.agentId ?? packet.agent ?? `AGENT-${index + 1}`);
  const sourceSha = clean(packet.sourceSha ?? packet.headSha);
  const baseSha = clean(packet.baseSha ?? packet.parentSha ?? packet.entrySha);
  if (!agentId) throw new Error('CANONICAL_LANE_AGENT_REQUIRED');
  if (!SHA_RE.test(sourceSha)) throw new Error('CANONICAL_LANE_SOURCE_SHA_INVALID');
  if (!SHA_RE.test(baseSha)) throw new Error('CANONICAL_LANE_BASE_SHA_INVALID');

  const commits = Array.isArray(packet.commits) && packet.commits.length
    ? packet.commits.map(normalizeCommit)
    : [Object.freeze({
      sha: sourceSha,
      parents: [baseSha],
      changedFiles: normalizeFiles(packet.changedFiles),
      patchSha256: packet.patchSha256 == null ? null : clean(packet.patchSha256),
      message: clean(packet.message),
    })];

  const changedFiles = normalizeFiles([
    ...(Array.isArray(packet.changedFiles) ? packet.changedFiles : []),
    ...commits.flatMap((commit) => commit.changedFiles),
  ]);

  const packetPatchDigest = clean(packet.patchDigest ?? packet.patchSha256);
  if (packetPatchDigest && !HASH_RE.test(packetPatchDigest)) throw new Error('CANONICAL_LANE_PACKET_PATCH_DIGEST_INVALID');

  return Object.freeze({
    packetId: clean(packet.packetId) || `push:${agentId}:${sourceSha.slice(0, 12)}`,
    agentId,
    sourceSha,
    baseSha,
    branch: clean(packet.branch) || 'agent-supplied',
    createdAt: clean(packet.createdAt) || null,
    changedFiles,
    commits,
    patchDigest: packetPatchDigest || digest(JSON.stringify({ agentId, sourceSha, baseSha, changedFiles, commits })),
    declaredStatus: clean(packet.status) || 'PUSH_RECEIVED',
    metadata: packet.metadata && typeof packet.metadata === 'object' ? { ...packet.metadata } : {},
  });
}

function ancestryRelation(a, b) {
  if (a.sourceSha === b.baseSha) return 'A_BEFORE_B';
  if (b.sourceSha === a.baseSha) return 'B_BEFORE_A';
  const aParents = new Set(a.commits.flatMap((commit) => commit.parents));
  const bParents = new Set(b.commits.flatMap((commit) => commit.parents));
  if (aParents.has(b.sourceSha)) return 'B_BEFORE_A';
  if (bParents.has(a.sourceSha)) return 'A_BEFORE_B';
  return 'UNRESOLVED';
}

function duplicateRelation(a, b) {
  if (a.sourceSha === b.sourceSha) return true;
  const aCommits = new Set(a.commits.map((commit) => commit.sha));
  return b.commits.some((commit) => aCommits.has(commit.sha));
}

function overlap(a, b) {
  const aFiles = new Set(a.changedFiles);
  return b.changedFiles.filter((file) => aFiles.has(file));
}

function conflictReason(a, b, overlappingFiles) {
  if (duplicateRelation(a, b)) return 'DUPLICATE_COMMIT_OR_PUSH';
  if (overlappingFiles.length) return 'OVERLAPPING_FILE_SCOPE_REQUIRES_EXPLICIT_RECONCILIATION';
  if (a.baseSha === b.baseSha) return null;
  const relation = ancestryRelation(a, b);
  if (relation === 'UNRESOLVED') return 'UNRESOLVED_BRANCH_DIVERGENCE';
  return null;
}

function comparePackets(a, b) {
  const relation = ancestryRelation(a, b);
  if (relation === 'A_BEFORE_B') return -1;
  if (relation === 'B_BEFORE_A') return 1;
  const timeA = a.createdAt ? Date.parse(a.createdAt) : Number.POSITIVE_INFINITY;
  const timeB = b.createdAt ? Date.parse(b.createdAt) : Number.POSITIVE_INFINITY;
  if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) return timeA - timeB;
  return a.packetId.localeCompare(b.packetId);
}

export function buildCanonicalLaneConsolidation({
  currentHead,
  targetBranch = CANONICAL_LANE,
  packets = [],
  expectedParent = currentHead,
} = {}) {
  const head = clean(currentHead);
  if (!SHA_RE.test(head)) throw new Error('CANONICAL_LANE_CURRENT_HEAD_INVALID');
  if (targetBranch !== CANONICAL_LANE) throw new Error('CANONICAL_LANE_TARGET_BRANCH_INVALID');
  if (!SHA_RE.test(clean(expectedParent))) throw new Error('CANONICAL_LANE_EXPECTED_PARENT_INVALID');

  const normalized = packets.map((packet, index) => normalizePushPacket(packet, index));
  const deduped = [];
  const duplicatePacketIds = [];
  for (const packet of normalized) {
    const duplicate = deduped.find((candidate) => duplicateRelation(candidate, packet));
    if (duplicate) duplicatePacketIds.push(packet.packetId);
    else deduped.push(packet);
  }

  const conflicts = [];
  for (let i = 0; i < deduped.length; i += 1) {
    for (let j = i + 1; j < deduped.length; j += 1) {
      const a = deduped[i];
      const b = deduped[j];
      const files = overlap(a, b);
      const reason = conflictReason(a, b, files);
      if (reason) {
        conflicts.push({
          type: reason,
          packetIds: [a.packetId, b.packetId],
          agents: [a.agentId, b.agentId],
          changedFiles: files,
          relation: ancestryRelation(a, b),
        });
      }
    }
  }

  const orderedPackets = [...deduped].sort(comparePackets);
  const sourceHeadSet = new Set(orderedPackets.map((packet) => packet.sourceSha));
  const stalePackets = orderedPackets
    .filter((packet) => packet.sourceSha === head || packet.baseSha === head ? false : !sourceHeadSet.has(packet.baseSha))
    .filter((packet) => packet.baseSha !== head);

  const status = conflicts.length
    ? 'BLOCKED_CONFLICT'
    : stalePackets.length
      ? 'BLOCKED_STALE_OR_UNJOINED_PACKET'
      : 'READY_FOR_CANONICAL_CONSOLIDATION';

  const requiredEvidence = [
    'CURRENT_EXECUTION_HEAD',
    'AGENT_PACKET_IDENTITY',
    'COMMIT_IDENTITY',
    'DUPLICATE_DEDUPLICATION',
    'FILE_SCOPE_OVERLAP_ANALYSIS',
    'ANCESTRY_AND_ORDER_ANALYSIS',
    'CONFLICT_ANALYSIS',
    'SINGLE_LANE_BINDING',
    'EXACT_SHA_REVALIDATION_AFTER_CONSOLIDATION',
    'CANONICAL_CI_AFTER_NEW_HEAD',
  ];

  return Object.freeze({
    protocol: CONSOLIDATION_PROTOCOL,
    schemaVersion: 1,
    status,
    canonicalLane: CANONICAL_LANE,
    targetBranch: targetBranch,
    currentHead: head,
    expectedParent: clean(expectedParent),
    packetCountReceived: normalized.length,
    packetCountUnique: deduped.length,
    duplicatePacketIds,
    orderedPackets: orderedPackets.map((packet) => ({
      packetId: packet.packetId,
      agentId: packet.agentId,
      sourceSha: packet.sourceSha,
      baseSha: packet.baseSha,
      changedFiles: packet.changedFiles,
      commitCount: packet.commits.length,
      patchDigest: packet.patchDigest,
    })),
    conflicts,
    stalePackets: stalePackets.map((packet) => ({
      packetId: packet.packetId,
      agentId: packet.agentId,
      sourceSha: packet.sourceSha,
      baseSha: packet.baseSha,
    })),
    integrationDecision: status === 'READY_FOR_CANONICAL_CONSOLIDATION'
      ? {
        mode: orderedPackets.length ? 'SEQUENTIAL_CANONICAL_LANE_APPLICATION' : 'NO_PENDING_PUSHES',
        preservesUniquePackets: true,
        rejectsConflictingPackets: true,
        targetParent: head,
        nextStep: orderedPackets.length ? 'APPLY_ONLY_AFTER_EXACT_HEAD_REVALIDATION' : 'WAIT_FOR_PUSH_PACKET',
      }
      : {
        mode: 'FAIL_CLOSED_REVIEW',
        preservesUniquePackets: true,
        rejectsConflictingPackets: true,
        targetParent: head,
        nextStep: 'ARBITRATE_CONFLICTS_OR_REPAIR_PACKET_PROVENANCE',
      },
    requiredEvidence,
    consolidationDigest: digest(JSON.stringify({
      status,
      head,
      orderedPackets,
      duplicatePacketIds,
      conflicts,
      stalePackets,
    })),
  });
}

export function assertCanonicalLaneConsolidation(plan, currentHead) {
  if (!plan || plan.protocol !== CONSOLIDATION_PROTOCOL) throw new Error('CANONICAL_LANE_PLAN_INVALID');
  if (plan.canonicalLane !== CANONICAL_LANE || plan.targetBranch !== CANONICAL_LANE) throw new Error('CANONICAL_LANE_PLAN_BRANCH_INVALID');
  if (plan.currentHead !== clean(currentHead)) throw new Error('CANONICAL_LANE_PLAN_STALE_HEAD');
  if (plan.status !== 'READY_FOR_CANONICAL_CONSOLIDATION') throw new Error('CANONICAL_LANE_PLAN_NOT_READY');
  if (plan.conflicts.length || plan.stalePackets.length) throw new Error('CANONICAL_LANE_PLAN_CONFLICT_OR_STALE');
  return true;
}

function readJsonFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs.readdirSync(rootDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      try {
        const file = path.join(rootDir, name);
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function isAncestor(sourceSha, currentHead, root = process.cwd()) {
  if (!SHA_RE.test(String(sourceSha)) || !SHA_RE.test(String(currentHead))) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sourceSha, currentHead], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export function collectAccumulatedPushPackets({
  currentHead,
  root = process.cwd(),
  envValue = process.env.FLIXO_ACCUMULATED_PUSH_PACKETS ?? '',
} = {}) {
  const candidates = [
    ...parseAccumulatedPushPackets(envValue),
    ...readJsonFiles(path.resolve(root, 'diagnostics/guard/inbox'))
      .filter((report) => report.status === 'PUSH_PENDING' && report.pendingPush === true)
      .filter((report) => report.candidateSha || report.currentWorkspaceSha)
      .map((report) => ({
        packetId: report.reportId,
        agentId: report.agentId,
        sourceSha: report.candidateSha ?? report.currentWorkspaceSha,
        baseSha: report.executionShaAtEntry,
        changedFiles: report.changedFiles,
        patchSha256: report.patchSha256,
        createdAt: report.pendingPushAt ?? report.createdAt,
        branch: 'agent-guard-pending',
        metadata: { source: 'GUARD_CHANGE_REPORT', guardStatus: report.status },
      })),
    ...readJsonFiles(path.resolve(root, 'diagnostics/agents/handoffs'))
      .filter((handoff) => handoff.status === 'VERIFIED')
      .filter((handoff) => handoff.exitSha && handoff.entrySha && Array.isArray(handoff.changedFiles) && handoff.changedFiles.length > 0)
      .map((handoff) => ({
        packetId: handoff.reportId ?? `handoff:${handoff.sessionId}`,
        agentId: handoff.agentId,
        sourceSha: handoff.exitSha,
        baseSha: handoff.entrySha,
        changedFiles: handoff.changedFiles,
        createdAt: handoff.finishedAt ?? handoff.startedAt,
        branch: 'agent-handoff',
        metadata: { source: 'AGENT_HANDOFF', sessionId: handoff.sessionId },
      })),
  ];

  const alreadyIntegrated = [];
  const pending = [];
  const seen = new Set();
  for (const packet of candidates) {
    const sourceSha = clean(packet?.sourceSha ?? packet?.headSha);
    const packetId = clean(packet?.packetId) || `push:${sourceSha}`;
    if (!sourceSha || !SHA_RE.test(sourceSha)) continue;
    if (isAncestor(sourceSha, currentHead, root) || sourceSha === currentHead) {
      alreadyIntegrated.push(packetId);
      continue;
    }
    const key = `${packetId}:${sourceSha}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pending.push(packet);
  }
  return Object.freeze({
    packets: pending,
    alreadyIntegrated: [...new Set(alreadyIntegrated)],
    candidateCount: candidates.length,
  });
}

export function parseAccumulatedPushPackets(value) {
  if (value == null || value === '') return [];
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error('CANONICAL_LANE_PUSH_PACKETS_MUST_BE_ARRAY');
  return parsed;
}
