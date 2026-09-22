#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const INBOX_DIR = path.resolve(ROOT, 'diagnostics/guard/inbox');
const INDEX_FILE = path.join(INBOX_DIR, 'index.json');
const SHA_RE = /^[0-9a-f]{40}$/iu;
const HASH_RE = /^[0-9a-f]{64}$/iu;
const GUARD_ID = 'CHAIR_1_GUARD';
const PROTOCOL = 'FLIXO-GUARD-CHANGE-REPORT-v1';
const now = () => new Date().toISOString();
const gitSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value), 'utf8').digest('hex');
const safeId = (value, label) => {
  const v = String(value ?? '').trim();
  if (!v || v.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(v)) throw new Error(`GUARD_CHANGE_INVALID_${label.toUpperCase()}`);
  return v;
};
const readJson = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const ensure = () => fs.mkdirSync(INBOX_DIR, { recursive: true });
const reportPath = (reportId) => path.join(INBOX_DIR, `${hash(reportId)}.json`);
const loadIndex = () => readJson(INDEX_FILE, { schemaVersion: 1, authority: GUARD_ID, reports: {} });
const saveIndex = (index) => { index.updatedAt = now(); writeJson(INDEX_FILE, index); };

const asNonEmptyArray = (value, label) => {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`GUARD_CHANGE_${label.toUpperCase()}_REQUIRED`);
  return value.map((item) => String(item).trim()).filter(Boolean);
};

export function validateChangeReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('GUARD_CHANGE_REPORT_INVALID');
  if (report.protocol !== PROTOCOL) throw new Error('GUARD_CHANGE_PROTOCOL_INVALID');
  safeId(report.reportId, 'report_id');
  safeId(report.agentId, 'agent_id');
  safeId(report.taskId, 'task_id');
  if (report.recipient !== GUARD_ID) throw new Error('GUARD_CHANGE_RECIPIENT_INVALID');
  if (!SHA_RE.test(String(report.entrySha ?? ''))) throw new Error('GUARD_CHANGE_ENTRY_SHA_INVALID');
  if (!SHA_RE.test(String(report.executionShaAtEntry ?? ''))) throw new Error('GUARD_CHANGE_EXECUTION_SHA_INVALID');
  if (!SHA_RE.test(String(report.mainShaAtEntry ?? ''))) throw new Error('GUARD_CHANGE_MAIN_SHA_INVALID');
  if (report.currentWorkspaceSha != null && !SHA_RE.test(String(report.currentWorkspaceSha))) throw new Error('GUARD_CHANGE_WORKSPACE_SHA_INVALID');
  if (report.patchSha256 != null && !HASH_RE.test(String(report.patchSha256))) throw new Error('GUARD_CHANGE_PATCH_SHA_INVALID');
  if (!['READY_FOR_CHAIR1','BLOCKED_FOR_CHAIR1','PARTIAL'].includes(String(report.resultStatus))) throw new Error('GUARD_CHANGE_RESULT_STATUS_INVALID');
  if (!['LOW','MEDIUM','HIGH','CRITICAL'].includes(String(report.risk))) throw new Error('GUARD_CHANGE_RISK_INVALID');
  const changedFiles = asNonEmptyArray(report.changedFiles, 'changed_files');
  const details = asNonEmptyArray(report.changeDetails, 'change_details');
  const evidence = Array.isArray(report.evidence) ? report.evidence.map(String).filter(Boolean) : [];
  const remainingWork = Array.isArray(report.remainingWork) ? report.remainingWork.map(String).filter(Boolean) : [];
  const blockers = Array.isArray(report.blockers) ? report.blockers.map(String).filter(Boolean) : [];
  const nextActions = Array.isArray(report.nextActions) ? report.nextActions.map(String).filter(Boolean) : [];
  if (!report.createdAt || Number.isNaN(Date.parse(String(report.createdAt)))) throw new Error('GUARD_CHANGE_CREATED_AT_INVALID');
  if (!report.authority || String(report.authority) !== 'CHAIR_1_FINAL_AGGREGATION_AND_PUBLICATION') throw new Error('GUARD_CHANGE_AUTHORITY_INVALID');
  return Object.freeze({
    schemaVersion: Number(report.schemaVersion ?? 1),
    protocol: PROTOCOL,
    reportId: String(report.reportId),
    idempotencyKey: String(report.idempotencyKey ?? report.reportId),
    agentId: String(report.agentId),
    recipient: GUARD_ID,
    intent: String(report.intent ?? 'AGENT_CHANGE_REPORT'),
    taskId: String(report.taskId),
    entrySha: String(report.entrySha),
    executionShaAtEntry: String(report.executionShaAtEntry),
    mainShaAtEntry: String(report.mainShaAtEntry),
    currentWorkspaceSha: report.currentWorkspaceSha == null ? null : String(report.currentWorkspaceSha),
    risk: String(report.risk),
    resultStatus: String(report.resultStatus),
    changedFiles,
    changeDetails: details,
    patchSha256: report.patchSha256 == null ? null : String(report.patchSha256),
    candidateSha: report.candidateSha == null ? null : String(report.candidateSha),
    resultId: report.resultId == null ? null : String(report.resultId),
    handoffReportPath: report.handoffReportPath == null ? null : String(report.handoffReportPath),
    summary: String(report.summary ?? '').slice(0, 8000),
    evidence,
    remainingWork,
    blockers,
    nextActions,
    publicationAuthority: 'CHAIR_1',
    editableBy: 'CHAIR_1',
    createdAt: String(report.createdAt),
    source: String(report.source ?? 'AGENT_SESSION'),
    payload: report.payload ?? null,
  });
}

