import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const CLAIMS_FILE = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const SESSIONS_FILE = process.env.FLIXO_AGENT_SESSIONS_FILE ?? 'scripts/ci/active-sessions.json';
const EVIDENCE_FILE = process.env.FLIXO_AGENT_SESSION_EVIDENCE ?? 'artifacts/ci/agent-coordination/session-guard.json';
const EXPECTED_HEAD_SHA = process.env.EXPECTED_HEAD_SHA ?? process.env.GITHUB_SHA ?? (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
const CURRENT_BRANCH = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? (() => { try { return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
const ENFORCE_WORKTREE_SCOPE = process.env.FLIXO_AGENT_ENFORCE_WORKTREE_SCOPE === '1';
const FAIL = (message) => { throw new Error(`Agent Session Guard failed: ${message}`); };
const HEX_SHA = /^[0-9a-f]{40}$/iu;
const AGENT_BRANCH = /^agent\/[^/]+\/.+$/u;
const normalizePath = (value) => String(value ?? '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '');
const pathConflicts = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const claimsState = await readJson(CLAIMS_FILE);
const sessionsState = await readJson(SESSIONS_FILE);
if (claimsState.schemaVersion !== 2 || claimsState.protocol !== 'FLIXO multi-agent coordination') FAIL('claims schema/protocol mismatch');
if (!Array.isArray(claimsState.claims)) FAIL('claims registry must be an array');
if (!sessionsState || sessionsState.schema_version !== 1 || sessionsState.source_of_truth !== CLAIMS_FILE || !Array.isArray(sessionsState.active_sessions)) FAIL('active sessions projection invalid');
const now = Date.now();
const activeClaims = claimsState.claims.filter((c) => c.status === 'active' && Date.parse(c.leaseUntil) > now);
const projection = new Map(sessionsState.active_sessions.map((s) => [s.agentId, s]));
for (const claim of activeClaims) {
  const session = projection.get(claim.agentId);
  if (!session) FAIL(`missing active session for ${claim.agentId}`);
  if (session.branch !== claim.branch || session.observedHeadSha !== claim.observedHeadSha) FAIL(`session/claim mismatch for ${claim.agentId}`);
  if (JSON.stringify(session.scope ?? {}) !== JSON.stringify(claim.scope ?? {})) FAIL(`session scope mismatch for ${claim.agentId}`);
}
for (const session of sessionsState.active_sessions) if (!activeClaims.some((c) => c.agentId === session.agentId)) FAIL(`session ${session.agentId} is not backed by an active unexpired claim`);
for (let i = 0; i < activeClaims.length; i += 1) for (let j = i + 1; j < activeClaims.length; j += 1) {
  const a = activeClaims[i]; const b = activeClaims[j];
  const path = a.scope.paths.map(normalizePath).some((p) => b.scope.paths.map(normalizePath).some((q) => pathConflicts(p, q)));
  const contract = a.scope.contracts.some((id) => b.scope.contracts.includes(id));
  const rootCause = a.rootCauseIds.some((id) => b.rootCauseIds.includes(id));
  if (path || contract || rootCause) FAIL(`active collision ${a.agentId}<->${b.agentId}: path=${path} contract=${contract} rootCause=${rootCause}`);
}
if (AGENT_BRANCH.test(CURRENT_BRANCH)) {
  const own = activeClaims.filter((claim) => claim.branch === CURRENT_BRANCH);
  if (own.length !== 1) FAIL(`agent branch ${CURRENT_BRANCH} requires exactly one active claim, found ${own.length}`);
  if (!HEX_SHA.test(EXPECTED_HEAD_SHA) || own[0].observedHeadSha !== EXPECTED_HEAD_SHA) FAIL(`exact SHA mismatch for ${own[0].agentId}: claim=${own[0].observedHeadSha} expected=${EXPECTED_HEAD_SHA || '<unset>'}`);
  if (ENFORCE_WORKTREE_SCOPE) {
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
    const changed = status.split('\n').filter(Boolean).map((line) => normalizePath(line.slice(3).replace(/ -> .+$/u, '')));
    for (const path of changed) if (!own[0].scope.paths.some((allowed) => pathConflicts(path, normalizePath(allowed)))) FAIL(`worktree path outside claimed scope: ${path}`);
  }
}
const report = { schemaVersion: 2, protocol: 'FLIXO agent session guard', generatedAt: new Date().toISOString(), branch: CURRENT_BRANCH, expectedHeadSha: EXPECTED_HEAD_SHA || null, activeClaimCount: activeClaims.length, activeAgentIds: activeClaims.map((c) => c.agentId).sort(), worktreeScopeEnforced: ENFORCE_WORKTREE_SCOPE, status: 'PASS' };
report.reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await writeFile(EVIDENCE_FILE, JSON.stringify(report, null, 2) + '\n');
console.log(`Agent Session Guard PASS: activeSessions=${sessionsState.active_sessions.length} activeClaims=${activeClaims.length}`);
console.log(`reportHash=${report.reportHash}`);
