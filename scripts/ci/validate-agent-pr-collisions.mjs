import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const CLAIMS_FILE = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const EVIDENCE_FILE = process.env.FLIXO_AGENT_COLLISION_EVIDENCE ?? 'artifacts/ci/agent-coordination/cross-branch.json';
const REPOSITORY = process.env.GITHUB_REPOSITORY ?? '';
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const EVENT_NAME = process.env.GITHUB_EVENT_NAME ?? '';
const EVENT_PATH = process.env.GITHUB_EVENT_PATH ?? '';
const CURRENT_HEAD_SHA = process.env.EXPECTED_HEAD_SHA ?? process.env.GITHUB_SHA ?? '';
const CLAIMS_PATH = '.ci/agent-coordination/claims.json';
const AGENT_BRANCH = /^agent\/[^/]+\/.+$/u;
const HEX_SHA = /^[0-9a-f]{40}$/iu;

const fail = (message) => {
  throw new Error(`Cross-branch agent collision validation failed: ${message}`);
};

const normalizePath = (value) => value.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '');
const pathConflicts = (a, b) => {
  const left = normalizePath(a);
  const right = normalizePath(b);
  if (!left || !right) return false;
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
};

const validateClaims = (state, branch) => {
  if (!state || typeof state !== 'object') fail(`claims state unreadable for ${branch}`);
  if (state.schemaVersion !== 1 || state.protocol !== 'FLIXO multi-agent coordination') fail(`claims schema/protocol invalid for ${branch}`);
  if (!Array.isArray(state.claims)) fail(`claims registry is not an array for ${branch}`);
  const now = Date.now();
  const active = [];
  for (const claim of state.claims) {
    if (!claim || typeof claim !== 'object' || claim.status !== 'active') continue;
    if (typeof claim.agentId !== 'string' || !claim.agentId.trim()) fail(`active claim on ${branch} has invalid agentId`);
    if (!AGENT_BRANCH.test(claim.branch ?? '')) fail(`active claim on ${branch} has invalid agent branch`);
    if (!HEX_SHA.test(claim.observedHeadSha ?? '')) fail(`active claim ${claim.agentId} has invalid observedHeadSha`);
    const leaseUntil = Date.parse(claim.leaseUntil ?? '');
    if (!Number.isFinite(leaseUntil)) fail(`active claim ${claim.agentId} has invalid leaseUntil`);
    if (leaseUntil <= now) continue;
    if (!claim.scope || typeof claim.scope !== 'object') fail(`active claim ${claim.agentId} has no scope`);
    const paths = Array.isArray(claim.scope.paths) ? claim.scope.paths.map(normalizePath).filter(Boolean) : [];
    const contracts = Array.isArray(claim.scope.contracts) ? claim.scope.contracts.filter((v) => typeof v === 'string' && v.trim()) : [];
    const rootCauseIds = Array.isArray(claim.rootCauseIds) ? claim.rootCauseIds.filter((v) => typeof v === 'string' && v.trim()) : [];
    if (paths.length === 0 && contracts.length === 0 && rootCauseIds.length === 0) fail(`active claim ${claim.agentId} is scope-empty`);
    active.push({ agentId: claim.agentId, branch: claim.branch, observedHeadSha: claim.observedHeadSha, paths, contracts, rootCauseIds, leaseUntil: claim.leaseUntil });
  }
  return { active };
};

const readLocalClaims = async () => validateClaims(JSON.parse(await readFile(CLAIMS_FILE, 'utf8')), process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '');

const api = async (path) => {
  if (!REPOSITORY || !TOKEN) fail('GITHUB_REPOSITORY and GITHUB_TOKEN are required in CI');
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}${path}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${TOKEN}`, 'x-github-api-version': '2022-11-28', 'user-agent': 'FLIXO-agent-collision-guard' },
  });
  if (!response.ok) fail(`GitHub API ${path} returned ${response.status}`);
  return response.json();
};

const getEventPullRequest = async () => {
  if (!EVENT_PATH) return null;
  try { return JSON.parse(await readFile(EVENT_PATH, 'utf8'))?.pull_request ?? null; } catch { return null; }
};

const currentClaims = await readLocalClaims();
const currentPr = await getEventPullRequest();
const currentBranch = currentPr?.head?.ref ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? '';
const currentPaths = [];

if (EVENT_NAME === 'pull_request' && currentPr?.number) {
  const changed = await api(`/pulls/${currentPr.number}/files?per_page=100`);
  if (!Array.isArray(changed)) fail(`unable to read changed files for PR #${currentPr.number}`);
  for (const file of changed) if (file?.filename) currentPaths.push(normalizePath(file.filename));
}

