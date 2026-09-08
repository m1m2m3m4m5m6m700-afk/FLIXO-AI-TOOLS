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
const sessionDir = path.resolve(ROOT, 'diagnostics/agents/sessions');
const now = () => new Date().toISOString();
const gitSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const requiredReads = ['AGENTS.md', 'docs/AGENT-COLLABORATION-PROTOCOL.md', 'docs/MINIMAL-CI-FINAL-ARCHITECTURE.md', 'scripts/ci/test-plan.json', 'scripts/ci/assertion-registry.json'];

if (!['login', 'logout'].includes(command)) throw new Error('Usage: agent-session.mjs login|logout --session=<id> --agent=<id> [--role=analysis|implementation|verification|release] [--rca=<id>] [--scope=a,b]');
if (!sessionId || !agentId) throw new Error('Agent session requires --session and --agent.');
if (!['analysis', 'implementation', 'verification', 'release'].includes(role)) throw new Error(`Invalid agent role: ${role}`);

fs.mkdirSync(sessionDir, { recursive: true });
const file = path.join(sessionDir, `${sessionId}.json`);

if (command === 'login') {
  if (fs.existsSync(file)) throw new Error(`Session already exists: ${sessionId}`);
  const missing = requiredReads.filter((entry) => !fs.existsSync(path.resolve(ROOT, entry)));
  if (missing.length) throw new Error(`Mandatory reads missing: ${missing.join(', ')}`);
  const sha = gitSha();
  const record = {
    schemaVersion: 1,
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
    actions: [{ at: now(), action: 'LOGIN', sha }],
  };
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  console.log(`AGENT_SESSION_LOGIN=${sessionId}`);
  console.log(`AGENT_SESSION_SHA=${sha}`);
  console.log(`AGENT_SESSION_FILE=${path.relative(ROOT, file)}`);
} else {
  if (!fs.existsSync(file)) throw new Error(`Session not found: ${sessionId}`);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  const status = String(args.get('status') ?? process.env.FLIXO_AGENT_STATUS ?? 'VERIFIED').toUpperCase();
  if (!['VERIFIED', 'BLOCKED'].includes(status)) throw new Error(`Logout status must be VERIFIED or BLOCKED; got ${status}`);
  const sha = gitSha();
  record.status = status;
  record.exitSha = sha;
  record.finishedAt = now();
  record.changedFiles = String(args.get('changed') ?? process.env.FLIXO_AGENT_CHANGED_FILES ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  record.commands = String(args.get('commands') ?? process.env.FLIXO_AGENT_COMMANDS ?? '').split('|').map((v) => v.trim()).filter(Boolean);
  record.evidence = String(args.get('evidence') ?? process.env.FLIXO_AGENT_EVIDENCE ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  record.findings = String(args.get('findings') ?? process.env.FLIXO_AGENT_FINDINGS ?? '').split('|').map((v) => v.trim()).filter(Boolean);
  record.rcaClosed = String(args.get('rca-closed') ?? process.env.FLIXO_AGENT_RCA_CLOSED ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  record.openRcas = String(args.get('open-rcas') ?? process.env.FLIXO_AGENT_OPEN_RCAS ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  record.handoff = String(args.get('handoff') ?? process.env.FLIXO_AGENT_HANDOFF ?? '').trim() || null;
  record.actions = Array.isArray(record.actions) ? [...record.actions, { at: now(), action: 'LOGOUT', sha, status }] : [{ at: now(), action: 'LOGOUT', sha, status }];
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`AGENT_SESSION_LOGOUT=${sessionId}`);
  console.log(`AGENT_SESSION_SHA=${sha}`);
  console.log(`AGENT_SESSION_STATUS=${status}`);
}
