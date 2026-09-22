#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertAgentAdmission, assertProtocolDefinition } from './repair-protocol.mjs';
import { ingest as ingestAgentMessage, markRead as readAgentMessage, markConsumed as consumeAgentMessage } from './agent-communication.mjs';
import { loadPromptRegistry, validatePromptRegistry, loadErrorMemory } from './prompt-registry.mjs';
import { assertAgentExitGate } from './agent-exit-lock.mjs';
import { AGENT_LIVENESS_PROTOCOL, assertActiveRepairWindow, checkHeartbeat, checkContinuousSessionWindow } from './agent-liveness-protocol.mjs';
import { initialize as initializeChairState, heartbeat as heartbeatChair, reconcileDeadLeases, beginWork as beginChairWork, endWork as endChairWork, assertWorkAdmission, activeChairForAgent } from './chair-bound-execution.mjs';
import { createAgentWorkspace, captureAgentResult, assertWorkspaceIsolation, cleanupAgentWorkspace } from './agent-isolated-workspace.mjs';

const ROOT = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith('--')) continue;
  const eq = token.indexOf('=');
  const key = token.slice(2, eq >= 0 ? eq : undefined);
  const value = eq >= 0 ? token.slice(eq + 1) : process.argv[i + 1];
  args.set(key, value ?? null);
}

