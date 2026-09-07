import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const service = process.env.FLIXO_EXTERNAL_SERVICE ?? 'vercel';
const state = String(process.env.FLIXO_EXTERNAL_CIRCUIT_STATE ?? 'unknown').toLowerCase();
const runId = process.env.GITHUB_RUN_ID ?? 'local';
const sha = process.env.EXPECTED_HEAD_SHA ?? process.env.GITHUB_SHA ?? '';
const allowed = new Set(['healthy', 'unknown', 'rate_limited', 'degraded', 'unavailable']);
if (!allowed.has(state)) throw new Error(`External circuit rejected: unsupported state=${state}`);

const blockedStates = new Set(['rate_limited', 'degraded', 'unavailable']);
const mode = blockedStates.has(state) ? 'external_deferred' : state === 'healthy' ? 'online' : 'unknown';
const releaseEligible = mode === 'online';

const event = {
  schemaVersion: 1,
  eventType: 'external_circuit_preflight',
  service,
  observedState: state,
  mode,
  releaseEligible,
  failClosed: true,
  sourceSha: sha,
  runId,
  generatedAt: new Date().toISOString(),
};
event.eventId = createHash('sha256').update(JSON.stringify(event)).digest('hex');

await mkdir('artifacts/ci/external-circuit', { recursive: true });
await writeFile('artifacts/ci/external-circuit/state.json', JSON.stringify(event, null, 2) + '\n');
await writeFile('artifacts/ci/external-circuit/event-ledger.jsonl', JSON.stringify(event) + '\n');

console.log(`External circuit: service=${service} state=${state} mode=${mode} releaseEligible=${releaseEligible}`);
if (mode === 'external_deferred') {
  console.log('External verification deferred fail-closed; internal correctness gates may continue, but release certification remains blocked.');
}
if (state === 'unknown') {
  console.log('External service state is unknown; no production-release eligibility is inferred.');
}
