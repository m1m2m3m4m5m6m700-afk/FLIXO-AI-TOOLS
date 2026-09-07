import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const REPO = process.env.GITHUB_REPOSITORY ?? 'local';
const HEAD_SHA = process.env.EXPECTED_HEAD_SHA ?? (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
const BRANCH = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? (() => { try { return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
const AGENT_ID = process.env.FLIXO_AGENT_ID ?? '';
const ACTION = process.env.FLIXO_AGENT_ACTION ?? 'status';
const DRY_RUN = process.env.FLIXO_AGENT_DRY_RUN === '1' || process.argv.includes('--dry-run') || ACTION === 'dry-run';
const CLAIMS_FILE = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const EVIDENCE_FILE = process.env.FLIXO_AGENT_PROTOCOL_EVIDENCE ?? 'artifacts/ci/agent-coordination/protocol-state.json';
const HEX_SHA = /^[0-9a-f]{40}$/iu;
const AGENT_BRANCH = /^agent\/[^/]+\/.+$/u;
const fail = (message) => { throw new Error(`Agent coordination protocol failed: ${message}`); };
const now = () => new Date();
const parseIso = (value, field) => { const time = Date.parse(value ?? ''); if (!Number.isFinite(time)) fail(`${field} must be an ISO-8601 timestamp`); return time; };
const normalize = (value) => String(value ?? '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '');
const overlaps = (left, right) => left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
const unique = (values) => [...new Set(values)];
const readState = async () => JSON.parse(await readFile(CLAIMS_FILE, 'utf8'));
const writeState = async (state) => { state.updatedAt = now().toISOString(); state.claims = [...state.claims].sort((a, b) => `${a.agentId}:${a.branch}`.localeCompare(`${b.agentId}:${b.branch}`)); await writeFile(CLAIMS_FILE, JSON.stringify(state, null, 2) + '\n'); };
const validateState = (state) => {
  if (!state || state.schemaVersion !== 2 || state.protocol !== 'FLIXO multi-agent coordination') fail('invalid claims schema/protocol');
  if (!Number.isInteger(state.leaseMinutes) || state.leaseMinutes < 1) fail('leaseMinutes must be >= 1');
  if (!Number.isInteger(state.heartbeatMinutes) || state.heartbeatMinutes < 1 || state.heartbeatMinutes >= state.leaseMinutes) fail('heartbeatMinutes must be positive and less than leaseMinutes');
  if (!Array.isArray(state.claims)) fail('claims must be an array');
  const seen = new Set();
  for (const claim of state.claims) {
    if (!claim || typeof claim !== 'object') fail('claim must be an object');
    if (typeof claim.agentId !== 'string' || !claim.agentId.trim()) fail('claim.agentId is required');
    if (!AGENT_BRANCH.test(claim.branch ?? '')) fail(`claim ${claim.agentId} branch must match agent/<family>/<name>`);
    if (seen.has(claim.agentId)) fail(`duplicate agentId ${claim.agentId}`);
    seen.add(claim.agentId);
    if (!HEX_SHA.test(claim.observedHeadSha ?? '')) fail(`claim ${claim.agentId} observedHeadSha invalid`);
    if (!Array.isArray(claim.scope?.paths)) fail(`claim ${claim.agentId} scope.paths missing`);
    if (!Array.isArray(claim.scope?.contracts)) fail(`claim ${claim.agentId} scope.contracts missing`);
    if (!Array.isArray(claim.rootCauseIds)) fail(`claim ${claim.agentId} rootCauseIds missing`);
    if (claim.workItemIds !== undefined && !Array.isArray(claim.workItemIds)) fail(`claim ${claim.agentId} workItemIds must be an array`);
    if (!['active', 'handoff-pending', 'released', 'expired_evicted'].includes(claim.status)) fail(`claim ${claim.agentId} invalid status`);
    parseIso(claim.leasedAt, `claim ${claim.agentId}.leasedAt`);
    parseIso(claim.leaseUntil, `claim ${claim.agentId}.leaseUntil`);
    if (claim.lastHeartbeatAt) parseIso(claim.lastHeartbeatAt, `claim ${claim.agentId}.lastHeartbeatAt`);
  }
  return state;
};
const activeClaims = (state, at = Date.now()) => state.claims.filter((claim) => claim.status === 'active' && Date.parse(claim.leaseUntil) > at);
const assertSafeScope = (candidate, existingClaims) => {
  for (const current of existingClaims) {
    const pathConflict = candidate.scope.paths.some((path) => current.scope.paths.some((other) => overlaps(normalize(path), normalize(other))));
    const contractConflict = candidate.scope.contracts.some((id) => current.scope.contracts.includes(id));
    const rootCauseConflict = candidate.rootCauseIds.some((id) => current.rootCauseIds.includes(id));
    if (pathConflict || contractConflict || rootCauseConflict) fail(`collision with ${current.agentId}: path=${pathConflict} contract=${contractConflict} rootCause=${rootCauseConflict}`);
  }
};
const isAncestor = (ancestor, descendant) => {
  if (!HEX_SHA.test(ancestor) || !HEX_SHA.test(descendant)) return false;
  if (ancestor === descendant) return true;
  try { execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { stdio: 'ignore' }); return true; } catch { return false; }
};
const assertAnchored = (claim, currentHead) => {
  if (!isAncestor(claim.observedHeadSha, currentHead)) fail(`claim ${claim.agentId} is stale or diverged: anchor=${claim.observedHeadSha} current=${currentHead}; re-ingest and re-claim required`);
};

const state = validateState(await readState());
const evidence = { schemaVersion: 3, protocol: 'FLIXO agent coordination runtime', repository: REPO, branch: BRANCH, headSha: HEAD_SHA || null, action: DRY_RUN ? 'dry-run' : ACTION, generatedAt: now().toISOString() };

if (DRY_RUN) {
  if (!AGENT_ID) fail('dry-run requires FLIXO_AGENT_ID');
  if (!HEX_SHA.test(HEAD_SHA)) fail(`current HEAD ${HEAD_SHA || '<unset>'} is not an exact SHA`);
  const paths = unique((process.env.FLIXO_AGENT_PATHS ?? '').split(',').map(normalize).filter(Boolean));
  const contracts = unique((process.env.FLIXO_AGENT_CONTRACTS ?? '').split(',').map((v) => v.trim()).filter(Boolean));
  const rootCauseIds = unique((process.env.FLIXO_AGENT_ROOT_CAUSES ?? '').split(',').map((v) => v.trim()).filter(Boolean));
  if (!paths.length && !contracts.length && !rootCauseIds.length) fail('dry-run requires paths, contracts, or rootCauseIds');
  assertSafeScope({ scope: { paths, contracts }, rootCauseIds }, activeClaims(state).filter((claim) => claim.agentId !== AGENT_ID));
  evidence.result = 'dry-run-safe';
  evidence.candidate = { agentId: AGENT_ID, paths, contracts, rootCauseIds, headSha: HEAD_SHA };
} else if (ACTION === 'status') {
  evidence.active = activeClaims(state).map((claim) => ({ agentId: claim.agentId, branch: claim.branch, observedHeadSha: claim.observedHeadSha, leaseUntil: claim.leaseUntil, lastHeartbeatAt: claim.lastHeartbeatAt ?? null, workItemIds: claim.workItemIds ?? [] }));
} else {
  if (!AGENT_ID) fail('FLIXO_AGENT_ID is required for mutating actions');
  if (!AGENT_BRANCH.test(BRANCH)) fail(`current branch ${BRANCH || '<unset>'} is not an agent branch`);
  if (!HEX_SHA.test(HEAD_SHA)) fail(`current HEAD ${HEAD_SHA || '<unset>'} is not an exact SHA`);
  const existing = state.claims.find((claim) => claim.agentId === AGENT_ID);
  if (ACTION === 'check-in') {
    if (existing && existing.status === 'active' && Date.parse(existing.leaseUntil) > Date.now()) fail(`agent ${AGENT_ID} already has an active claim`);
    const paths = unique((process.env.FLIXO_AGENT_PATHS ?? '').split(',').map(normalize).filter(Boolean));
    const contracts = unique((process.env.FLIXO_AGENT_CONTRACTS ?? '').split(',').map((v) => v.trim()).filter(Boolean));
    const rootCauseIds = unique((process.env.FLIXO_AGENT_ROOT_CAUSES ?? '').split(',').map((v) => v.trim()).filter(Boolean));
    const workItemIds = unique((process.env.FLIXO_AGENT_WORK_ITEMS ?? '').split(',').map((v) => v.trim()).filter(Boolean));
    if (!paths.length && !contracts.length && !rootCauseIds.length) fail('check-in requires paths, contracts, or rootCauseIds');
    assertSafeScope({ scope: { paths, contracts }, rootCauseIds }, activeClaims(state).filter((claim) => claim.agentId !== AGENT_ID));
    const leasedAt = now();
    const claim = { agentId: AGENT_ID, branch: BRANCH, observedHeadSha: HEAD_SHA, scope: { paths, contracts }, rootCauseIds, workItemIds, status: 'active', leasedAt: leasedAt.toISOString(), leaseUntil: new Date(leasedAt.getTime() + state.leaseMinutes * 60000).toISOString(), lastHeartbeatAt: leasedAt.toISOString(), sessionId: randomUUID() };
    state.claims = state.claims.filter((item) => item.agentId !== AGENT_ID); state.claims.push(claim); evidence.claim = claim; evidence.result = 'checked-in';
  } else if (ACTION === 'heartbeat') {
    if (!existing || existing.status !== 'active') fail(`agent ${AGENT_ID} has no active claim`);
    assertAnchored(existing, HEAD_SHA);
    if (Date.parse(existing.leaseUntil) <= Date.now()) fail('heartbeat rejected: lease expired; re-check-in required');
    const heartbeat = now(); existing.lastHeartbeatAt = heartbeat.toISOString(); existing.leaseUntil = new Date(heartbeat.getTime() + state.leaseMinutes * 60000).toISOString(); existing.lastReanchorSha = HEAD_SHA; evidence.claim = existing; evidence.result = 'heartbeat-renewed';
  } else if (ACTION === 'check-out' || ACTION === 'handoff') {
    if (!existing || !['active', 'handoff-pending'].includes(existing.status)) fail(`agent ${AGENT_ID} has no releasable claim`);
    assertAnchored(existing, HEAD_SHA);
    existing.status = ACTION === 'handoff' ? 'handoff-pending' : 'released'; existing.releasedAt = now().toISOString(); existing.lastReanchorSha = HEAD_SHA; if (ACTION === 'handoff') existing.handoffTo = process.env.FLIXO_AGENT_HANDOFF_TO ?? '';
    evidence.claim = existing; evidence.result = ACTION === 'handoff' ? 'handoff-pending' : 'released';
  } else fail(`unsupported action ${ACTION}`);
  await writeState(state);
}

evidence.activeCount = activeClaims(state).length;
evidence.activeAgentIds = activeClaims(state).map((claim) => claim.agentId).sort();
evidence.stateHash = createHash('sha256').update(JSON.stringify(state)).digest('hex');
if (!DRY_RUN) {
  await mkdir('artifacts/ci/agent-coordination', { recursive: true });
  await writeFile(EVIDENCE_FILE, JSON.stringify(evidence, null, 2) + '\n');
}
console.log(`Agent coordination ${evidence.action} PASS: active=${evidence.activeCount} stateHash=${evidence.stateHash}`);