const command = String(process.argv[2] ?? '').toLowerCase();
const rawSessionId = String(args.get('session') ?? process.env.FLIXO_AGENT_SESSION ?? '').trim();
const rawFromSession = String(args.get('from-session') ?? process.env.FLIXO_AGENT_FROM_SESSION ?? '').trim() || null;
const rawMessageFile = String(args.get('message-file') ?? process.env.FLIXO_AGENT_MESSAGE_FILE ?? '').trim() || null;
const rawMessageId = String(args.get('message-id') ?? process.env.FLIXO_AGENT_MESSAGE_ID ?? '').trim() || null;
const meetingId = String(args.get('meeting-id') ?? process.env.FLIXO_AGENT_MEETING_ID ?? '').trim() || null;
const meetingRequested = String(args.get('meeting') ?? process.env.FLIXO_AGENT_MEETING ?? 'false').trim() === 'true' || Boolean(meetingId);
const messageExecutionAdmitted = String(args.get('message-execution-admitted') ?? process.env.FLIXO_AGENT_MESSAGE_EXECUTION_ADMITTED ?? 'false').trim() === 'true';
const safeSessionId = (value, label) => {
  if (!value || value.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error(`INVALID_${label.toUpperCase()}_ID`);
  return value;
};
const sessionId = safeSessionId(rawSessionId, 'session');
const agentId = String(args.get('agent') ?? process.env.FLIXO_AGENT_ID ?? '').trim();
const role = String(args.get('role') ?? process.env.FLIXO_AGENT_ROLE ?? 'implementation').trim();
const gitBranch = () => execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
const protocolAdmission = assertAgentAdmission({ actor: role, branch: gitBranch(), mutation: false });
const rca = String(args.get('rca') ?? process.env.FLIXO_AGENT_RCA ?? '').trim() || null;
const scope = String(args.get('scope') ?? process.env.FLIXO_AGENT_SCOPE ?? '').split(',').map((v) => v.trim()).filter(Boolean);
const fromSession = rawFromSession ? safeSessionId(rawFromSession, 'previous_session') : null;
const taskId = String(args.get('task') ?? process.env.FLIXO_AGENT_TASK ?? '').trim();
const sessionDir = path.resolve(ROOT, 'diagnostics/agents/sessions');
const visibilityDir = path.resolve(ROOT, 'docs/agents/ledger');
const handoffDir = path.resolve(ROOT, 'diagnostics/agents/handoffs');
const now = () => new Date().toISOString();
const gitSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const gitMainSha = () => execFileSync('git', ['rev-parse', 'main'], { cwd: ROOT, encoding: 'utf8' }).trim();
const requiredReads = ['docs/agents/PROMPT-UNIFIED-EXECUTION.md', 'scripts/ci/cell-lab-consensus.mjs', 'docs/agents/CELL-CONTROL-HEADQUARTERS.md', 'PROJECTS.md', 'المهام.md', 'AGENTS.md', 'docs/EXECUTION-BRANCH-PROTOCOL.md', 'docs/AGENT-COLLABORATION-PROTOCOL.md', 'docs/AGENT-HANDOFF-REPORT-SCHEMA.md', 'docs/AGENT-COORDINATION-CONTROL-PLANE.md', 'docs/PROTOCOL-HIERARCHY.md', 'docs/PROTOCOL-REGISTRY.json', 'docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json', 'docs/agents/PROMPT-REGISTRY.json', 'diagnostics/auto-repair/memory.json', 'scripts/ci/agent-communication.mjs', 'docs/MINIMAL-CI-FINAL-ARCHITECTURE.md', 'scripts/ci/test-plan.json', 'scripts/ci/assertion-registry.json'];
const split = (value, separator = ',') => String(value ?? '').split(separator).map((v) => v.trim()).filter(Boolean);
const storageKey = (id) => createHash('sha256').update(id).digest('hex');
const admissionDigest = (file) => createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, file), 'utf8'), 'utf8').digest('hex');
const governanceFingerprint = (sources) => createHash('sha256').update(sources.map((item) => `${item.path}:${item.sha256}`).join('|'), 'utf8').digest('hex');
const assertLiveSession = (record) => {
  const currentSha = gitSha();
  if (isWorkspaceOnlySession(record)) {
    assertWorkspaceIsolation({ repoRoot: ROOT, workspace: record.workspaceIsolation.workspace, entrySha: record.workspaceIsolation.entrySha });
  } else if (record.entrySha && record.entrySha !== currentSha) throw new Error('AGENT_SESSION_STALE_ENTRY_SHA');
  const currentGovernance = governanceFingerprint(requiredReads.map((file) => ({ path: file, sha256: admissionDigest(file) })));
  if (record.governanceFingerprint && record.governanceFingerprint !== currentGovernance) throw new Error('AGENT_SESSION_GOVERNANCE_DRIFT');
  if (!isWorkspaceOnlySession(record) && record.branch && record.branch !== gitBranch()) throw new Error('AGENT_SESSION_BRANCH_DRIFT');
};
const readCanonicalAdmissionSources = () => {
  const sources = requiredReads.map((file) => ({ path: file, sha256: admissionDigest(file) }));
  const protocolRegistry = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'docs/PROTOCOL-REGISTRY.json'), 'utf8'));
  if (protocolRegistry.authority !== 'FLIXO_PROTOCOL_REGISTRY') throw new Error('AGENT_ADMISSION_PROTOCOL_REGISTRY_INVALID');
  const p00 = protocolRegistry.protocols?.find((item) => item?.id === 'P00');
  if (p00?.status !== 'SUPREME_MANDATORY' || p00?.canonicalSource !== 'docs/agents/PROMPT-UNIFIED-EXECUTION.md' || p00?.version !== '4.0.0') throw new Error('AGENT_ADMISSION_P00_SUPREME_PROTOCOL_INVALID');
  const supremePrompt = fs.readFileSync(path.resolve(ROOT, 'docs/agents/PROMPT-UNIFIED-EXECUTION.md'), 'utf8');
  if (!supremePrompt.includes('RPR-UNIFIED-EXECUTION-001 · v4.0.0 · PROTOCOL-ROOT') || !supremePrompt.includes('FIRST OBLIGATION') || !supremePrompt.includes('HARD CIRCULAR EXIT LOCK')) throw new Error('AGENT_ADMISSION_SUPREME_PROMPT_INVALID');
  if (protocolRegistry.protocols?.find((item) => item?.id === 'P20')?.status !== 'MANDATORY') throw new Error('AGENT_ADMISSION_P20_NOT_MANDATORY');
  const promptRegistry = loadPromptRegistry();
  const promptValidation = validatePromptRegistry(promptRegistry);
  if (!promptValidation.ok) throw new Error('AGENT_ADMISSION_PROMPT_REGISTRY_INVALID');
  const memory = loadErrorMemory();
  if (!memory || !Array.isArray(memory.cases) || !Array.isArray(memory.lessons) || !Array.isArray(memory.antiLessons)) {
    throw new Error('AGENT_ADMISSION_MEMORY_INVALID');
  }
  return {
    sources,
    promptRegistry: { status: promptValidation.status, promptCount: promptValidation.promptCount },
    memory: { version: memory.version ?? null, cases: memory.cases.length, lessons: memory.lessons.length, antiLessons: memory.antiLessons.length },
    protocol: { schemaVersion: protocolRegistry.schemaVersion, protocolCount: protocolRegistry.protocols.length },
  };
};
const sessionPath = (id) => path.join(sessionDir, `${storageKey(id)}.json`);
const coordinationStatePath = () => path.resolve(ROOT, process.env.FLIXO_COORDINATION_DIR ?? 'diagnostics/agents', 'coordination-state.json');
const readCoordinationChairBinding = (sessionId, expectedAgentId, expectedTaskId) => {
  const file = coordinationStatePath();
  if (!fs.existsSync(file)) return null;
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  const active = state.activeSessions?.[sessionId];
  if (!active) return null;
  if (active.agentId !== expectedAgentId) throw new Error('AGENT_SESSION_COORDINATION_AGENT_MISMATCH');
  if (active.taskId !== expectedTaskId) throw new Error('AGENT_SESSION_COORDINATION_TASK_MISMATCH');
  if (active.entrySha && active.entrySha !== gitSha()) throw new Error('AGENT_SESSION_COORDINATION_STALE_SHA');
  if (!active.chairId) return null;
  return Object.freeze({ chairId: active.chairId, chairLeaseId: active.chairLeaseId ?? null, entrySha: active.entrySha ?? null });
};
const handoffPath = (id) => path.join(handoffDir, `${storageKey(id)}.json`);
const visibilityPath = (id) => path.join(visibilityDir, `${storageKey(id)}.json`);
const ACTION_VAULT_SESSION_ROLES = Object.freeze(['actionRepairBot','actionRepairVerifier','actionHistorian']);
const roles = new Set(['analysis','implementation','verification','release','assistantController','MASTER-1','MASTER-2','MASTER-3','codeScout','executionAgent','reviewAgent','testAgent','securityAgent','performanceAgent','certificationAuthority','taskAgent','errorAgent','repairAgent','assistantRepairAgent','diagnosticAgent', ...ACTION_VAULT_SESSION_ROLES]);
const isMeetingSession = (record) => Boolean(record?.meetingLock?.locked === true);
const assertMeetingExitApproval = (record, currentSha) => {
  if (!isMeetingSession(record)) return;
  const approval = record.meetingLock?.exitApproval;
  if (!approval || approval.approvedBy !== 'assistantController') throw new Error('COUNCIL_MEETING_EXIT_REQUIRES_PRESIDENT_APPROVAL');
  if (approval.meetingId !== record.meetingLock.meetingId) throw new Error('COUNCIL_MEETING_EXIT_APPROVAL_MEETING_MISMATCH');
  if (approval.sessionId !== record.sessionId) throw new Error('COUNCIL_MEETING_EXIT_APPROVAL_SESSION_MISMATCH');
  if (approval.approvalSha !== currentSha) throw new Error('COUNCIL_MEETING_EXIT_APPROVAL_STALE_SHA');
};
const isWorkspaceOnlySession = (record) => record?.workspaceIsolation?.mode === 'WORKSPACE_ONLY';
const ensureSessionWorkChair = (record) => {
  if (isWorkspaceOnlySession(record)) return null;
  const targetSha = gitSha();
  if (record.chairBinding?.released === true) throw new Error('AGENT_WORK_AFTER_TASK_RELEASE_FORBIDDEN');
  const existing = activeChairForAgent({ agentId: record.agentId, targetSha });
  if (existing) {
    record.chairId = existing.chairId;
    record.chairLeaseId = existing.leaseId;
    record.chairBinding = {
      ...(record.chairBinding ?? {}),
      required: true,
      admission: 'CHAIR_REQUIRED_FOR_WORK',
      chairId: existing.chairId,
      leaseId: existing.leaseId,
      targetSha,
      taskId: record.taskId,
      workPackageId: record.chairBinding?.workPackageId ?? record.taskId,
      acquiredAt: record.chairBinding?.acquiredAt ?? now(),
      released: false,
    };
    return existing;
  }
  const chairSigningKey = String(process.env.FLIXO_CHAIR_SIGNING_KEY ?? process.env.GITHUB_TOKEN ?? '').trim();
  if (!chairSigningKey) throw new Error('AGENT_SESSION_CHAIR_SIGNING_KEY_REQUIRED');
  process.env.FLIXO_CHAIR_SIGNING_KEY = chairSigningKey;
  initializeChairState({ targetSha });
  const coordinationChair = readCoordinationChairBinding(record.sessionId, record.agentId, record.taskId);
  const effectiveChairId = coordinationChair?.chairId ?? 'chair_1';
  const admission = beginChairWork({
    agentId: record.agentId,
    targetSha,
    requestedChairId: effectiveChairId,
    role: record.role,
    repositoryState: effectiveChairId !== 'chair_1' ? 'ACTIVE' : 'IDLE',
    workPackageId: record.taskId,
    taskId: record.taskId,
    scope: record.scope,
    reviewId: record.currentRca,
  });
  record.chairId = admission.chairId;
  record.chairLeaseId = admission.leaseId;
  record.chairBinding = {
    ...(record.chairBinding ?? {}),
    required: true,
    admission: 'CHAIR_REQUIRED_FOR_WORK',
    chairId: admission.chairId,
    leaseId: admission.leaseId,
    targetSha,
    taskId: record.taskId,
    workPackageId: admission.workPackageId ?? record.taskId,
    acquiredAt: now(),
    released: false,
  };
  appendEvent(record, { at: now(), action: 'CHAIR_AUTO_ADMISSION', sha: targetSha, chairId: admission.chairId, leaseId: admission.leaseId, reason: 'WORK_STARTED_WITHOUT_ACTIVE_CHAIR', defaultChair: admission.chairId === 'chair_1' });
  return admission;
};

