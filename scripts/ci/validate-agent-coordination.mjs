import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const CLAIMS_FILE = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const EVIDENCE_FILE = process.env.FLIXO_AGENT_COORDINATION_EVIDENCE ?? 'artifacts/ci/agent-coordination/coordination.json';
const HEX_SHA = /^[0-9a-f]{40}$/iu;
const AGENT_BRANCH = /^agent\/[^/]+\/.+$/u;

const fail = (message) => {
  throw new Error(`Agent coordination validation failed: ${message}`);
};

const text = await readFile(CLAIMS_FILE, 'utf8');
const state = JSON.parse(text);

if (state.schemaVersion !== 1) fail(`unsupported schemaVersion: ${state.schemaVersion}`);
if (state.protocol !== 'FLIXO multi-agent coordination') fail('unexpected protocol identifier');
if (!Number.isInteger(state.leaseMinutes) || state.leaseMinutes <= 0) fail('leaseMinutes must be a positive integer');
if (!Array.isArray(state.claims)) fail('claims must be an array');

const now = Date.now();
const active = [];
const seenAgents = new Set();
const seenBranches = new Set();

for (const claim of state.claims) {
  if (!claim || typeof claim !== 'object') fail('claim must be an object');
  if (typeof claim.agentId !== 'string' || !claim.agentId.trim()) fail('claim has no agentId');
  if (claim.status !== 'active' && claim.status !== 'released') fail(`${claim.agentId}: invalid status`);
  if (typeof claim.branch !== 'string' || !claim.branch.trim()) fail(`${claim.agentId}: branch is required`);
  if (!HEX_SHA.test(claim.observedHeadSha ?? '')) fail(`${claim.agentId}: observedHeadSha must be a 40-hex SHA`);
  if (!claim.scope || typeof claim.scope !== 'object') fail(`${claim.agentId}: scope is required`);
  if (!Array.isArray(claim.scope.paths) || !Array.isArray(claim.scope.contracts)) {
    fail(`${claim.agentId}: scope.paths and scope.contracts must be arrays`);
  }
  if (claim.scope.paths.length === 0 && claim.scope.contracts.length === 0) {
    fail(`${claim.agentId}: writable scope cannot be empty`);
  }
  if (typeof claim.leasedAt !== 'string' || Number.isNaN(Date.parse(claim.leasedAt))) {
    fail(`${claim.agentId}: leasedAt must be an ISO timestamp`);
  }
  if (typeof claim.leaseUntil !== 'string' || Number.isNaN(Date.parse(claim.leaseUntil))) {
    fail(`${claim.agentId}: leaseUntil must be an ISO timestamp`);
  }
  if (claim.status !== 'active') continue;

  if (!AGENT_BRANCH.test(claim.branch)) {
    fail(`${claim.agentId}: active writer branch must match agent/<agentId>/<work-id>`);
  }
  if (seenAgents.has(claim.agentId)) fail(`duplicate active agentId ${claim.agentId}`);
  if (seenBranches.has(claim.branch)) fail(`duplicate active branch ${claim.branch}`);
  seenAgents.add(claim.agentId);
  seenBranches.add(claim.branch);

  const leaseUntil = Date.parse(claim.leaseUntil);
  if (leaseUntil > now) active.push({ ...claim, leaseUntilMs: leaseUntil });
}

const currentBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || null;
const expectedSha = process.env.EXPECTED_HEAD_SHA;
const strictSha = process.env.FLIXO_AGENT_COORDINATION_STRICT_SHA === 'true';
if (expectedSha && !HEX_SHA.test(expectedSha)) fail('EXPECTED_HEAD_SHA must be a 40-hex SHA when supplied');

if (strictSha && active.length > 0 && (!currentBranch || !AGENT_BRANCH.test(currentBranch))) {
  fail(`active writer claims are only valid on agent branches; current branch is ${currentBranch ?? 'unknown'}`);
}
if (strictSha && active.length > 0 && expectedSha) {
  const stale = active.filter((claim) => claim.branch === currentBranch && claim.observedHeadSha !== expectedSha);
  if (stale.length > 0) {
    fail(`stale active claim SHA on ${currentBranch}: ${stale.map((claim) => `${claim.agentId} observed ${claim.observedHeadSha}`).join(', ')}`);
  }
}

if (currentBranch && !AGENT_BRANCH.test(currentBranch) && active.length > 0) {
  fail(`integration branch ${currentBranch} contains active writer claims; release claims before integration`);
}
if (currentBranch && AGENT_BRANCH.test(currentBranch)) {
  const foreign = active.filter((claim) => claim.branch !== currentBranch);
  if (foreign.length > 0) {
    fail(`agent branch ${currentBranch} contains foreign active claims: ${foreign.map((claim) => claim.agentId).join(', ')}`);
  }
}

const normalizePath = (value) => value.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/, '');
const pathConflicts = (a, b) => {
  const left = normalizePath(a);
  const right = normalizePath(b);
  if (!left || !right) return false;
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
};

for (let i = 0; i < active.length; i += 1) {
  for (let j = i + 1; j < active.length; j += 1) {
    const left = active[i];
    const right = active[j];
    const sharedContract = left.scope.contracts.some((id) => right.scope.contracts.includes(id));
    const sharedRootCause = (left.rootCauseIds ?? []).some((id) => (right.rootCauseIds ?? []).includes(id));
    const sharedPath = left.scope.paths.some((path) => right.scope.paths.some((other) => pathConflicts(path, other)));
    if (sharedContract || sharedRootCause || sharedPath) {
      fail(`active scope collision: ${left.agentId} <-> ${right.agentId}`);
    }
  }
}

const report = {
  schemaVersion: 1,
  protocol: state.protocol,
  generatedAt: new Date().toISOString(),
  expectedHeadSha: expectedSha ?? null,
  currentBranch,
  strictSha,
  activeClaimCount: active.length,
  activeAgents: active.map(({ agentId, branch, observedHeadSha, scope, rootCauseIds, leaseUntil }) => ({
    agentId,
    branch,
    observedHeadSha,
    scope,
    rootCauseIds: rootCauseIds ?? [],
    leaseUntil,
  })),
  invariants: [
    'one writable scope per active agent',
    'no active path/contract/root-cause collisions',
    'active writers use isolated agent branches',
    'active claims match the exact CI head when strict SHA is enabled',
    'integration branches contain no active writer claims',
    'leases expire without permanent locks',
    'agent count is not fixed by protocol',
    'diagnostics do not grant write ownership',
    'canonical certification remains singular',
  ],
};

const reportHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
report.reportHash = reportHash;

await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await writeFile(EVIDENCE_FILE, JSON.stringify(report, null, 2) + '\n');

console.log(`Agent coordination PASS: activeAgents=${active.length} strictSha=${strictSha}`);
console.log(`reportHash=${reportHash}`);