export function createChangeReport({
  agentId,
  taskId,
  entrySha,
  executionShaAtEntry,
  mainShaAtEntry,
  changedFiles,
  changeDetails,
  patchSha256=null,
  candidateSha=null,
  currentWorkspaceSha=null,
  resultId=null,
  resultStatus='READY_FOR_CHAIR1',
  risk='HIGH',
  summary='',
  evidence=[],
  remainingWork=[],
  blockers=[],
  nextActions=[],
  handoffReportPath=null,
  source='AGENT_SESSION',
  payload=null,
}={}) {
  const input = {
    protocol: PROTOCOL,
    agentId,
    taskId,
    entrySha,
    executionShaAtEntry,
    mainShaAtEntry,
    changedFiles,
    changeDetails,
    patchSha256,
    candidateSha,
    currentWorkspaceSha,
    resultId,
    resultStatus,
    risk,
    summary,
    evidence,
    remainingWork,
    blockers,
    nextActions,
    handoffReportPath,
    source,
  };
  const reportId = `guard-change:${agentId}:${taskId}:${hash({entrySha, patchSha256, changedFiles, resultId}).slice(0, 24)}`;
  return validateChangeReport({
    schemaVersion: 1,
    ...input,
    reportId,
    idempotencyKey: `${reportId}:${entrySha}`,
    recipient: GUARD_ID,
    intent: 'AGENT_CHANGE_REPORT',
    authority: 'CHAIR_1_FINAL_AGGREGATION_AND_PUBLICATION',
    createdAt: now(),
    payload: {
      ...(payload && typeof payload === 'object' ? payload : {}),
      exactShaBinding: 'ENTRY_SNAPSHOT',
      mutationAuthority: 'CHAIR_1_ONLY',
      guardRole: 'RECEIVE_REVIEW_HANDOFF_ONLY',
    },
  });
}

export function ingestChangeReport(report) {
  ensure();
  const normalized = validateChangeReport(report);
  const index = loadIndex();
  const existing = index.reports[normalized.reportId];
  if (existing) {
    if (existing.idempotencyKey !== normalized.idempotencyKey) throw new Error(`GUARD_CHANGE_IDEMPOTENCY_COLLISION=${normalized.reportId}`);
    return { ...existing, duplicate: true };
  }
  const record = {
    ...normalized,
    status: 'RECEIVED',
    receivedAt: now(),
    readAt: null,
    readBy: null,
    decision: null,
    decisionReason: null,
    decisionAt: null,
    decisionBy: null,
  };
  writeJson(reportPath(normalized.reportId), record);
  index.reports[normalized.reportId] = {
    reportId: normalized.reportId,
    idempotencyKey: normalized.idempotencyKey,
    status: record.status,
    agentId: normalized.agentId,
    taskId: normalized.taskId,
    entrySha: normalized.entrySha,
    patchSha256: normalized.patchSha256,
    receivedAt: record.receivedAt,
    updatedAt: record.receivedAt,
  };
  saveIndex(index);
  return record;
}

export function getChangeReport(reportId) {
  ensure();
  safeId(reportId, 'report_id');
  const file = reportPath(reportId);
  if (!fs.existsSync(file)) throw new Error(`GUARD_CHANGE_REPORT_NOT_FOUND=${reportId}`);
  return readJson(file, null);
}

export function listChangeReports({ status=null, taskId=null, agentId=null }={}) {
  ensure();
  const index = loadIndex();
  return Object.values(index.reports).filter((item) =>
    (!status || item.status === status) &&
    (!taskId || item.taskId === taskId) &&
    (!agentId || item.agentId === agentId)
  );
}

export function markRead(reportId, guardAgent=GUARD_ID) {
  const report = getChangeReport(reportId);
  if (guardAgent !== GUARD_ID && guardAgent !== 'MASTER-1' && guardAgent !== 'MASTER-2' && guardAgent !== 'MASTER-3') {
    throw new Error('GUARD_CHANGE_READER_UNAUTHORIZED');
  }
  if (!['RECEIVED','READ'].includes(report.status)) throw new Error(`GUARD_CHANGE_NOT_READABLE=${report.status}`);
  report.status = 'READ';
  report.readAt = report.readAt ?? now();
  report.readBy = guardAgent;
  writeJson(reportPath(reportId), report);
  const index = loadIndex();
  index.reports[reportId] = { ...(index.reports[reportId] ?? {}), status: 'READ', updatedAt: now() };
  saveIndex(index);
  return report;
}