const writeVisibility = (record) => {
  fs.mkdirSync(visibilityDir, { recursive: true });
  fs.writeFileSync(visibilityPath(sessionId), `${JSON.stringify(record, null, 2)}\n`);
};
const secretLike = (value) => /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]+)/i.test(String(value ?? ''));
const assertSafeText = (...values) => { for (const value of values.flat()) if (secretLike(value)) throw new Error('AGENT_EVENT_SECRET_LIKE_CONTENT_REJECTED'); };
const appendEvent = (record, event) => {
  const administrative = event.workEvent === false;
  const chair = administrative || isWorkspaceOnlySession(record) ? null : activeChairForAgent({ agentId: record.agentId, targetSha: gitSha() });
  if (!administrative && !isWorkspaceOnlySession(record) && !chair) throw new Error('AGENT_WORK_EVENT_REQUIRES_CHAIR');
  const enriched = {
    ...event,
    workEvent: !administrative,
    workRecorded: !administrative,
    exactSha: isWorkspaceOnlySession(record) ? record.currentSha : gitSha(),
    ...(chair ? { chairId: chair.chairId, chairLeaseId: chair.leaseId, chairTargetSha: chair.targetSha } : {}),
  };
  record.actions = Array.isArray(record.actions) ? [...record.actions, enriched] : [enriched];
  record.activity = Array.isArray(record.activity) ? [...record.activity, enriched] : [enriched];
};
const isMaster = (value) => ['MASTER-1','MASTER-2','MASTER-3'].includes(value);
const taskSnapshotFromRecord = (record) => ({ taskId: record.taskId, status: record.status, livenessState: record.livenessState, currentSha: record.currentSha ?? record.entrySha, currentRca: record.currentRca, openRcas: record.openRcas ?? [], remainingWork: record.remainingWork ?? [], nextAction: record.executionPlanNext ?? [], blockers: record.blockers ?? [], lastProgressAt: record.lastProgressAt ?? null, lastHeartbeatAt: record.lastHeartbeatAt ?? null, updatedAt: now() });
const observeCurrentHead = (record) => {
  if (isWorkspaceOnlySession(record)) {
    const isolated = assertWorkspaceIsolation({ repoRoot: ROOT, workspace: record.workspaceIsolation.workspace, entrySha: record.workspaceIsolation.entrySha });
    record.currentSha = isolated.currentSha;
    record.observedSha = isolated.currentSha;
    record.branchHeadObservedAtEntry = record.entrySha;
    record.rootBranchHeadChangesIgnored = true;
    return isolated.currentSha;
  }
  const currentSha = gitSha();
  const previousSha = record.currentSha ?? record.entrySha ?? currentSha;
  if (previousSha !== currentSha) {
    record.previousSha = previousSha;
    record.currentSha = currentSha;
    record.shaChanges = Math.max(0, Number(record.shaChanges) || 0) + 1;
    record.evidenceInvalidatedByShaChange = true;
    record.requalificationRequired = true;
    record.lastShaChangeAt = now();
    appendEvent(record, { at: now(), action: 'SESSION_SHA_CHANGED', previousSha, currentSha, evidenceInvalidated: true, requalificationRequired: true, recovery: 'REQUALIFY_CURRENT_SHA' });
  } else record.currentSha = currentSha;
  return currentSha;
};

if (!['login', 'event', 'heartbeat', 'master-update', 'logout', 'meeting-exit-approve', 'message-receive', 'message-consume'].includes(command)) throw new Error('Usage: agent-session.mjs login|event|logout|meeting-exit-approve|message-receive|message-consume --session=<id> --agent=<id> --task=<task-id>');
if (!sessionId || !agentId || !taskId) throw new Error('Agent session requires --session, --agent and --task.');
if (meetingRequested && !meetingId) throw new Error('COUNCIL_MEETING_ID_REQUIRED');
if (!roles.has(role)) throw new Error(`Invalid agent role: ${role}`);

fs.mkdirSync(sessionDir, { recursive: true });
fs.mkdirSync(handoffDir, { recursive: true });
const file = sessionPath(sessionId);

