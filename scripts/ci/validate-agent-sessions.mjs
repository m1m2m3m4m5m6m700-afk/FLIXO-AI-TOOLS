import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const SESSIONS_FILE = process.env.FLIXO_AGENT_SESSIONS_FILE ?? 'scripts/ci/active-sessions.json';
const CLAIMS_FILE = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const EVIDENCE_FILE = process.env.FLIXO_AGENT_SESSIONS_EVIDENCE ?? 'artifacts/ci/agent-coordination/sessions.json';
const readGitValue = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const BRANCH = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? readGitValue(['branch', '--show-current']);
const SHA = process.env.EXPECTED_HEAD_SHA ?? process.env.GITHUB_SHA ?? readGitValue(['rev-parse', 'HEAD']);
const AGENT_BRANCH = /^agent\/[^/]+\/.+$/u;
const HEX_SHA = /^[0-9a-f]{40}$/iu;

const fail = (message) => {
  throw new Error(`AGENT_SESSION_GUARD_FAIL: ${message}`);
};

const normalizePath = (value) => String(value).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '');
const pathConflicts = (left, right) => {
  const a = normalizePath(left);
  const b = normalizePath(right);
  return Boolean(a && b && (a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)));
};
const changedPaths = () => {
  if (!process.env.FLIXO_AGENT_ENFORCE_WORKTREE_SCOPE || !AGENT_BRANCH.test(BRANCH)) return [];
  const raw = readGitValue(['status', '--porcelain=v1', '--untracked-files=all']);
  return raw.split(/\r?\n/u).filter(Boolean).map((line) => {
    const payload = line.slice(3);
    const rename = payload.indexOf(' -> ');
    return normalizePath(rename >= 0 ? payload.slice(rename + 4) : payload);
  }).filter(Boolean);
};

let sessions;
let claims;
try {
  sessions = JSON.parse(await readFile(SESSIONS_FILE, 'utf8'));
  claims = JSON.parse(await readFile(CLAIMS_FILE, 'utf8'));
} catch (error) {
  fail(`required ledger unreadable: ${error instanceof Error ? error.message : String(error)}`);
}

if (sessions?.schema_version !== 1 || sessions?.protocol !== 'FLIXO active agent sessions') fail('active session ledger schema/protocol invalid');
if (sessions?.source_of_truth !== CLAIMS_FILE) fail(`active session ledger must declare ${CLAIMS_FILE} as source_of_truth`);
if (!Array.isArray(sessions?.active_sessions)) fail('active_sessions must be an array');
if (claims?.schemaVersion !== 1 || claims?.protocol !== 'FLIXO multi-agent coordination') fail('claims registry schema/protocol invalid');
if (!Array.isArray(claims?.claims)) fail('claims registry claims must be an array');

const now = Date.now();
const activeClaims = claims.claims.filter((claim) => {
  if (!claim || claim.status !== 'active') return false;
  const until = Date.parse(claim.leaseUntil ?? '');
  return Number.isFinite(until) && until > now;
});

const activeSessionMap = new Map();
for (const session of sessions.active_sessions) {
  if (!session || typeof session !== 'object') fail('active_sessions contains a non-object entry');
  if (typeof session.agent_id !== 'string' || !session.agent_id.trim()) fail('session missing agent_id');
  if (typeof session.branch !== 'string' || !session.branch.trim()) fail(`${session.agent_id} missing branch`);
  if (!AGENT_BRANCH.test(session.branch)) fail(`${session.agent_id} branch must match agent/<agentId>/<work-id>`);
  if (typeof session.started_at !== 'string' || !Number.isFinite(Date.parse(session.started_at))) fail(`${session.agent_id} started_at invalid`);
  if (!Array.isArray(session.claimed_paths) || !Array.isArray(session.claimed_contracts)) fail(`${session.agent_id} claimed scope arrays missing`);
  if (activeSessionMap.has(session.agent_id)) fail(`duplicate active session ${session.agent_id}`);
  activeSessionMap.set(session.agent_id, session);
}

