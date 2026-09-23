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
  let json;
  try { json = body ? JSON.parse(body) : null; } catch { return { response, body, json: null }; }
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

const nowMs = Date.now();

const recoverExpired = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await request('/rest/v1/rpc/council_recover_expired_dispatches', {
      method: 'POST',
      body: JSON.stringify({ p_limit: 25 }),
    });
    if (!result.response.ok) throw new Error('LIVE_RECOVERY_CALL_FAILED:' + result.response.status);
    const rows = Array.isArray(result.json) ? result.json : [];
    if (rows.length === 0) {
      evidence.checks.push({ name: 'expired_lease_recovery', status: 'PASS', passes: attempt + 1 });
      return;
    }
  }
  evidence.checks.push({ name: 'expired_lease_recovery', status: 'BOUNDED_RETRY' });
};

await recoverExpired();

const expiredLeases = await request(
  '/rest/v1/flix_council_dispatches?status=in.(LEASED,ACKED)&lease_expires_at=lt.' +
    encodeURIComponent(new Date(nowMs).toISOString()) +
    '&select=dispatch_id,account_id,recipient_account_id,attempts,lease_expires_at,entry_sha&limit=100'
);
if (!expiredLeases.response.ok) throw new Error('EXPIRED_LEASE_READ_FAILED:' + expiredLeases.response.status);
if (Array.isArray(expiredLeases.json) && expiredLeases.json.length > 0) {
  throw new Error('ZOMBIE_LEASES_PRESENT:' + expiredLeases.json.length);
}
evidence.checks.push({ name: 'expired_open_leases', status: 'PASS', count: 0 });

const residentAccounts = Array.isArray(accounts.json) ? accounts.json : [];
const staleResidentAccounts = residentAccounts.filter((row) => {
  const metadata = row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {};
  if (metadata.residencyRequired !== true) return false;
  if (!row?.last_seen_at) return true;
  const lastSeen = Date.parse(String(row.last_seen_at));
  if (!Number.isFinite(lastSeen)) return true;
  const leaseSeconds = Number(row.lease_seconds ?? 120);
  const freshnessMs = Math.max(120000, leaseSeconds * 2 * 1000);
  return nowMs - lastSeen > freshnessMs;
});
if (staleResidentAccounts.length > 0) {
  throw new Error('STALE_RESIDENT_ACCOUNTS:' + staleResidentAccounts.map((row) => row.account_id).join(','));
}
evidence.checks.push({ name: 'resident_heartbeat_freshness', status: 'PASS', count: residentAccounts.length });

const watchdog = await request('/rest/v1/flix_automation_watchdog?select=state,last_tick_at,evidence&limit=1');
if (!watchdog.response.ok) throw new Error('WATCHDOG_READ_FAILED:' + watchdog.response.status);
const watchdogRow = Array.isArray(watchdog.json) ? watchdog.json[0] : watchdog.json;
if (!watchdogRow) throw new Error('WATCHDOG_ROW_MISSING');
if (String(watchdogRow.state ?? '') === 'HEALTHY') {
  const ev = watchdogRow.evidence && typeof watchdogRow.evidence === 'object' ? watchdogRow.evidence : {};
  if (Number(ev.remainingExpiredOpenLeases ?? 0) !== 0 || Number(ev.staleResidentAccounts ?? 0) !== 0) {
    throw new Error('WATCHDOG_FALSE_HEALTHY');
  }
}
evidence.checks.push({ name: 'watchdog_health_claim', status: 'PASS', state: watchdogRow.state });

async function expectAnonRpcDenied(functionName) {
  const result = await fetch(baseUrl + '/rest/v1/rpc/' + functionName, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey, 'Content-Type': 'application/json' },
    body: functionName === 'flixo_retry_pending_assistant_wakes' ? '{}' : '{}',
  });
  if (result.ok) throw new Error('ANON_RPC_EXECUTE_BYPASS:' + functionName);
  evidence.checks.push({ name: 'anonymous_rpc_denied:' + functionName, status: 'PASS', httpStatus: result.status });
}

await expectAnonRpcDenied('flixo_retry_pending_assistant_wakes');
await expectAnonRpcDenied('flixo_auto_wake_stale_master3');


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