import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { replayAgentLedger } from './replay-agent-ledger.mjs';

const LEDGER = process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson';
const CLAIMS = process.env.FLIXO_AGENT_CLAIMS_FILE ?? '.ci/agent-coordination/claims.json';
const SESSIONS = process.env.FLIXO_AGENT_SESSIONS_FILE ?? 'scripts/ci/active-sessions.json';
const state = replayAgentLedger(await readFile(LEDGER, 'utf8'), { signingKey: process.env.FLIXO_SWARM_EVENT_SIGNING_KEY ?? '' });

const claims = [...state.claims.values()].sort((a, b) => a.agentId.localeCompare(b.agentId));
const leaseMinutes = Number.parseInt(process.env.FLIXO_SWARM_LEASE_MINUTES ?? '30', 10);
const heartbeatMinutes = Number.parseInt(process.env.FLIXO_SWARM_HEARTBEAT_MINUTES ?? '10', 10);
const claimsProjection = {
  schemaVersion: 2,
  protocol: 'FLIXO multi-agent coordination',
  sourceOfTruth: 'artifacts/ci/agent-coordination/events.ndjson',
  generatedAt: new Date().toISOString(),
  leaseMinutes,
  heartbeatMinutes,
  claims,
};
const activeSessions = claims.filter((claim) => claim.status === 'active').map((claim) => ({
  agentId: claim.agentId,
  branch: claim.branch,
  observedHeadSha: claim.observedHeadSha,
  scope: claim.scope,
  rootCauseIds: claim.rootCauseIds,
  workItemIds: claim.workItemIds ?? [],
  leasedAt: claim.leasedAt,
  leaseUntil: claim.leaseUntil,
  lastHeartbeatAt: claim.lastHeartbeatAt,
  sessionId: claim.sessionId,
}));
const sessionsProjection = {
  schema_version: 1,
  source_of_truth: 'artifacts/ci/agent-coordination/events.ndjson',
  generated_at: new Date().toISOString(),
  active_sessions: activeSessions,
};
await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await mkdir('.ci/agent-coordination', { recursive: true });
await writeFile(CLAIMS, JSON.stringify(claimsProjection, null, 2) + '\n');
await writeFile(SESSIONS, JSON.stringify(sessionsProjection, null, 2) + '\n');
console.log(JSON.stringify({ result: 'PASS', mode: 'projection-rebuild', sourceOfTruth: LEDGER, claims: claims.length, activeSessions: activeSessions.length }, null, 2));