for (const claim of activeClaims) {
  const session = activeSessionMap.get(claim.agentId);
  if (!session) fail(`active claim ${claim.agentId} has no active session entry`);
  if (session.branch !== claim.branch) fail(`${claim.agentId} session branch ${session.branch} != claim branch ${claim.branch}`);
  if (JSON.stringify([...session.claimed_paths].map(normalizePath).sort()) !== JSON.stringify([...claim.scope.paths].map(normalizePath).sort())) fail(`${claim.agentId} path scope drift between session ledger and claims registry`);
  if (JSON.stringify([...session.claimed_contracts].sort()) !== JSON.stringify([...claim.scope.contracts].sort())) fail(`${claim.agentId} contract scope drift between session ledger and claims registry`);
  if ((claim.rootCauseIds ?? []).some((id) => typeof id !== 'string' || !id.trim())) fail(`${claim.agentId} rootCauseIds invalid`);
  if (!HEX_SHA.test(claim.observedHeadSha ?? '')) fail(`${claim.agentId} observedHeadSha invalid`);
}

for (const session of sessions.active_sessions) {
  const claim = activeClaims.find((item) => item.agentId === session.agent_id && item.branch === session.branch);
  if (!claim) fail(`active session ${session.agent_id} lacks a matching unexpired active claim`);
}

for (let i = 0; i < activeClaims.length; i += 1) {
  for (let j = i + 1; j < activeClaims.length; j += 1) {
    const a = activeClaims[i];
    const b = activeClaims[j];
    const pathCollision = a.scope.paths.some((path) => b.scope.paths.some((other) => pathConflicts(path, other)));
    const contractCollision = a.scope.contracts.some((id) => b.scope.contracts.includes(id));
    const rootCauseCollision = (a.rootCauseIds ?? []).some((id) => (b.rootCauseIds ?? []).includes(id));
    if (pathCollision || contractCollision || rootCauseCollision) fail(`AGENT_COLLISION_DETECTED: ${a.agentId} <-> ${b.agentId}`);
  }
}

if (AGENT_BRANCH.test(BRANCH)) {
  const currentClaim = activeClaims.filter((claim) => claim.branch === BRANCH);
  if (currentClaim.length !== 1) fail(`agent branch ${BRANCH} requires exactly one active claim`);
  if (SHA && !HEX_SHA.test(SHA)) fail(`invalid expected SHA ${SHA}`);
  if (SHA && currentClaim[0].observedHeadSha !== SHA) fail(`stale claim SHA ${currentClaim[0].observedHeadSha} != current ${SHA}`);
  const dirtyPaths = changedPaths();
  for (const path of dirtyPaths) {
    const allowed = currentClaim[0].scope.paths.some((claimed) => pathConflicts(claimed, path));
    if (!allowed) fail(`working-tree path ${path} is outside active claim scope`);
  }
}

const report = {
  schema_version: 1,
  protocol: 'FLIXO active agent session guard',
  source_of_truth: CLAIMS_FILE,
  generated_at: new Date().toISOString(),
  branch: BRANCH || null,
  expected_head_sha: SHA || null,
  active_sessions: sessions.active_sessions,
  active_claim_count: activeClaims.length,
  checked_worktree_scope: Boolean(process.env.FLIXO_AGENT_ENFORCE_WORKTREE_SCOPE && AGENT_BRANCH.test(BRANCH)),
  collision_count: 0,
  invariants: [
    'claims registry is authoritative; session ledger is a transparent projection',
    'every active session has exactly one matching unexpired claim',
    'every active claim has exactly one matching session',
    'active writers use isolated agent branches',
    'path, contract, or root-cause overlap is fatal',
    'stale agent claims are rejected',
    'agent worktree changes are restricted to the claimed path scope when hook enforcement is enabled',
    'no external lock database is used',
  ],
};
await mkdir(EVIDENCE_FILE.split('/').slice(0, -1).join('/') || '.', { recursive: true });
report.report_hash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
await writeFile(EVIDENCE_FILE, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`Agent Session Guard PASS: activeSessions=${sessions.active_sessions.length} activeClaims=${activeClaims.length}`);
console.log(`reportHash=${report.report_hash}`);