const peers = [];
const collisions = [];
if (EVENT_NAME === 'pull_request') {
  const openPrs = await api('/pulls?state=open&per_page=100');
  for (const pr of openPrs) {
    if (!pr?.head?.ref || !AGENT_BRANCH.test(pr.head.ref)) continue;
    if (currentPr?.number && pr.number === currentPr.number) continue;
    if (pr.head?.repo?.full_name !== REPOSITORY) continue;
    const claimsUrl = `/contents/${CLAIMS_PATH}?ref=${encodeURIComponent(pr.head.ref)}`;
    const payload = await api(claimsUrl);
    if (payload?.type !== 'file' || typeof payload.content !== 'string') fail(`PR #${pr.number} (${pr.head.ref}) has unreadable claims file`);
    let state;
    try { state = JSON.parse(Buffer.from(payload.content.replace(/\s+/g, ''), 'base64').toString('utf8')); } catch { fail(`PR #${pr.number} (${pr.head.ref}) has invalid claims JSON`); }
    const claimSet = validateClaims(state, pr.head.ref);
    for (const claim of claimSet.active) {
      if (claim.observedHeadSha !== pr.head.sha) fail(`stale active claim ${claim.agentId}: ${claim.observedHeadSha} != PR head ${pr.head.sha}`);
    }
    if (claimSet.active.length === 0) continue;
    peers.push({ prNumber: pr.number, branch: pr.head.ref, headSha: pr.head.sha, agents: claimSet.active });
  }
}

for (let i = 0; i < peers.length; i += 1) {
  for (let j = i + 1; j < peers.length; j += 1) {
    for (const left of peers[i].agents) for (const right of peers[j].agents) {
      const sharedPath = left.paths.some((path) => right.paths.some((other) => pathConflicts(path, other)));
      const sharedContract = left.contracts.some((id) => right.contracts.includes(id));
      const sharedRootCause = left.rootCauseIds.some((id) => right.rootCauseIds.includes(id));
      if (sharedPath || sharedContract || sharedRootCause) collisions.push({ current: null, peer: { left: left.agentId, right: right.agentId }, sharedPath, sharedContract, sharedRootCause });
    }
  }
}

for (const peer of peers) {
  for (const agent of peer.agents) {
    const sharedPathWithCurrentClaim = currentClaims.active.some((claim) => claim.paths.some((path) => agent.paths.some((other) => pathConflicts(path, other))));
    const sharedContractWithCurrentClaim = currentClaims.active.some((claim) => claim.contracts.some((id) => agent.contracts.includes(id)));
    const sharedRootCauseWithCurrentClaim = currentClaims.active.some((claim) => claim.rootCauseIds.some((id) => agent.rootCauseIds.includes(id)));
    const changedPathCollision = currentPaths.some((path) => agent.paths.some((other) => pathConflicts(path, other)));
    if (sharedPathWithCurrentClaim || sharedContractWithCurrentClaim || sharedRootCauseWithCurrentClaim || changedPathCollision) {
      collisions.push({ current: { prNumber: currentPr?.number ?? null, branch: currentBranch, agentIds: currentClaims.active.map((claim) => claim.agentId), changedPathCollision }, peer: { prNumber: peer.prNumber, branch: peer.branch, agentId: agent.agentId }, sharedPath: sharedPathWithCurrentClaim || changedPathCollision, sharedContract: sharedContractWithCurrentClaim, sharedRootCause: sharedRootCauseWithCurrentClaim });
    }
  }
}

if (collisions.length > 0) fail(`active writer collision detected: ${JSON.stringify(collisions)}`);

const report = {
  schemaVersion: 2,
  protocol: 'FLIXO cross-branch agent collision guard',
  generatedAt: new Date().toISOString(),
  repository: REPOSITORY,
  eventName: EVENT_NAME,
  currentPrNumber: currentPr?.number ?? null,
  currentBranch,
  currentHeadSha: CURRENT_HEAD_SHA || null,
  currentClaimCount: currentClaims.active.length,
  currentChangedPathCount: currentPaths.length,
  scannedPeerPrs: peers.map((peer) => ({ prNumber: peer.prNumber, branch: peer.branch, headSha: peer.headSha, activeAgentCount: peer.agents.length })),
  collisionCount: collisions.length,
  collisions,
  invariants: [
    'all open same-repository agent PRs are scanned from integration and agent PR contexts',
    'every active peer claim must match its PR head SHA',
    'peer-to-peer path, contract, and root-cause overlap is fatal',
    'integration PR changed paths cannot overlap an active agent claim',
    'expired claims do not block work',
    'unreadable or malformed claims fail closed',
  ],
};
report.reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await writeFile(EVIDENCE_FILE, JSON.stringify(report, null, 2) + '\n');
console.log(`Cross-branch coordination PASS: scannedPeers=${peers.length} collisions=${collisions.length}`);
console.log(`reportHash=${report.reportHash}`);
