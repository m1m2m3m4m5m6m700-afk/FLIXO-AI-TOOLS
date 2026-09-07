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
  if (!state || typeof state !== 'object') return { active: [] };
  if (state.schemaVersion !== 1 || state.protocol !== 'FLIXO multi-agent coordination') return { active: [] };
  if (!Array.isArray(state.claims)) return { active: [] };
  const now = Date.now();
  const active = [];
  for (const claim of state.claims) {
    if (!claim || typeof claim !== 'object' || claim.status !== 'active') continue;
    if (typeof claim.agentId !== 'string' || !claim.agentId.trim()) continue;
    if (!AGENT_BRANCH.test(claim.branch ?? branch)) continue;
    if (!HEX_SHA.test(claim.observedHeadSha ?? '')) continue;
    if (typeof claim.leaseUntil !== 'string') continue;
    const leaseUntil = Date.parse(claim.leaseUntil);
    if (!Number.isFinite(leaseUntil) || leaseUntil <= now) continue;
    if (!claim.scope || typeof claim.scope !== 'object') continue;
    const paths = Array.isArray(claim.scope.paths) ? claim.scope.paths.map(normalizePath).filter(Boolean) : [];
    const contracts = Array.isArray(claim.scope.contracts) ? claim.scope.contracts.filter((v) => typeof v === 'string' && v.trim()) : [];
    const rootCauseIds = Array.isArray(claim.rootCauseIds) ? claim.rootCauseIds.filter((v) => typeof v === 'string' && v.trim()) : [];
    if (paths.length === 0 && contracts.length === 0 && rootCauseIds.length === 0) continue;
    active.push({
      agentId: claim.agentId,
      branch: claim.branch,
      observedHeadSha: claim.observedHeadSha,
      paths,
      contracts,
      rootCauseIds,
      leaseUntil: claim.leaseUntil,
    });
  }
  return { active };
};

const readLocalClaims = async () => validateClaims(JSON.parse(await readFile(CLAIMS_FILE, 'utf8')), process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '');

const api = async (path) => {
  if (!REPOSITORY || !TOKEN) fail('GITHUB_REPOSITORY and GITHUB_TOKEN are required in CI');
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'FLIXO-agent-collision-guard',
    },
  });
  if (!response.ok) fail(`GitHub API ${path} returned ${response.status}`);
  return response.json();
};

const getEventPullRequest = async () => {
  if (!EVENT_PATH) return null;
  try {
    const event = JSON.parse(await readFile(EVENT_PATH, 'utf8'));
    return event?.pull_request ?? null;
  } catch {
    return null;
  }
};

const currentClaims = await readLocalClaims();
const currentPr = await getEventPullRequest();
const currentBranch = currentPr?.head?.ref ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? '';
const scanEnabled = EVENT_NAME === 'pull_request' && AGENT_BRANCH.test(currentBranch) && currentClaims.active.length > 0;

const peers = [];
const collisions = [];

if (scanEnabled) {
  const openPrs = await api('/pulls?state=open&per_page=100');
  for (const pr of openPrs) {
    if (!pr?.head?.ref || !AGENT_BRANCH.test(pr.head.ref)) continue;
    if (currentPr?.number && pr.number === currentPr.number) continue;
    if (pr.head?.repo?.full_name !== REPOSITORY) continue;

    const claimsUrl = `/contents/${CLAIMS_PATH}?ref=${encodeURIComponent(pr.head.ref)}`;
    let payload;
    try {
      payload = await api(claimsUrl);
    } catch (error) {
      fail(`unable to read claims from PR #${pr.number} (${pr.head.ref}): ${error instanceof Error ? error.message : String(error)}`);
    }
    if (payload?.type !== 'file' || typeof payload.content !== 'string') {
      fail(`PR #${pr.number} (${pr.head.ref}) has unreadable claims file`);
    }
    const decoded = Buffer.from(payload.content.replace(/\s+/g, ''), 'base64').toString('utf8');
    let state;
    try {
      state = JSON.parse(decoded);
    } catch {
      fail(`PR #${pr.number} (${pr.head.ref}) has invalid claims JSON`);
    }
    const claimSet = validateClaims(state, pr.head.ref);
    if (claimSet.active.length === 0) continue;

    const peer = {
      prNumber: pr.number,
      branch: pr.head.ref,
      headSha: pr.head.sha,
      agents: claimSet.active,
    };
    peers.push(peer);

    for (const left of currentClaims.active) {
      for (const right of claimSet.active) {
        const sharedPath = left.paths.some((path) => right.paths.some((other) => pathConflicts(path, other)));
        const sharedContract = left.contracts.some((id) => right.contracts.includes(id));
        const sharedRootCause = left.rootCauseIds.some((id) => right.rootCauseIds.includes(id));
        if (sharedPath || sharedContract || sharedRootCause) {
          collisions.push({
            current: { prNumber: currentPr?.number ?? null, branch: currentBranch, agentId: left.agentId },
            peer: { prNumber: pr.number, branch: pr.head.ref, agentId: right.agentId },
            sharedPath,
            sharedContract,
            sharedRootCause,
          });
        }
      }
    }
  }
}

if (collisions.length > 0) {
  fail(`active writer collision detected: ${collisions.map((item) => `${item.current.branch} <-> ${item.peer.branch}`).join('; ')}`);
}

const report = {
  schemaVersion: 1,
  protocol: 'FLIXO cross-branch agent collision guard',
  generatedAt: new Date().toISOString(),
  repository: REPOSITORY,
  eventName: EVENT_NAME,
  currentPrNumber: currentPr?.number ?? null,
  currentBranch,
  currentHeadSha: CURRENT_HEAD_SHA || null,
  scanEnabled,
  scannedPeerPrs: peers.map((peer) => ({
    prNumber: peer.prNumber,
    branch: peer.branch,
    headSha: peer.headSha,
    activeAgentCount: peer.agents.length,
    agents: peer.agents.map((agent) => ({
      agentId: agent.agentId,
      observedHeadSha: agent.observedHeadSha,
      paths: agent.paths,
      contracts: agent.contracts,
      rootCauseIds: agent.rootCauseIds,
      leaseUntil: agent.leaseUntil,
    })),
  })),
  collisionCount: collisions.length,
  collisions,
  invariants: [
    'Git remains the source of truth; no central lock database is used',
    'only open same-repository agent PRs participate in cross-branch scanning',
    'expired claims do not block work',
    'path, contract, or root-cause overlap is a deterministic collision',
    'unreadable peer claims fail closed',
  ],
};
report.reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');

await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await writeFile(EVIDENCE_FILE, JSON.stringify(report, null, 2) + '\n');
console.log(`Cross-branch coordination PASS: scannedPeers=${peers.length} collisions=${collisions.length}`);
console.log(`reportHash=${report.reportHash}`);