export function decideChangeReport(reportId, {
  guardAgent=GUARD_ID,
  decision='FORWARDED_TO_CHAIR1',
  reason='',
  currentExecutionSha=gitSha(),
}={}) {
  const report = getChangeReport(reportId);
  if (guardAgent !== GUARD_ID && !['MASTER-1','MASTER-2','MASTER-3'].includes(guardAgent)) throw new Error('GUARD_CHANGE_DECIDER_UNAUTHORIZED');
  if (!['READ','RECEIVED'].includes(report.status)) throw new Error(`GUARD_CHANGE_FORWARD_INVALID_STATE=${report.status}`);
  if (String(decision) !== 'FORWARDED_TO_CHAIR1') throw new Error('GUARD_CHANGE_REJECTION_FORBIDDEN');
  if (!SHA_RE.test(String(currentExecutionSha))) throw new Error('GUARD_CHANGE_CURRENT_SHA_INVALID');
  report.status = 'FORWARDED_TO_CHAIR1';
  report.decision = 'FORWARDED_TO_CHAIR1';
  report.decisionReason = String(reason).slice(0, 4000);
  report.decisionAt = now();
  report.decisionBy = guardAgent;
  report.decisionSha = currentExecutionSha;
  report.guardRole = 'RECEIVE_VALIDATE_FORWARD_ONLY';
  report.guardVerdict = {
    exactShaRecorded: true,
    checkedExecutionSha: currentExecutionSha,
    sourceEntrySha: report.entrySha,
    sourceExecutionShaAtEntry: report.executionShaAtEntry,
    patchSha256: report.patchSha256,
    publicationAuthority: 'CHAIR_1',
    contentDecision: 'NONE',
    deletionAuthority: false,
    rejectionAuthority: false,
    greenGranted: false,
  };
  writeJson(reportPath(reportId), report);
  const index = loadIndex();
  index.reports[reportId] = {
    ...(index.reports[reportId] ?? {}),
    status: report.status,
    decision: report.decision,
    decisionBy: report.decisionBy,
    decisionSha: report.decisionSha,
    updatedAt: now(),
  };
  saveIndex(index);
  return report;
}

export function reportAgentChange(args) {
  const report = createChangeReport(args);
  return ingestChangeReport(report);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [, , command, ...rest] = process.argv;
  const args = new Map();
  for (let i=0;i<rest.length;i+=1) {
    const token = rest[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    const key = token.slice(2, eq >= 0 ? eq : undefined);
    const value = eq >= 0 ? token.slice(eq + 1) : process.argv[i + 1];
    args.set(key, value ?? null);
  }
  const arg = (name, fallback='') => String(args.get(name) ?? fallback).trim();
  const list = (name) => arg(name).split('|').map((item)=>item.trim()).filter(Boolean);
  if (command === 'send-change') {
    const report = reportAgentChange({
      agentId: arg('agent'),
      taskId: arg('task'),
      entrySha: arg('entry-sha'),
      executionShaAtEntry: arg('execution-sha-at-entry'),
      mainShaAtEntry: arg('main-sha-at-entry'),
      currentWorkspaceSha: arg('workspace-sha') || null,
      changedFiles: list('changed-files'),
      changeDetails: list('change-details'),
      patchSha256: arg('patch-sha') || null,
      candidateSha: arg('candidate-sha') || null,
      resultId: arg('result-id') || null,
      resultStatus: arg('result-status','READY_FOR_CHAIR1'),
      risk: arg('risk','HIGH'),
      summary: arg('summary'),
      evidence: list('evidence'),
      remainingWork: list('remaining-work'),
      blockers: list('blockers'),
      nextActions: list('next-actions'),
      handoffReportPath: arg('handoff') || null,
      source: arg('source','AGENT_SESSION'),
    });
    console.log(JSON.stringify({ status: report.status, reportId: report.reportId, taskId: report.taskId, agentId: report.agentId }, null, 2));
  } else if (command === 'read') {
    console.log(JSON.stringify(markRead(arg('report-id'), arg('guard-agent', GUARD_ID)), null, 2));
  } else if (command === 'list') {
    console.log(JSON.stringify(listChangeReports({ status: arg('status') || null, taskId: arg('task') || null, agentId: arg('agent') || null }), null, 2));
  } else if (command === 'forward') {
    console.log(JSON.stringify(decideChangeReport(arg('report-id'), {
      guardAgent: arg('guard-agent', GUARD_ID),
      decision: arg('decision'),
      reason: arg('reason'),
      currentExecutionSha: arg('execution-sha', gitSha()),
    }), null, 2));
  } else {
    throw new Error('Usage: guard-communication.mjs send-change|read|list|forward');
  }
}