if (command === 'meeting-exit-approve') {
  if (role !== 'assistantController' || agentId !== 'assistantController') throw new Error('COUNCIL_MEETING_EXIT_APPROVAL_CONTROLLER_ONLY');
  if (!meetingId) throw new Error('COUNCIL_MEETING_ID_REQUIRED');
  if (!fs.existsSync(file)) throw new Error('Session not found: ' + sessionId);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.taskId !== taskId) throw new Error('COUNCIL_MEETING_TASK_MISMATCH');
  if (record.status !== 'RUNNING') throw new Error('COUNCIL_MEETING_EXIT_APPROVAL_SESSION_NOT_RUNNING');
  assertLiveSession(record);
  if (!isMeetingSession(record)) throw new Error('COUNCIL_MEETING_EXIT_APPROVAL_NO_MEETING_LOCK');
  if (record.meetingLock.meetingId !== meetingId) throw new Error('COUNCIL_MEETING_ID_MISMATCH');
  const approvalId = String(args.get('approval-id') ?? process.env.FLIXO_AGENT_MEETING_APPROVAL_ID ?? '').trim() || `meeting-exit:${sessionId}:${gitSha()}`;
  record.meetingLock.exitApproval = { approvalId, approvedBy: 'assistantController', meetingId, sessionId, approvalSha: gitSha(), approvedAt: now() };
  appendEvent(record, { at: now(), action: 'MEETING_EXIT_APPROVAL', approvedBy: 'assistantController', meetingId, approvalId, sha: gitSha() });
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  writeVisibility({ schemaVersion: 1, authority: 'AGENT_VISIBILITY_LEDGER', visibilityState: 'OPEN', taskId: record.taskId, sessionId: record.sessionId, agentId: record.agentId, role: record.role, entrySha: record.entrySha, exitSha: null, status: record.status, finalStatus: null, finalSummary: null, scope: record.scope, currentRca: record.currentRca, rcaClosed: record.rcaClosed ?? [], openRcas: record.openRcas ?? [], changedFiles: record.changedFiles ?? [], commands: record.commands ?? [], evidence: record.evidence ?? [], findings: record.findings ?? [], activity: record.activity ?? [], lastEvent: record.activity?.at(-1) ?? null, completedWork: record.completedWork ?? [], failedWork: record.failedWork ?? [], remainingWork: record.remainingWork ?? [], executionPlanNext: record.executionPlanNext ?? [], blockers: record.blockers ?? [], handoffToNextAgent: record.handoffToNextAgent ?? null, meetingLock: record.meetingLock, continuationFrom: record.continuationFrom ?? null, inheritedExitSha: record.inheritedExitSha ?? null, startedAt: record.startedAt, updatedAt: now() });
  console.log(`COUNCIL_MEETING_EXIT_APPROVED=${approvalId}`);
} else if (command === 'event') {
  if (!fs.existsSync(file)) throw new Error('Session not found: ' + sessionId);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!record.repairProtocol || record.repairProtocol.protocolHash !== assertProtocolDefinition().protocolHash) throw new Error('REPAIR_PROTOCOL_SESSION_HASH_DRIFT');
  if (record.agentId !== agentId) throw new Error('Session owner mismatch: ' + sessionId);
  if (record.taskId !== taskId) throw new Error('AGENT_EVENT_TASK_MISMATCH');
  if (record.status !== 'RUNNING') throw new Error('AGENT_EVENT_REQUIRES_ACTIVE_SESSION');
  assertLiveSession(record);
  ensureSessionWorkChair(record);
  assertWorkAdmission({ agentId: record.agentId, targetSha: gitSha(), chairId: record.chairBinding?.chairId ?? record.chairId ?? null });
  const eventSha = observeCurrentHead(record);
  const heartbeat = checkHeartbeat({ state: record.livenessState ?? 'ACTIVE', lastHeartbeatAt: record.lastHeartbeatAt ?? record.startedAt });
  if (!heartbeat.ok) {
    record.livenessState = 'RECOVERING';
    record.continuousActiveSince = now();
    appendEvent(record, { at: now(), action: 'LIVENESS_RECOVERY_REQUIRED', sha: gitSha(), reason: heartbeat.reason ?? 'HEARTBEAT_STALE', recovery: 'RECOVER_AND_CONTINUE', continuousWindowReset: true });
  } else {
    record.livenessState = 'ACTIVE';
    record.continuousActiveSince = record.continuousActiveSince ?? record.startedAt;
  }
  record.lastHeartbeatAt = now();
  const type = String(args.get('type') ?? '').trim().toUpperCase();
  const summary = String(args.get('summary') ?? '').trim();
  const allowed = new Set(['PROGRESS','FINDING','BLOCKER','CHANGE','TEST','VERIFICATION','HANDOFF','NOTE']);
  if (!allowed.has(type)) throw new Error('Invalid event type: ' + (type || 'MISSING'));
  if (!summary) throw new Error('AGENT_EVENT_SUMMARY_REQUIRED');
  const files = split(args.get('files') ?? process.env.FLIXO_AGENT_EVENT_FILES);
  const evidence = split(args.get('evidence') ?? process.env.FLIXO_AGENT_EVENT_EVIDENCE);
  const findings = split(args.get('findings') ?? process.env.FLIXO_AGENT_EVENT_FINDINGS, '|');
  const blockers = split(args.get('blockers') ?? process.env.FLIXO_AGENT_EVENT_BLOCKERS, '|');
  const next = split(args.get('next') ?? process.env.FLIXO_AGENT_EVENT_NEXT, '|');
  const sha = gitSha();
  assertSafeText(type, summary, files, evidence, findings, blockers, next);
  const event = { at: now(), action: 'EVENT', type, summary, sha: eventSha ?? sha, files, evidence, findings, blockers, next };
  if (['PROGRESS','FINDING','CHANGE','TEST','VERIFICATION','HANDOFF','NOTE'].includes(type)) record.lastProgressAt = event.at;
  if (type === 'MASTER_UPDATE' || type === 'HANDOFF') record.lastMasterUpdateAt = event.at;
  record.taskStateSnapshot = taskSnapshotFromRecord(record);
  appendEvent(record, event);
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  const visibilityFile = visibilityPath(sessionId);
  if (!fs.existsSync(visibilityFile)) throw new Error('AGENT_VISIBILITY_RECORD_MISSING');
  const visibility = JSON.parse(fs.readFileSync(visibilityFile, 'utf8'));
  if (visibility.visibilityState !== 'OPEN' || visibility.status !== 'RUNNING') throw new Error('AGENT_VISIBILITY_NOT_OPEN');
  visibility.activity = Array.isArray(visibility.activity) ? [...visibility.activity, event] : [event];
  visibility.lastEvent = event;
  visibility.changedFiles = [...new Set([...(visibility.changedFiles ?? []), ...files])];
  visibility.evidence = [...new Set([...(visibility.evidence ?? []), ...evidence])];
  visibility.findings = [...new Set([...(visibility.findings ?? []), ...findings])];
  visibility.blockers = [...new Set([...(visibility.blockers ?? []), ...blockers])];
  visibility.updatedAt = now();
  writeVisibility(visibility);
  console.log('AGENT_SESSION_EVENT=' + type);
  console.log('AGENT_SESSION_SHA=' + sha);
} else if (command === 'heartbeat') {
  if (!fs.existsSync(file)) throw new Error('Session not found: ' + sessionId);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.agentId !== agentId) throw new Error('Session owner mismatch: ' + sessionId);
  if (record.taskId !== taskId) throw new Error('AGENT_HEARTBEAT_TASK_MISMATCH');
  if (record.status !== 'RUNNING') throw new Error('AGENT_HEARTBEAT_REQUIRES_ACTIVE_SESSION');
  assertLiveSession(record);
  if (!isWorkspaceOnlySession(record)) {
    ensureSessionWorkChair(record);
    assertWorkAdmission({ agentId: record.agentId, targetSha: gitSha(), chairId: record.chairBinding?.chairId ?? record.chairId ?? null });
  }
  const sha = observeCurrentHead(record);
  if (!record.chairId) record.chairId = record.chairBinding?.chairId ?? null;
  if (!record.chairLeaseId) record.chairLeaseId = record.chairBinding?.leaseId ?? null;
  const heartbeat = checkHeartbeat({ state: record.livenessState ?? 'ACTIVE', lastHeartbeatAt: record.lastHeartbeatAt ?? record.continuousActiveSince ?? record.startedAt });
  let chairHeartbeatResult = null;
  if (record.chairId && !isWorkspaceOnlySession(record)) {
    initializeChairState({ targetSha: gitSha() });
    reconcileDeadLeases({ targetSha: gitSha() });
    try {
      chairHeartbeatResult = heartbeatChair({ chairId: record.chairId, agentId, targetSha: gitSha() });
    } catch (error) {
      record.livenessState = 'RECOVERING';
      appendEvent(record, { at: now(), action: 'CHAIR_LEASE_RECOVERY_REQUIRED', sha: gitSha(), chairId: record.chairId, reason: String(error?.message ?? error), recovery: 'RECLAIM_AND_RESYNC' });
      fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
      throw new Error('CHAIR_LEASE_RECOVERY_REQUIRED', { cause: error });
    }
  }
  const continuous = checkContinuousSessionWindow({ continuousStartedAt: record.continuousActiveSince ?? record.startedAt });
  const at = now();
  record.livenessState = heartbeat.ok ? 'ACTIVE' : 'RECOVERING';
  if (!heartbeat.ok) record.continuousActiveSince = at;
  if (!continuous.ok && continuous.action === 'RESIDENCY_RENEWAL_REQUIRED') { record.livenessState = 'RECOVERING'; record.residencyRenewals = Math.max(0, Number(record.residencyRenewals) || 0) + 1; record.previousContinuousActiveSince = record.continuousActiveSince; record.continuousActiveSince = at; record.requalificationRequired = true; record.livenessState = 'ACTIVE'; }
  record.continuousActiveSince = record.continuousActiveSince ?? record.startedAt;
  record.lastHeartbeatAt = at;
  const masterUpdateDue = isMaster(record.agentId) && Date.parse(String(record.lastMasterUpdateAt ?? '')) + AGENT_LIVENESS_PROTOCOL.masterStatusUpdateEveryMs <= Date.now();
  const taskReminderDue = Date.parse(String(record.lastTaskReminderAt ?? '')) + AGENT_LIVENESS_PROTOCOL.taskReminderEveryMs <= Date.now();
  const event = { at, action: 'HEARTBEAT', sha, liveness: heartbeat.ok ? 'ON_TIME' : 'RECOVERED_FROM_GAP', chairHeartbeat: chairHeartbeatResult ? { at: chairHeartbeatResult.heartbeatAt, count: chairHeartbeatResult.heartbeatCount, deadAfterMs: chairHeartbeatResult.deadAfterMs } : null, residencyRenewal: !continuous.ok && continuous.action === 'RESIDENCY_RENEWAL_REQUIRED', recovery: heartbeat.ok ? null : 'RECOVER_AND_CONTINUE', masterUpdateDue, taskReminderDue, evidenceInvalidatedByShaChange: record.evidenceInvalidatedByShaChange, requalificationRequired: record.requalificationRequired };
  appendEvent(record, event);
  if (masterUpdateDue) record.lastMasterUpdateAt = at;
  if (taskReminderDue) record.lastTaskReminderAt = at;
  if (masterUpdateDue || taskReminderDue) appendEvent(record, { at, action: taskReminderDue ? 'TASK_REMINDER' : 'MASTER_STATUS_UPDATE_DUE', sha, channel: 'MASTER_CELL_LAB', required: true, snapshot: taskSnapshotFromRecord(record) });
  record.taskStateSnapshot = taskSnapshotFromRecord(record);
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  if (isMaster(record.agentId) && (masterUpdateDue || taskReminderDue)) {
    try { execFileSync(process.execPath,['scripts/ci/master-peer-communication.mjs','send','--repo='+(process.env.GITHUB_REPOSITORY || 'm1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS'),'--from='+record.agentId,'--to=MASTERS','--task='+record.taskId,'--message='+(taskReminderDue?'TASK REMINDER: review remaining work and next action.':'MASTER STATUS UPDATE: review current exact SHA and continue.'),'--session='+record.sessionId,'--message-kind='+(taskReminderDue?'TASK_REMINDER':'STATUS_UPDATE'),'--idempotency-key=master-session:'+record.sessionId+':'+Math.floor(Date.now()/AGENT_LIVENESS_PROTOCOL.masterStatusUpdateEveryMs),'--payload='+JSON.stringify({channel:'MASTER_CELL_LAB',taskSnapshot:taskSnapshotFromRecord(record),sessionId:record.sessionId,currentSha:sha,requalificationRequired:Boolean(record.requalificationRequired)})],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}); appendEvent(record,{at:now(),action:'MASTER_CHANNEL_PUBLISHED',sha,channel:'MASTER_CELL_LAB',kind:taskReminderDue?'TASK_REMINDER':'STATUS_UPDATE'}); } catch(error) { appendEvent(record,{at:now(),action:'MASTER_CHANNEL_PUBLISH_BLOCKED',sha,channel:'MASTER_CELL_LAB',reason:String(error?.message ?? error),taskRemainsOpen:true}); }
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  }
  const visibilityFile = visibilityPath(sessionId);
  if (fs.existsSync(visibilityFile)) {
    const visibility = JSON.parse(fs.readFileSync(visibilityFile, 'utf8'));
    visibility.activity = Array.isArray(visibility.activity) ? [...visibility.activity, event] : [event];
    visibility.lastEvent = event;
    visibility.updatedAt = at;
    visibility.livenessState = record.livenessState;
    visibility.lastHeartbeatAt = at;
    visibility.residencyLock = record.residencyLock;
    writeVisibility(visibility);
  }
  console.log('AGENT_SESSION_HEARTBEAT=' + (heartbeat.ok ? 'ON_TIME' : 'RECOVERED'));
  console.log('AGENT_SESSION_SHA=' + sha);
  console.log('AGENT_SESSION_LIVENESS=' + record.livenessState);
} else if (command === 'master-update') {
  if (!isMaster(agentId)) throw new Error('MASTER_CHANNEL_MASTER_ONLY');
  if (!fs.existsSync(file)) throw new Error('Session not found: ' + sessionId);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.agentId !== agentId || record.taskId !== taskId || record.status !== 'RUNNING') throw new Error('MASTER_CHANNEL_SESSION_INVALID');
  assertLiveSession(record);
  ensureSessionWorkChair(record);
  assertWorkAdmission({ agentId: record.agentId, targetSha: gitSha(), chairId: record.chairBinding?.chairId ?? record.chairId ?? null });
  const sha = observeCurrentHead(record);
  const to = String(args.get('to') ?? 'MASTERS').trim();
  const message = String(args.get('message') ?? '').trim();
  if (!message) throw new Error('MASTER_CHANNEL_MESSAGE_REQUIRED');
  const kind = String(args.get('kind') ?? 'STATUS_UPDATE').trim().toUpperCase();
  const snapshot = taskSnapshotFromRecord(record);
  execFileSync(process.execPath,['scripts/ci/master-peer-communication.mjs','send','--repo='+(process.env.GITHUB_REPOSITORY || 'm1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS'),'--from='+agentId,'--to='+to,'--task='+taskId,'--message='+message,'--session='+sessionId,'--message-kind='+kind,'--idempotency-key=manual-master:'+sessionId+':'+kind+':'+Math.floor(Date.now()/AGENT_LIVENESS_PROTOCOL.masterStatusUpdateEveryMs),'--payload='+JSON.stringify({channel:'MASTER_CELL_LAB',taskSnapshot:snapshot,sessionId:sessionId,currentSha:sha,requalificationRequired:Boolean(record.requalificationRequired)})],{cwd:ROOT,encoding:'utf8'});
  record.lastMasterUpdateAt=now();
  appendEvent(record,{at:now(),action:'MASTER_CHANNEL_UPDATE',sha,channel:'MASTER_CELL_LAB',kind,to,message,snapshot});
  record.taskStateSnapshot=snapshot;
  fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({status:'MASTER_CHANNEL_UPDATE_RECORDED',sha,kind,to,snapshot},null,2));
} else if (command === 'message-receive') {
  if (!rawMessageFile && !rawMessageId) throw new Error('AGENT_MESSAGE_INPUT_REQUIRED');
  if (rawMessageFile) {
    const message = JSON.parse(fs.readFileSync(path.resolve(ROOT, rawMessageFile), 'utf8'));
    const received = ingestAgentMessage(message, gitSha());
    const read = readAgentMessage(received.messageId, agentId, gitSha());
    console.log(JSON.stringify({ status: read.status, messageId: read.messageId, entrySha: read.entrySha, readBy: agentId }, null, 2));
  } else {
    const read = readAgentMessage(rawMessageId, agentId, gitSha());
    console.log(JSON.stringify({ status: read.status, messageId: read.messageId, entrySha: read.entrySha, readBy: agentId }, null, 2));
  }
} else if (command === 'message-consume') {
  if (!rawMessageId) throw new Error('AGENT_MESSAGE_ID_REQUIRED');
  const consumed = consumeAgentMessage(rawMessageId, agentId, gitSha(), messageExecutionAdmitted);
  console.log(JSON.stringify({ status: consumed.status, messageId: consumed.messageId, entrySha: consumed.entrySha, consumedBy: agentId }, null, 2));
} else if (command === 'login') {
  if (fs.existsSync(file)) throw new Error(`Session already exists: ${sessionId}`);
  const missing = requiredReads.filter((entry) => !fs.existsSync(path.resolve(ROOT, entry)));
  if (missing.length) throw new Error(`Mandatory reads missing: ${missing.join(', ')}`);
  const currentSha = gitSha();
  const admissionSources = readCanonicalAdmissionSources();
  const currentGovernanceFingerprint = governanceFingerprint(admissionSources.sources);
  const sha = currentSha;
  const existingHandoffs = fs.readdirSync(handoffDir).filter((entry) => entry.endsWith('.json'));
  let continuation = null;
  if (fromSession) {
    const predecessorFile = handoffPath(fromSession);
    if (!fs.existsSync(predecessorFile)) throw new Error(`Previous handoff report not found: ${fromSession}`);
    const predecessor = JSON.parse(fs.readFileSync(predecessorFile, 'utf8'));
    if (!['VERIFIED', 'BLOCKED'].includes(predecessor.status)) throw new Error(`Previous session is not closed: ${fromSession}`);
    if (!/^[a-f0-9]{40}$/u.test(String(predecessor.exitSha ?? '')) || predecessor.exitSha !== currentSha) throw new Error(`CONTINUATION_STALE_EXIT_SHA=${fromSession}`);
    continuation = {
      continuationFrom: fromSession,
      inheritedExitSha: predecessor.exitSha ?? null,
      inheritedRemainingWork: Array.isArray(predecessor.remainingWork) ? predecessor.remainingWork : [],
      inheritedOpenRcas: Array.isArray(predecessor.openRcas) ? predecessor.openRcas : [],
      inheritedNextPlan: Array.isArray(predecessor.executionPlanNext) ? predecessor.executionPlanNext : [],
      predecessorReport: path.relative(ROOT, predecessorFile),
      predecessorTaskId: predecessor.taskId ?? null,
    };
    if (continuation.predecessorTaskId && continuation.predecessorTaskId !== taskId) throw new Error(`CONTINUATION_TASK_MISMATCH=${continuation.predecessorTaskId}`);
  } else if (existingHandoffs.length > 0 && args.get('bootstrap') !== 'true') {
    throw new Error('Continuation handoff required: use --from-session=<previous-session> or explicitly declare --bootstrap=true.');
  }

  let inboundMessage = null;
  if (rawMessageFile) {
    inboundMessage = ingestAgentMessage(JSON.parse(fs.readFileSync(path.resolve(ROOT, rawMessageFile), 'utf8')), sha);
    inboundMessage = inboundMessage.status === 'RECEIVED' ? readAgentMessage(inboundMessage.messageId, agentId, sha) : inboundMessage;
  } else if (rawMessageId) {
    inboundMessage = readAgentMessage(rawMessageId, agentId, sha);
  }
  if (inboundMessage && inboundMessage.status !== 'READ' && inboundMessage.status !== 'CONSUMED') {
    throw new Error('AGENT_MESSAGE_NOT_EXECUTION_READY=' + inboundMessage.status);
  }
  const workspaceOnly = !['assistantController','MASTER-1','MASTER-2','MASTER-3'].includes(role);
  const workspaceIsolation = workspaceOnly ? createAgentWorkspace({
    repoRoot: ROOT,
    agentId,
    taskId,
    baseSha: currentSha,
    executionSha: currentSha,
    mainSha: gitMainSha(),
  }) : null;
  const record = {
    schemaVersion: 4,
    repairProtocol: { ...assertProtocolDefinition(), compliance: 'VALIDATED_AT_ENTRY', admission: protocolAdmission },
    sessionId,
    agentId,
    role,
    entrySha: currentSha,
    currentSha,
    observedSha: currentSha,
    baseSha: currentSha,
    branch: workspaceOnly ? 'execution(workspace-isolated)' : gitBranch(),
    workspaceIsolation: workspaceOnly ? { mode: 'WORKSPACE_ONLY', ...workspaceIsolation } : { mode: 'INTEGRATION_SESSION' },
    governanceFingerprint: currentGovernanceFingerprint,
    startedAt: now(),
    scope,
    readFiles: [...requiredReads],
    admissionSources,
    currentRca: rca,
    taskId,
    residencyLock: {
      minimumActiveWindowMs: AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs,
      maxContinuousActiveSessionMs: AGENT_LIVENESS_PROTOCOL.maxContinuousActiveSessionMs,
      masterChannel: 'MASTER_CELL_LAB',
      masterStatusUpdateEveryMs: AGENT_LIVENESS_PROTOCOL.masterStatusUpdateEveryMs,
      taskReminderEveryMs: AGENT_LIVENESS_PROTOCOL.taskReminderEveryMs,
      minimumActiveWindowMinutes: 45,
      startedAt: now(),
      minCloseAt: new Date(Date.parse(now()) + AGENT_LIVENESS_PROTOCOL.activeRepairWindowMs).toISOString(),
      noSleep: true,
      noIdle: true,
      cellLabRequired: true,
      zeroErrorTarget: true,
      heartbeatEveryMs: AGENT_LIVENESS_PROTOCOL.heartbeatEveryMs,
      heartbeatGraceMs: AGENT_LIVENESS_PROTOCOL.heartbeatGraceMs,
    },
    lastHeartbeatAt: now(),
    lastProgressAt: now(),
    lastMasterUpdateAt: now(),
    lastTaskReminderAt: now(),
    continuousActiveSince: now(),
    residencyRenewals: 0,
    evidenceInvalidatedByShaChange: false,
    requalificationRequired: false,
    livenessState: 'ACTIVE',
    ...(meetingRequested ? { meetingLock: { locked: true, meetingId, enteredBy: agentId, enteredAt: now(), entrySha: sha, exitApproval: null } } : {}),
    ...(inboundMessage ? { messageId: inboundMessage.messageId, messageStatus: inboundMessage.status, messageEntrySha: inboundMessage.entrySha, messageReadBy: agentId, messagePriority: 'P0_COMMUNICATION_FIRST' } : {}),
    status: 'RUNNING',
    chairId: null,
    chairLeaseId: null,
    chairBinding: { required: true, admission: 'CHAIR_REQUIRED_FOR_WORK', chairId: null, leaseId: null, targetSha: sha, taskId, workPackageId: taskId, acquiredAt: null, released: false },
    bootstrap: !continuation,
    ...(continuation ?? {}),
    actions: [{ at: now(), action: 'LOGIN', sha, ...(continuation ? { fromSession } : {}) }],
  };
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  if (!workspaceOnly && isMaster(agentId)) {
    ensureSessionWorkChair(record);
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  }
  writeVisibility({ schemaVersion: 1, authority: 'AGENT_VISIBILITY_LEDGER', visibilityState: 'OPEN', taskId, sessionId, agentId, role, entrySha: sha, exitSha: null, status: 'RUNNING', finalStatus: null, finalSummary: null, scope, currentRca: rca, rcaClosed: [], openRcas: [], changedFiles: [], commands: [], evidence: [], findings: [], activity: [], lastEvent: null, completedWork: [], failedWork: [], remainingWork: [], executionPlanNext: [], blockers: [], handoffToNextAgent: null, continuationFrom: record.continuationFrom ?? null, inheritedExitSha: record.inheritedExitSha ?? null, startedAt: record.startedAt, updatedAt: now() , ...(inboundMessage ? { messageId: inboundMessage.messageId, messageEntrySha: inboundMessage.entrySha, messageStatus: inboundMessage.status } : {}) });
  console.log(`AGENT_SESSION_LOGIN=${sessionId}`);
  console.log(`AGENT_SESSION_SHA=${sha}`);
  if (workspaceIsolation) console.log(`AGENT_SESSION_WORKSPACE=${workspaceIsolation.workspace}`);
  console.log(`AGENT_SESSION_FILE=${path.relative(ROOT, file)}`);
  if (continuation) console.log(`AGENT_SESSION_CONTINUATION_FROM=${fromSession}`);
} else {
  if (!fs.existsSync(file)) throw new Error(`Session not found: ${sessionId}`);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.agentId !== agentId) throw new Error(`Session owner mismatch: ${sessionId}`);
  if (record.status !== 'RUNNING') throw new Error(`Session is not active: ${sessionId}`);

  const status = String(args.get('status') ?? process.env.FLIXO_AGENT_STATUS ?? 'VERIFIED').toUpperCase();
  if (!['VERIFIED', 'BLOCKED'].includes(status)) throw new Error(`Logout status must be VERIFIED or BLOCKED; got ${status}`);
  const sha = gitSha();
  if (status === 'BLOCKED') {
    const event = { at: now(), action: 'SESSION_EXIT_BLOCKED', sha, reason: 'OPEN_WORK_MUST_REMAIN_IN_ACTIVE_45_MINUTE_REPAIR_SESSION', taskRemainsOpen: true, recovery: 'RECOVER_AND_CONTINUE', workEvent: false };
    appendEvent(record, event);
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
    const visibilityFile = visibilityPath(sessionId);
    if (fs.existsSync(visibilityFile)) {
      const visibility = JSON.parse(fs.readFileSync(visibilityFile, 'utf8'));
      visibility.activity = Array.isArray(visibility.activity) ? [...visibility.activity, event] : [event];
      visibility.lastEvent = event;
      visibility.status = 'RUNNING';
      visibility.visibilityState = 'OPEN';
      visibility.updatedAt = now();
      visibility.livenessState = record.livenessState ?? 'RECOVERING';
      visibility.residencyLock = record.residencyLock;
      writeVisibility(visibility);
    }
    throw new Error('AGENT_SESSION_BLOCKED_LOGOUT_FORBIDDEN_OPEN_WORK_REMAINS');
  }
  assertActiveRepairWindow({ startedAt: record.startedAt, continuousStartedAt: record.continuousActiveSince });
  const heartbeat = checkHeartbeat({ state: record.livenessState ?? 'ACTIVE', lastHeartbeatAt: record.lastHeartbeatAt ?? record.startedAt });
  if (!heartbeat.ok) throw new Error('AGENT_SESSION_HEARTBEAT_REQUIRED_BEFORE_CLOSE');
  assertMeetingExitApproval(record, sha);
  const activeBeforeClose = activeChairForAgent({ agentId: record.agentId, targetSha: sha });
  if (activeBeforeClose) assertWorkAdmission({ agentId: record.agentId, targetSha: sha, chairId: record.chairBinding?.chairId ?? record.chairId ?? null });
  else if (record.chairBinding?.released !== true) throw new Error('AGENT_SESSION_CHAIR_REQUIRED_OR_EXPLICITLY_RELEASED');
  let workspaceResult = null;
  if (isWorkspaceOnlySession(record)) {
    workspaceResult = captureAgentResult({
      repoRoot: ROOT,
      workspace: record.workspaceIsolation.workspace,
      agentId: record.agentId,
      taskId: record.taskId,
      entrySha: record.workspaceIsolation.entrySha,
      executionSha: record.workspaceIsolation.executionSha,
      mainSha: record.workspaceIsolation.mainSha,
      summary: String(args.get('final-summary') ?? process.env.FLIXO_AGENT_FINAL_SUMMARY ?? '').trim(),
      status: status === 'VERIFIED' ? 'READY_FOR_CHAIR1' : 'BLOCKED_FOR_CHAIR1',
    });
  }
  const changedFiles = [...new Set([...split(args.get('changed') ?? process.env.FLIXO_AGENT_CHANGED_FILES), ...(workspaceResult?.changedFiles ?? [])])];
  const commands = split(args.get('commands') ?? process.env.FLIXO_AGENT_COMMANDS, '|');
  const evidence = split(args.get('evidence') ?? process.env.FLIXO_AGENT_EVIDENCE);
  const findings = split(args.get('findings') ?? process.env.FLIXO_AGENT_FINDINGS, '|');
  const rcaClosed = split(args.get('rca-closed') ?? process.env.FLIXO_AGENT_RCA_CLOSED);
  const openRcas = split(args.get('open-rcas') ?? process.env.FLIXO_AGENT_OPEN_RCAS);
  const completedWork = split(args.get('completed-work') ?? process.env.FLIXO_AGENT_COMPLETED_WORK, '|');
  const failedWork = split(args.get('failed-work') ?? process.env.FLIXO_AGENT_FAILED_WORK, '|');
  const remainingWork = split(args.get('remaining-work') ?? process.env.FLIXO_AGENT_REMAINING_WORK, '|');
  const executionPlanNext = split(args.get('next-plan') ?? process.env.FLIXO_AGENT_NEXT_PLAN, '|');
  const blockers = split(args.get('blockers') ?? process.env.FLIXO_AGENT_BLOCKERS, '|');
  const handoffToNextAgent = String(args.get('handoff') ?? process.env.FLIXO_AGENT_HANDOFF ?? '').trim() || null;
  const cycleLessonsRaw = String(args.get('cycle-lessons-json') ?? process.env.FLIXO_AGENT_CYCLE_LESSONS_JSON ?? '').trim();
  let cycleLessons = [];
  if (cycleLessonsRaw) {
    try {
      const parsed = JSON.parse(cycleLessonsRaw);
      if (!Array.isArray(parsed)) throw new Error('cycleLessons must be an array');
      cycleLessons = parsed.slice(0, 12).map((item) => ({
        type: String(item?.type ?? 'lesson'),
        category: String(item?.category ?? 'GENERAL'),
        text: String(item?.text ?? item ?? '').trim(),
      })).filter((item) => item.text);
    } catch (error) {
      throw new Error(`INVALID_CYCLE_LESSONS_JSON:${error?.message ?? error}`, { cause: error });
    }
  }
  if (!cycleLessons.length) {
    cycleLessons = [
      { type: 'lesson', category: 'RCA', text: `Cycle RCA: ${record.currentRca || 'not declared; preserve the unresolved causal state.'}` },
      { type: 'lesson', category: 'VERIFICATION', text: `Cycle exit status=${status}; exact SHA=${sha}; certification requires fresh exact-SHA evidence.` },
      { type: 'lesson', category: 'SCOPE', text: changedFiles.length ? `Changed paths remained explicit: ${changedFiles.slice(0, 12).join(', ')}.` : 'No repository paths were recorded as changed in this session.' },
      ...(status === 'BLOCKED' ? [{ type: 'antiLesson', category: 'BLOCKER', text: 'Blocked work is not completion; preserve evidence and continue through the next authorized cycle.' }] : []),
    ];
  }
  const finalSummary = String(args.get('final-summary') ?? process.env.FLIXO_AGENT_FINAL_SUMMARY ?? '').trim();
  if (!finalSummary) throw new Error('FINAL_SUMMARY_REQUIRED_BEFORE_SESSION_CLOSE');
  if (remainingWork.length === 0 && openRcas.length > 0) {
    throw new Error('Open RCAs exist but remaining-work is empty; session report must preserve unresolved work.');
  }
  if (status === 'VERIFIED' && (failedWork.length > 0 || remainingWork.length > 0 || openRcas.length > 0)) {
    throw new Error('VERIFIED logout requires no failed work, remaining work, or open RCAs; use BLOCKED until continuation work is closed.');
  }
  if (status === 'BLOCKED' && remainingWork.length === 0 && failedWork.length === 0 && openRcas.length === 0) {
    throw new Error('BLOCKED logout requires an explicit unresolved item.');
  }
  if (status === 'VERIFIED' && completedWork.length === 0 && evidence.length === 0) throw new Error('VERIFIED_LOGOUT_REQUIRES_COMPLETED_WORK_OR_EVIDENCE');
  const activity = Array.isArray(record.activity) ? record.activity : [];
  if (status === 'VERIFIED' && activity.length === 0) throw new Error('VERIFIED_LOGOUT_REQUIRES_ACTIVITY_LOG');

  try {
    assertAgentExitGate({ status, exactSha: sha, failedWork, remainingWork, openRcas });
  } catch (error) {
    const exitBlockEvent = { at: now(), action: 'EXIT_LOCK_BLOCKED', sha, reason: String(error?.message ?? error), requiredState: 'CANONICAL_GREEN_ONLY', taskRemainsOpen: true, recovery: 'RECOVER_AND_CONTINUE', workEvent: false };
    appendEvent(record, exitBlockEvent);
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
    const visibilityFile = visibilityPath(sessionId);
    if (fs.existsSync(visibilityFile)) {
      const visibility = JSON.parse(fs.readFileSync(visibilityFile, 'utf8'));
      visibility.activity = Array.isArray(visibility.activity) ? [...visibility.activity, exitBlockEvent] : [exitBlockEvent];
      visibility.lastEvent = exitBlockEvent;
      visibility.status = 'RUNNING';
      visibility.visibilityState = 'OPEN';
      visibility.exitLock = { state: 'LOCKED', reason: exitBlockEvent.reason, exactSha: sha, updatedAt: now() };
      visibility.updatedAt = now();
      fs.writeFileSync(visibilityFile, JSON.stringify(visibility, null, 2) + '\n');
    }
    throw error;
  }
  if (record.bootstrap && !record.continuationFrom) {
    // First session may bootstrap the chain, but its logout still establishes the handoff contract.
  }

  let releasedChair = null;
  if (activeBeforeClose) {
    releasedChair = endChairWork({ agentId: record.agentId, targetSha: sha, successful: status === 'VERIFIED', sessionId: record.sessionId, taskId: record.taskId });
  }
  record.chairBinding = { ...record.chairBinding, released: true, releasedAt: now(), releasedChairId: activeBeforeClose?.chairId ?? record.chairBinding?.chairId ?? null, releaseReason: activeBeforeClose ? 'SESSION_TASK_COMPLETED' : 'TASK_ALREADY_RELEASED' };
  record.status = status;
  record.exitSha = sha;
  record.finishedAt = now();
  record.changedFiles = changedFiles;
  record.commands = commands;
  record.evidence = evidence;
  record.findings = findings;
  record.rcaClosed = rcaClosed;
  record.openRcas = openRcas;
  record.handoff = handoffToNextAgent;
  record.cycleLessons = cycleLessons;
  record.finalSummary = finalSummary;
  record.finalStatus = status;
  record.taskId = taskId;
  record.completedWork = completedWork;
  record.failedWork = failedWork;
  record.remainingWork = remainingWork;
  record.executionPlanNext = executionPlanNext;
  record.blockers = blockers;
  record.actions = Array.isArray(record.actions) ? [...record.actions, { at: now(), action: 'LOGOUT', sha, status }] : [{ at: now(), action: 'LOGOUT', sha, status }];
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);

  writeVisibility({ schemaVersion: 1, authority: 'AGENT_VISIBILITY_LEDGER', visibilityState: 'CLOSED', taskId, sessionId: record.sessionId, agentId: record.agentId, role: record.role, entrySha: record.entrySha, exitSha: sha, status, finalStatus: status, finalSummary, scope: record.scope, currentRca: record.currentRca, rcaClosed, openRcas, changedFiles, commands, evidence, findings, activity, lastEvent: activity.at(-1) ?? null, completedWork, failedWork, remainingWork, executionPlanNext, blockers, handoffToNextAgent, cycleLessons, continuationFrom: record.continuationFrom ?? null, inheritedExitSha: record.inheritedExitSha ?? null, startedAt: record.startedAt, updatedAt: now() });

  const report = {
    schemaVersion: 1,
    ...(record.messageId ? { messageId: record.messageId, messageEntrySha: record.messageEntrySha, messageStatus: 'HANDOFF_VISIBLE' } : {}),
    reportId: `${sessionId}:${sha}`,
    sessionId: record.sessionId,
    agentId: record.agentId,
    role: record.role,
    taskId,
    finalSummary,
    visibilityPath: path.relative(ROOT, visibilityPath(sessionId)),
    entrySha: record.entrySha,
    exitSha: sha,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    status,
    scope: record.scope,
    currentRca: record.currentRca,
    rcaClosed,
    openRcas,
    changedFiles,
    commands,
    evidence,
    findings,
    completedWork,
    failedWork,
    remainingWork,
    executionPlanNext,
    blockers,
    cycleLessons,
    handoffToNextAgent,
    continuationFrom: record.continuationFrom ?? null,
    inheritedExitSha: record.inheritedExitSha ?? null,
  };
  fs.writeFileSync(handoffPath(sessionId), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });

  console.log(`AGENT_SESSION_LOGOUT=${sessionId}`);
  console.log(`AGENT_SESSION_SHA=${sha}`);
  console.log(`AGENT_SESSION_STATUS=${status}`);
  console.log(`AGENT_SESSION_HANDOFF=${path.relative(ROOT, handoffPath(sessionId))}`);
}
