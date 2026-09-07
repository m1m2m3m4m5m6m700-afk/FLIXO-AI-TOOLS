import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { replayAgentLedger, normalizePath, overlaps } from './replay-agent-ledger.mjs';

const REPOSITORY = process.env.GITHUB_REPOSITORY ?? '';
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const EVENT_NAME = process.env.GITHUB_EVENT_NAME ?? '';
const EVENT_PATH = process.env.GITHUB_EVENT_PATH ?? '';
const CURRENT_HEAD_SHA = process.env.EXPECTED_HEAD_SHA ?? process.env.GITHUB_SHA ?? '';
const LEDGER_PATH = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const EVIDENCE_FILE = process.env.FLIXO_AGENT_COLLISION_EVIDENCE ?? 'artifacts/ci/agent-coordination/cross-branch.json';
const AGENT_BRANCH = /^agent\/[^/]+\/.+$/u;
const HEX_SHA = /^[0-9a-f]{40}$/iu;
const fail = (message) => { throw new Error(`Cross-branch agent collision validation failed: ${message}`); };

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

const decodeContent = (payload, label) => {
  if (payload?.type !== 'file' || typeof payload.content !== 'string') fail(`${label} has unreadable ledger file`);
  try { return Buffer.from(payload.content.replace(/\s+/g, ''), 'base64').toString('utf8'); } catch { fail(`${label} ledger decoding failed`); }
};

const activeFromLedger = (text, label) => {
  let state;
  try { state = replayAgentLedger(text, { signingKey: process.env.FLIXO_SWARM_EVENT_SIGNING_KEY ?? '' }); }
  catch (error) { fail(`${label} ledger replay failed: ${error.message}`); }
  const active = [];
  for (const claim of state.claims.values()) {
    if (claim.status !== 'active') continue;
    if (!AGENT_BRANCH.test(claim.branch ?? '')) fail(`active claim ${claim.agentId} has invalid branch in ${label}`);
    if (!HEX_SHA.test(claim.observedHeadSha ?? '')) fail(`active claim ${claim.agentId} has invalid observedHeadSha in ${label}`);
    const paths = (claim.scope?.paths ?? []).map(normalizePath).filter(Boolean);
    const contracts = (claim.scope?.contracts ?? []).filter((value) => typeof value === 'string' && value.trim());
    const rootCauseIds = (claim.rootCauseIds ?? []).filter((value) => typeof value === 'string' && value.trim());
    if (!paths.length && !contracts.length && !rootCauseIds.length) fail(`active claim ${claim.agentId} is scope-empty in ${label}`);
    active.push({ agentId: claim.agentId, branch: claim.branch, observedHeadSha: claim.observedHeadSha, paths, contracts, rootCauseIds });
  }
  return active;
};

const assertClaimAnchored = async (claim, headSha, label) => {
  const comparison = await api(`/compare/${encodeURIComponent(claim.observedHeadSha)}...${encodeURIComponent(headSha)}`);
  if (!['ahead', 'identical'].includes(comparison?.status)) fail(`${label} claim ${claim.agentId} is not anchored to an ancestor of PR head: ${claim.observedHeadSha} -> ${headSha}`);
};

const currentPr = await getEventPullRequest();
const currentBranch = currentPr?.head?.ref ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? '';
const currentLedgerPayload = await api(`/contents/${LEDGER_PATH}?ref=${encodeURIComponent(currentBranch)}`);
const currentAgents = activeFromLedger(decodeContent(currentLedgerPayload, 'current branch'), 'current branch');
for (const claim of currentAgents) await assertClaimAnchored(claim, CURRENT_HEAD_SHA, 'current branch');

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
    const payload = await api(`/contents/${LEDGER_PATH}?ref=${encodeURIComponent(pr.head.ref)}`);
    const agents = activeFromLedger(decodeContent(payload, `PR #${pr.number} (${pr.head.ref})`), `PR #${pr.number} (${pr.head.ref})`);
    for (const claim of agents) await assertClaimAnchored(claim, pr.head.sha, `PR #${pr.number} (${pr.head.ref})`);
    if (agents.length) peers.push({ prNumber: pr.number, branch: pr.head.ref, headSha: pr.head.sha, agents });
  }
}

const collides = (left, right) => ({
  sharedPath: left.paths.some((path) => right.paths.some((other) => overlaps(path, other))),
  sharedContract: left.contracts.some((id) => right.contracts.includes(id)),
  sharedRootCause: left.rootCauseIds.some((id) => right.rootCauseIds.includes(id)),
});

for (let i = 0; i < peers.length; i += 1) {
  for (let j = i + 1; j < peers.length; j += 1) {
    for (const left of peers[i].agents) for (const right of peers[j].agents) {
      const conflict = collides(left, right);
      if (conflict.sharedPath || conflict.sharedContract || conflict.sharedRootCause) collisions.push({ current: null, peer: { left: left.agentId, right: right.agentId }, ...conflict });
    }
  }
}

for (const peer of peers) for (const agent of peer.agents) {
  for (const claim of currentAgents) {
    const conflict = collides(claim, agent);
    const changedPathCollision = currentPaths.some((path) => agent.paths.some((other) => overlaps(path, other)));
    if (conflict.sharedPath || conflict.sharedContract || conflict.sharedRootCause || changedPathCollision) collisions.push({ current: { prNumber: currentPr?.number ?? null, branch: currentBranch, agentIds: currentAgents.map((item) => item.agentId), changedPathCollision }, peer: { prNumber: peer.prNumber, branch: peer.branch, agentId: agent.agentId }, ...conflict, changedPathCollision });
  }
}

if (collisions.length) fail(`active writer collision detected: ${JSON.stringify(collisions)}`);
const report = { schemaVersion: 3, protocol: 'FLIXO cross-branch agent collision guard', generatedAt: new Date().toISOString(), repository: REPOSITORY, eventName: EVENT_NAME, currentPrNumber: currentPr?.number ?? null, currentBranch, currentHeadSha: CURRENT_HEAD_SHA || null, currentClaimCount: currentAgents.length, scannedPeerPrs: peers.map((peer) => ({ prNumber: peer.prNumber, branch: peer.branch, headSha: peer.headSha, activeAgentCount: peer.agents.length })), collisionCount: collisions.length, collisions, sourceOfTruth: LEDGER_PATH, invariants: ['active claims are derived by replaying the immutable event ledger', 'open same-repository agent PRs are scanned from their immutable event ledgers', 'active claims must be anchored to their PR head or an ancestor', 'path, contract, and root-cause overlap is fatal while claims are active', 'unreadable or malformed ledgers fail closed'] };
report.reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await writeFile(EVIDENCE_FILE, JSON.stringify(report, null, 2) + '\n');
console.log(`Cross-branch coordination PASS: scannedPeers=${peers.length} collisions=${collisions.length}`);
console.log(`reportHash=${report.reportHash}`);
