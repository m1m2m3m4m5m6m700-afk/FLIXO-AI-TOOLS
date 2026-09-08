#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith('--')) continue;
  const key = token.slice(2).split('=')[0];
  const value = token.includes('=') ? token.slice(token.indexOf('=') + 1) : process.argv[i + 1];
  args.set(key, value ?? null);
}

const command = String(process.argv[2] ?? '').toLowerCase();
const sessionsDir = path.resolve(ROOT, 'diagnostics/agents/sessions');
const sessionId = String(args.get('session') ?? process.env.FLIXO_AGENT_SESSION ?? '').trim();
const agentId = String(args.get('agent') ?? process.env.FLIXO_AGENT_ID ?? '').trim();
const role = String(args.get('role') ?? process.env.FLIXO_AGENT_ROLE ?? 'implementation').trim();
const rca = String(args.get('rca') ?? process.env.FLIXO_AGENT_RCA ?? '').trim() || null;
const scope = String(args.get('scope') ?? process.env.FLIXO_AGENT_SCOPE ?? '').split(',').map((v) => v.trim()).filter(Boolean);
const now = () => new Date().toISOString();
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const requiredReads = [
  'AGENTS.md',
  'docs/AGENT-COLLABORATION-PROTOCOL.md',
  'docs/MINIMAL-CI-FINAL-ARCHITECTURE.md',
  'scripts/ci/test-plan.json',
  'scripts/ci/assertion-registry.json',
];

if (!['login', 'logout'].includes(command)) {
  console.error('Usage: node scripts/ci/agent-session.mjs login|logout --session=<id> --agent=<id> --role=<role> [--rca=<id>] [--scope=a,b]');
  process.exit(2);
}
if (!sessionId || !agentId) throw new Error('Agent login requires --session and --agent.');
if (!['analysis', 'implementation', 'verification', 'release'].includes(role)) throw new Error(`Invalid role: ${role}`);
if (command === 'login') {
  const missing = requiredReads.filter((file) => !fs.existsSync(path.resolve(ROOT, file)));
  if (missing.length) throw new Error(`Mandatory protocol files missing: ${missing.join(', ')}`);
  mkdirp(sessionsDir);
  const currentSha = git(['rev-parse', 'HEAD']);
  const file = path.join(sessionsDir, `${sessionId}.json`);
  if (fs.existsSync(file)) throw new Error(`Session already exists: ${file}`);
  const record = {
    schemaVersion: 1,
    sessionId,
    agentId,
    role,
    entrySha: currentSha,
    baseSha: currentSha,
    startedAt: now(),
    scope,
    readFiles: requiredReads,
    currentRca: rca,
    status: 'RUNNING',
    actions: [{ at: now(), action: 'LOGIN', sha: currentSha }],
  };
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`AGENT_SESSION_LOGIN=${sessionId}`);
  console.log(`AGENT_SESSION_SHA=${currentSha}`);
  console.log(`AGENT_SESSION_FILE=${path.relative(ROOT, file)}`);
} else {
  const file = path.join(sessionsDir, `${sessionId}.json`);
  if (!fs.existsSync(file)) throw new Error(`Session not found: ${file}`);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  const exitSha = git(['rev-parse', 'HEAD']);
  const status = String(args.get('status') ?? process.env.FLIXO_AGENT_STATUS ?? 'VERIFIED').toUpperCase();
  if (!['VERIFIED', 'BLOCKED'].includes(status)) throw new Error(`Logout status must be VERIFIED or BLOCKED; got ${status}`);
  record.status = status;
  record.exitSha = exitSha;
  record.finishedAt = now();
  record.changedFiles = String(args.get('changed') ?? process.env.FLIXO_AGENT_CHANGED_FILES ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  record.commands = String(args.get('commands') ?? process.env.FLIXO_AGENT_COMMANDS ?? '').split('|').map((v) => v.trim()).filter(Boolean);
  record.evidence = String(args.get('evidence') ?? process.env.FLIXO_AGENT_EVIDENCE ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  record.findings = String(args.get('findings') ?? process.env.FLIXO_AGENT_FINDINGS ?? '').split('|').map((v) => v.trim()).filter(Boolean);
  record.rcaClosed = String(args.get('rca-closed') ?? process.env.FLIXO_AGENT_RCA_CLOSED ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  record.openRcas = String(args.get('open-rcas') ?? process.env.FLIXO_AGENT_OPEN_RCAS ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  record.handoff = String(args.get('handoff') ?? process.env.FLIXO_AGENT_HANDOFF ?? '').trim() || null;
  record.actions = Array.isArray(record.actions) ? [...record.actions, { at: now(), action: 'LOGOUT', sha: exitSha, status }] : [{ at: now(), action: 'LOGOUT', sha: exitSha, status }];
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`AGENT_SESSION_LOGOUT=${sessionId}`);
  console.log(`AGENT_SESSION_SHA=${exitSha}`);
  console.log(`AGENT_SESSION_STATUS=${status}`);
}

function mkdirp(dir) { fs.mkdirSync(dir, { recursive: true }); }
