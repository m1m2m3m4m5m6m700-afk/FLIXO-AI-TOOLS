#!/usr/bin/env node
import fs from 'node:fs';

const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/u, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';
const expectedSha = process.env.EXPECTED_SHA || '';
const runId = process.env.GITHUB_RUN_ID || 'unknown';
const out = process.env.EVIDENCE_OUTPUT_PATH || 'council-live-runtime-evidence.json';

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/u.test(baseUrl)) throw new Error('SUPABASE_URL_INVALID');
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING');
if (!anonKey) throw new Error('SUPABASE_ANON_KEY_MISSING');
if (!/^[0-9a-f]{40}$/u.test(expectedSha)) throw new Error('EXPECTED_SHA_INVALID');

const evidence = {
  schemaVersion: 1,
  state: 'LIVE_VERIFIED',
  verifiedSha: expectedSha,
  verifiedAt: new Date().toISOString(),
  provider: 'supabase',
  verifier: 'github-actions-run:' + runId,
  evidenceRef: 'workflow:flixo-council-live-runtime-verification#' + runId,
  checks: [],
};

async function request(path, init = {}) {
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  let json = null;
  try { json = body ? JSON.parse(body) : null; } catch { json = null; }
  return { response, body, json };
}

async function rpcProbe(functionName, payload, expectedMarker) {
  const result = await request('/rest/v1/rpc/' + functionName, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const combined = String(result.body) + ' ' + JSON.stringify(result.json ?? '');
  if (result.response.ok || !combined.includes(expectedMarker)) {
    throw new Error('RPC_PROBE_FAILED:' + functionName + ':' + result.response.status + ':' + expectedMarker);
  }
  evidence.checks.push({ name: functionName, status: 'PASS', expectedMarker, httpStatus: result.response.status });
}

const accounts = await request('/rest/v1/flix_council_accounts?select=account_id,active,lease_seconds&order=account_id.asc');
if (!accounts.response.ok) throw new Error('ACCOUNTS_READ_FAILED:' + accounts.response.status);
const accountIds = Array.isArray(accounts.json) ? accounts.json.map((row) => row?.account_id).sort() : [];
if (JSON.stringify(accountIds) !== JSON.stringify(['CHIEF','WORKER_A','WORKER_B'])) {
  throw new Error('ACCOUNTS_SET_INVALID:' + JSON.stringify(accountIds));
}
evidence.checks.push({ name: 'accounts_readback', status: 'PASS', accountIds });

const anon = await fetch(baseUrl + '/rest/v1/flix_council_accounts?select=account_id', {
  headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey },
});
if (anon.ok) throw new Error('ANON_RLS_READ_BYPASS');
evidence.checks.push({ name: 'anonymous_table_access_denied', status: 'PASS', httpStatus: anon.status });

await rpcProbe('council_claim_dispatch', { p_account_id: 'INVALID_ACCOUNT' }, 'COUNCIL_ACCOUNT_INVALID');
await rpcProbe('council_ack_dispatch', { p_dispatch_id: '00000000-0000-0000-0000-000000000000', p_account_id: 'WORKER_A', p_session_id: 'live-probe', p_exact_sha: 'invalid' }, 'COUNCIL_EXACT_SHA_INVALID');
await rpcProbe('council_heartbeat_dispatch', { p_dispatch_id: '00000000-0000-0000-0000-000000000000', p_account_id: 'WORKER_A', p_session_id: 'live-probe', p_exact_sha: 'invalid' }, 'COUNCIL_EXACT_SHA_INVALID');
await rpcProbe('council_complete_dispatch', { p_dispatch_id: '00000000-0000-0000-0000-000000000000', p_account_id: 'WORKER_A', p_session_id: 'live-probe', p_exact_sha: 'invalid', p_status: 'DONE', p_evidence: {}, p_payload: {} }, 'COUNCIL_EXACT_SHA_INVALID');
await rpcProbe('council_recover_expired_dispatches', { p_limit: 0 }, 'COUNCIL_RECOVERY_LIMIT_INVALID');

evidence.checks.push({ name: 'live_runtime_contract', status: 'PASS', note: 'Read-only probes confirmed live Council tables, RLS boundary, RPC existence, and fail-closed validation markers.' });
fs.writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));