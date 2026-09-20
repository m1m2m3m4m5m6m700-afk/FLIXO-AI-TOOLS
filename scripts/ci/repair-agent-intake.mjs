#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const arg = (name, fallback = '') => {
  const prefix = '--' + name + '=';
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : String(fallback);
};
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

const runId = arg('run-id');
const workflow = arg('workflow');
const failedSha = arg('failed-sha');
const branch = arg('branch', 'execution');
const conclusion = arg('conclusion', 'failure');
const currentSha = arg('current-sha');
const logPath = arg('log');
const evidencePath = arg('evidence', '/tmp/repair-agent-intake/incident.json');

if (!runId || !workflow || !/^[a-f0-9]{40}$/.test(failedSha) || !/^[a-f0-9]{40}$/.test(currentSha)) throw new Error('REPAIR_AGENT_INTAKE_IDENTITY_INVALID');
if (!['main', 'execution'].includes(branch)) throw new Error('REPAIR_AGENT_INTAKE_BRANCH_INVALID');

const rawLog = read(logPath);
const logDigest = sha256(rawLog);
const incidentId = 'incident:' + branch + ':' + failedSha.slice(0, 12) + ':' + runId;
const failureFingerprint = sha256([workflow, conclusion, branch, failedSha, rawLog.replace(/\r/g, '').trim().slice(-24000)].join('\n'));
const providerLike = /(rate limit|429|too many requests|CAPIError|model is not supported|vercel\.com|cloudflare|upstream provider|service unavailable|timeout contacting provider)/iu.test(rawLog);
const severity = conclusion === 'action_required' ? 'HIGH' : providerLike ? 'MEDIUM' : 'HIGH';

const incident = {
  schemaVersion: 1,
  authority: 'REPAIR_AGENT_ERROR_INTAKE',
  incidentId,
  actor: 'repairAgent',
  role: 'ERROR_GATEWAY',
  capturedAt: new Date().toISOString(),
  trigger: 'workflow_run.completed',
  runId: String(runId),
  workflow,
  conclusion,
  branch,
  failedSha,
  observedCurrentSha: currentSha,
  staleTarget: failedSha !== currentSha,
  failureFingerprint,
  severity,
  classification: providerLike ? 'POSSIBLE_EXTERNAL_PROVIDER' : 'POSSIBLE_INTERNAL_REPOSITORY_FAILURE',
  log: { captured: Boolean(rawLog), sha256: logDigest, bytes: Buffer.byteLength(rawLog, 'utf8'), path: logPath || null, tail: rawLog.slice(-12000) },
  councilRouting: {
    recipient: 'ALL_AGENTS',
    intent: 'ERROR_INGESTION_AND_COUNCIL_REVIEW',
    requiredActions: [
      'Review the captured incident before unrelated work.',
      'Error Agent owns RCA and falsification.',
      'Authorized repair/execution owner revalidates the exact SHA and acquires ownership before mutation.',
      'External/provider failures remain infrastructure blockers unless source evidence proves otherwise.',
      'Verified outcome must update learning; failed or blocked repair must update anti-learning.',
    ],
  },
  noOtherAgentLogWatchingRequired: true,
  evidenceRefs: ['actions/run/' + runId, 'commit/' + failedSha, 'log-sha256/' + logDigest],
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, JSON.stringify(incident, null, 2) + '\n');

const message = {
  schemaVersion: 1,
  messageId: incidentId,
  idempotencyKey: incidentId,
  actor: 'repairAgent',
  recipient: 'ALL_AGENTS',
  intent: 'ERROR_INGESTION_AND_COUNCIL_REVIEW',
  taskId: incidentId,
  scope: ['incident-intake', 'root-cause-analysis', 'verification'],
  entrySha: currentSha,
  risk: severity,
  dependencies: ['repair-agent-intake', 'exact failed run identity'],
  expectedEvidence: ['failure log', 'failed SHA', 'RCA chain', 'falsification', 'next action'],
  stopConditions: ['stale target requires SHA revalidation', 'conflicting evidence', 'security-critical ambiguity'],
  proofObligations: ['exact-SHA provenance', 'council receipt', 'RCA ownership', 'learning outcome'],
  createdAt: incident.capturedAt,
  source: 'REPAIR_AGENT_ERROR_GATEWAY',
  payload: incident,
};

console.log(JSON.stringify({
  incident,
  message,
  issueComment: [
    '### REPAIR AGENT — ERROR INTAKE',
    '',
    '**Incident:** `' + incidentId + '`',
    '**Workflow:** `' + workflow + '`',
    '**Conclusion:** `' + conclusion + '`',
    '**Branch:** `' + branch + '`',
    '**Failed SHA:** `' + failedSha + '`',
    '**Current SHA:** `' + currentSha + '`',
    '**Fingerprint:** `' + failureFingerprint + '`',
    '**Classification:** `' + incident.classification + '`',
    '',
    'The Repair Agent gateway captured this error and routed it to the Agent Council. Other agents do not need to poll GitHub Actions logs.',
    '',
    '<!-- FLIXO_AGENT_MESSAGE -->',
    '```json',
    JSON.stringify(message, null, 2),
    '```',
    '<!-- repair-agent-incident:' + incidentId + ' -->',
  ].join('\n'),
}, null, 2));