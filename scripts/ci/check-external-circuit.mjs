import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const service = process.env.FLIXO_EXTERNAL_SERVICE ?? 'vercel';
const override = String(process.env.FLIXO_EXTERNAL_CIRCUIT_STATE ?? '').toLowerCase();
const runId = process.env.GITHUB_RUN_ID ?? 'local';
const sha = process.env.EXPECTED_HEAD_SHA ?? process.env.GITHUB_SHA ?? '';
const repository = process.env.GITHUB_REPOSITORY ?? '';
const allowed = new Set(['healthy', 'unknown', 'rate_limited', 'degraded', 'unavailable']);
const blockedStates = new Set(['rate_limited', 'degraded', 'unavailable']);
const classify = (text) => {
  const value = String(text ?? '').toLowerCase();
  if (/rate[- ]?limit|build[- ]?rate[- ]?limit|too many requests|429/u.test(value)) return 'rate_limited';
  if (/failed|failure|unavailable|outage|error/u.test(value)) return 'unavailable';
  if (/success|passed|ready|completed/u.test(value)) return 'healthy';
  return 'unknown';
};

let state = override || '';
let source = override ? 'explicit_override' : 'github_check_runs';
let observation = null;
if (!state && repository && sha && process.env.GITHUB_TOKEN) {
  try {
    const payload = execFileSync('gh', ['api', `repos/${repository}/commits/${sha}/check-runs?per_page=100`], { encoding: 'utf8', env: process.env });
    const checks = JSON.parse(payload).check_runs ?? [];
    const matches = checks.filter((check) => String(check.name ?? '').toLowerCase().includes(service) || String(check.app?.name ?? '').toLowerCase().includes(service));
    const joined = matches.map((check) => `${check.name ?? ''} ${check.conclusion ?? ''} ${check.output?.title ?? ''} ${check.output?.summary ?? ''} ${check.output?.text ?? ''}`).join('\n');
    state = matches.length ? classify(joined) : 'unknown';
    observation = { matchingChecks: matches.map((check) => ({ name: check.name, status: check.status, conclusion: check.conclusion })) };
  } catch (error) {
    source = 'github_check_runs_error';
    observation = { error: String(error?.message ?? error) };
    state = 'unknown';
  }
}
if (!state) state = 'unknown';
if (!allowed.has(state)) throw new Error(`External circuit rejected: unsupported state=${state}`);
const mode = blockedStates.has(state) ? 'external_deferred' : state === 'healthy' ? 'online' : 'unknown';
const releaseEligible = mode === 'online';
const event = {
  schemaVersion: 2,
  eventType: 'external_circuit_preflight',
  service,
  observedState: state,
  source,
  mode,
  releaseEligible,
  failClosed: true,
  sourceSha: sha,
  runId,
  observation,
  generatedAt: new Date().toISOString(),
};
event.eventId = createHash('sha256').update(JSON.stringify(event)).digest('hex');
await mkdir('artifacts/ci/external-circuit', { recursive: true });
await writeFile('artifacts/ci/external-circuit/state.json', JSON.stringify(event, null, 2) + '\n');
await writeFile('artifacts/ci/external-circuit/event-ledger.jsonl', JSON.stringify(event) + '\n');
console.log(`External circuit: service=${service} state=${state} mode=${mode} releaseEligible=${releaseEligible} source=${source}`);
console.log(mode === 'external_deferred' ? 'External verification deferred fail-closed; internal correctness gates may continue, but release certification remains blocked.' : 'No production-release eligibility is inferred unless the circuit is explicitly healthy.');
