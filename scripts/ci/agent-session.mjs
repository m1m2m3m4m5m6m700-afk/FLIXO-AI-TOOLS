#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
const sessionId = String(args.get('session') ?? process.env.FLIXO_AGENT_SESSION ?? '').trim();
const agentId = String(args.get('agent') ?? process.env.FLIXO_AGENT_ID ?? '').trim();
const role = String(args.get('role') ?? process.env.FLIXO_AGENT_ROLE ?? 'implementation').trim();
const rca = String(args.get('rca') ?? process.env.FLIXO_AGENT_RCA ?? '').trim() || null;
const scope = String(args.get('scope') ?? process.env.FLIXO_AGENT_SCOPE ?? '').split(',').map((v) => v.trim()).filter(Boolean);
const fromSession = String(args.get('from-session') ?? process.env.FLIXO_AGENT_FROM_SESSION ?? '').trim() || null;
const sessionDir = path.resolve(ROOT, 'diagnostics/agents/sessions');
const handoffDir = path.resolve(ROOT, 'diagnostics/agents/handoffs');
const now = () => new Date().toISOString();
const gitSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const requiredReads = ['AGENTS.md', 'docs/AGENT-COLLABORATION-PROTOCOL.md', 'docs/AGENT-HANDOFF-REPORT-SCHEMA.md', 'docs/MINIMAL-CI-FINAL-ARCHITECTURE.md', 'scripts/ci/test-plan.json', 'scripts/ci/assertion-registry.json'];
const split = (value, separator = ',') => String(value ?? '').split(separator).map((v) => v.trim()).filter(Boolean);
const sessionPath = (id) => path.join(sessionDir, `${id}.json`);
const handoffPath = (id) => path.join(handoffDir, `${id}.json`);

if (!['login', 'logout'].includes(command)) throw new Error('Usage: agent-session.mjs login|logout --session=<id> --agent=<id> [--role=analysis|implementation|verification|release] [--rca=<id>] [--scope=a,b] [--from-session=<previous-id>]');
if (!sessionId || !agentId) throw new Error('Agent session requires --session and --agent.');
if (!['analysis', 'implementation', 'verification', 'release'].includes(role)) throw new Error(`Invalid agent role: ${role}`);

fs.mkdirSync(sessionDir, { recursive: true });
fs.mkdirSync(handoffDir, { recursive: true });
const file = sessionPath(sessionId);

if (command === 'login') {
  if (fs.existsSync(file)) throw new Error(`Session already exists: ${sessionId}`);
  const missing = requiredReads.filter((entry) => !fs.existsSync(path.resolve(ROOT, entry)));
  if (missing.length) throw new Error(`Mandatory reads missing: ${missing.join(', ')}`);

  const existingHandoffs = fs.readdirSync(handoffDir).filter((entry) => entry.endsWith('.json'));
  let continuation = null;
  if (fromSession) {
    const predecessorFile = handoffPath(fromSession);
    if (!fs.existsSync(predecessorFile)) throw new Error(`Previous handoff report not found: ${fromSession}`);
    const predecessor = JSON.parse(fs.readFileSync(predecessorFile, 'utf8'));
    if (!['VERIFIED', 'BLOCKED'].includes(predecessor.status)) throw new Error(`Previous session is not closed: ${fromSession}`);
    continuation = {
      continuationFrom: fromSession,
      inheritedExitSha: predecessor.exitSha ?? null,
      inheritedRemainingWork: Array.isArray(predecessor.remainingWork) ? predecessor.remainingWork : [],
      inheritedOpenRcas: Array.isArray(predecessor.openRcas) ? predecessor.openRcas : [],
      inheritedNextPlan: Array.isArray(predecessor.executionPlanNext) ? predecessor.executionPlanNext : [],
      predecessorReport: path.relative(ROOT, predecessorFile),
    };
  } else if (existingHandoffs.length > 0 && args.get('bootstrap') !== 'true') {
    throw new Error('Continuation handoff required: use --from-session=<previous-session> or explicitly declare --bootstrap=true.');
  }

  const sha = gitSha();
  const record = {
    schemaVersion: 2,
    sessionId,
    agentId,
    role,
    entrySha: sha,
    baseSha: sha,
    startedAt: now(),
    scope,
    readFiles: [...requiredReads],
    currentRca: rca,
    status: 'RUNNING',
    bootstrap: !continuation,
    ...(continuation ?? {}),
    actions: [{ at: now(), action: 'LOGIN', sha, ...(continuation ? { fromSession } : {}) }],
  };
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  console.log(`AGENT_SESSION_LOGIN=${sessionId}`);
  console.log(`AGENT_SESSION_SHA=${sha}`);
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
  const changedFiles = split(args.get('changed') ?? process.env.FLIXO_AGENT_CHANGED_FILES);
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
  if (remainingWork.length === 0 && openRcas.length > 0) {
    throw new Error('Open RCAs exist but remaining-work is empty; session report must preserve unresolved work.');
  }
  if (status === 'VERIFIED' && (failedWork.length > 0 || remainingWork.length > 0 || openRcas.length > 0)) {
    throw new Error('VERIFIED logout requires no failed work, remaining work, or open RCAs; use BLOCKED until continuation work is closed.');
  }
  if (status === 'BLOCKED' && remainingWork.length === 0 && failedWork.length === 0 && openRcas.length === 0) {
    throw new Error('BLOCKED logout requires an explicit unresolved item.');
  }
  if (record.bootstrap && !record.continuationFrom) {
    // First session may bootstrap the chain, but its logout still establishes the handoff contract.
  }

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
  record.completedWork = completedWork;
  record.failedWork = failedWork;
  record.remainingWork = remainingWork;
  record.executionPlanNext = executionPlanNext;
  record.blockers = blockers;
  record.actions = Array.isArray(record.actions) ? [...record.actions, { at: now(), action: 'LOGOUT', sha, status }] : [{ at: now(), action: 'LOGOUT', sha, status }];
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);

  const report = {
    schemaVersion: 1,
    reportId: `${sessionId}:${sha}`,
    sessionId: record.sessionId,
    agentId: record.agentId,
    role: record.role,
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
