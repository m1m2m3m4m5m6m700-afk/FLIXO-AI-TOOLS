import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { replayAgentLedger, normalizePath, overlaps } from './replay-agent-ledger.mjs';

const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const EVIDENCE_FILE = process.env.FLIXO_AGENT_SESSION_EVIDENCE ?? 'artifacts/ci/agent-coordination/session-guard.json';
const EXPECTED_HEAD_SHA = process.env.EXPECTED_HEAD_SHA ?? process.env.GITHUB_SHA ?? (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
const CURRENT_BRANCH = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? (() => { try { return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
const ENFORCE_WORKTREE_SCOPE = process.env.FLIXO_AGENT_ENFORCE_WORKTREE_SCOPE === '1';
const FAIL = (message) => { throw new Error(`Agent Session Guard failed: ${message}`); };
const AGENT_BRANCH = /^agent\/[^/]+\/.+$/u;
if (!EXPECTED_HEAD_SHA) FAIL('current HEAD is unavailable');

const state = replayAgentLedger(await readFile(LEDGER, 'utf8'), { headSha: EXPECTED_HEAD_SHA, signingKey: process.env.FLIXO_SWARM_EVENT_SIGNING_KEY ?? '' });
const activeClaims = [...state.claims.values()].filter((claim) => claim.status === 'active');

for (let i = 0; i < activeClaims.length; i += 1) for (let j = i + 1; j < activeClaims.length; j += 1) {
  const a = activeClaims[i]; const b = activeClaims[j];
  const path = (a.scope?.paths ?? []).some((p) => (b.scope?.paths ?? []).some((q) => overlaps(p, q)));
  const contract = (a.scope?.contracts ?? []).some((id) => (b.scope?.contracts ?? []).includes(id));
  const rootCause = (a.rootCauseIds ?? []).some((id) => (b.rootCauseIds ?? []).includes(id));
  if (path || contract || rootCause) FAIL(`active collision ${a.agentId}<->${b.agentId}: path=${path} contract=${contract} rootCause=${rootCause}`);
}

if (AGENT_BRANCH.test(CURRENT_BRANCH)) {
  const own = activeClaims.filter((claim) => claim.branch === CURRENT_BRANCH);
  if (own.length !== 1) FAIL(`agent branch ${CURRENT_BRANCH} requires exactly one active ledger claim, found ${own.length}`);
  const claim = own[0];
  if (claim.observedHeadSha !== EXPECTED_HEAD_SHA) {
    try { execFileSync('git', ['merge-base', '--is-ancestor', claim.observedHeadSha, EXPECTED_HEAD_SHA], { stdio: 'ignore' }); }
    catch { FAIL(`SHA binding violated for ${claim.agentId}: ${claim.observedHeadSha} is not an ancestor of ${EXPECTED_HEAD_SHA}`); }
  }
  if (ENFORCE_WORKTREE_SCOPE) {
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
    const changed = status.split('\n').filter(Boolean).map((line) => normalizePath(line.slice(3).replace(/ -> .+$/u, '')));
    for (const path of changed) if (!(claim.scope?.paths ?? []).some((allowed) => overlaps(path, allowed))) FAIL(`worktree path outside claimed scope: ${path}`);
  }
}

const report = { schemaVersion: 3, protocol: 'FLIXO agent session guard', generatedAt: new Date().toISOString(), branch: CURRENT_BRANCH, expectedHeadSha: EXPECTED_HEAD_SHA, sourceOfTruth: LEDGER, activeClaimCount: activeClaims.length, activeAgentIds: activeClaims.map((claim) => claim.agentId).sort(), worktreeScopeEnforced: ENFORCE_WORKTREE_SCOPE, status: 'PASS' };
report.reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await writeFile(EVIDENCE_FILE, JSON.stringify(report, null, 2) + '\n');
console.log(`Agent Session Guard PASS: ledgerActiveClaims=${activeClaims.length}`);
console.log(`reportHash=${report.reportHash}`);
