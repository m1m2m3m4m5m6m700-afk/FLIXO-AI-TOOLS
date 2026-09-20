import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  COUNCIL_ACCOUNTS,
  type CouncilAccountId,
  assertCouncilDispatchAuthorization,
  getCouncilAccount,
  assertExactSha,
} from '../../src/lib/council-account-registry.ts';

type CouncilRequest = IncomingMessage & { method?: string };
type Body = Record<string, unknown>;

const json = (res: ServerResponse, status: number, body: unknown, correlationId: string) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Request-Id', correlationId);
  res.end(JSON.stringify(body));
};

const bearer = (req: CouncilRequest) => {
  const value = String(req.headers.authorization ?? '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
};

const constantTimeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const requireEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('COUNCIL_ENV_MISSING=' + name);
  return value;
};

const authenticate = (req: CouncilRequest, accountId: CouncilAccountId) => {
  const provided = bearer(req);
  const expected = requireEnv(getCouncilAccount(accountId).tokenEnv);
  if (!provided || !constantTimeEqual(provided, expected)) throw new Error('COUNCIL_ACCOUNT_UNAUTHORIZED');
};

const authenticateSystem = (req: CouncilRequest) => {
  const provided = bearer(req);
  const expected = requireEnv('COUNCIL_DISPATCH_SECRET');
  if (!provided || !constantTimeEqual(provided, expected)) throw new Error('COUNCIL_SYSTEM_UNAUTHORIZED');
};

const readBody = async (req: CouncilRequest): Promise<Body> => {
  let raw = '';
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    raw += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    if (raw.length > 1_000_000) throw new Error('COUNCIL_BODY_TOO_LARGE');
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('COUNCIL_BODY_INVALID');
  return parsed as Body;
};

const supabase = () => {
  const url = requireEnv('SUPABASE_URL').replace(/\/$/u, '');
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!key) throw new Error('COUNCIL_ENV_MISSING=SUPABASE_SECRET_KEY');
  return { url, key };
};

const db = async (path: string, init: RequestInit = {}) => {
  const { url, key } = supabase();
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', 'Bearer ' + key);
  headers.set('Accept', 'application/json');
  const response = await fetch(url + path, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(10000) });
  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  }
  if (!response.ok) throw new Error('COUNCIL_DB_FAILED=' + response.status);
  return parsed;
};

const param = (req: CouncilRequest, name: string) =>
  new URL(req.url ?? '/', 'https://flixo.invalid').searchParams.get(name) ?? '';

const accountIdFrom = (value: unknown): CouncilAccountId => {
  const accountId = String(value ?? '').trim();
  if (!(accountId in COUNCIL_ACCOUNTS)) throw new Error('COUNCIL_ACCOUNT_UNKNOWN=' + accountId);
  return accountId as CouncilAccountId;
};

const dispatch = async (body: Body) => {
  const primary = accountIdFrom(body.primaryAccountId);
  const fallback = accountIdFrom(body.fallbackAccountId);
  const requestedBy = String(body.requestedByAccountId ?? 'SYSTEM') as CouncilAccountId | 'SYSTEM';
  const messageId = String(body.messageId ?? '').trim();
  const idempotencyKey = String(body.idempotencyKey ?? messageId).trim();
  const taskId = String(body.taskId ?? '').trim();
  const workPackageId = String(body.workPackageId ?? '').trim();
  const entrySha = String(body.entrySha ?? '').trim();

  if (!messageId || !idempotencyKey || !taskId || !workPackageId) throw new Error('COUNCIL_DISPATCH_IDENTITY_REQUIRED');
  assertExactSha(entrySha);
  assertCouncilDispatchAuthorization(requestedBy, primary, fallback);

  const target = getCouncilAccount(primary);
  const leaseSeconds = Number(body.leaseSeconds ?? (primary === 'CHIEF' ? 180 : 120));
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 15 || leaseSeconds > 3600) {
    throw new Error('COUNCIL_LEASE_SECONDS_INVALID');
  }

  const leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const payload = { ...body, requestedByAccountId: requestedBy, exactSha: entrySha };

  const insert = await db('/rest/v1/flix_council_dispatches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      message_id: messageId,
      idempotency_key: idempotencyKey,
      task_id: taskId,
      work_package_id: workPackageId,
      entry_sha: entrySha,
      primary_account_id: primary,
      fallback_account_id: fallback,
      recipient_account_id: primary,
      handoff_account_id: 'CHIEF',
      status: 'LEASED',
      payload,
      evidence: {},
      lease_expires_at: leaseExpiresAt,
      attempts: 1,
    }),
  }) as Array<Record<string, unknown>>;

  let record = insert?.[0];
  if (!record) {
    const existing = await db(
      '/rest/v1/flix_council_dispatches?idempotency_key=eq.' + encodeURIComponent(idempotencyKey) + '&select=*&limit=1',
    ) as Array<Record<string, unknown>>;
    record = existing?.[0];
  }
  if (!record) throw new Error('COUNCIL_DISPATCH_NOT_PERSISTED');

  const dispatchId = String(record.dispatch_id);
  const eventBody = {
    dispatch_id: dispatchId,
    account_id: primary,
    event_type: 'DISPATCHED',
    exact_sha: entrySha,
    payload: { requestedBy, attempt: record.attempts },
  };
  await db('/rest/v1/flix_council_events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(eventBody),
  }).catch(() => null);

  const endpoint = target.endpointEnv ? process.env[target.endpointEnv]?.trim() : '';
  const token = process.env[target.tokenEnv]?.trim() ?? '';
  let push = { attempted: false, ok: false, reason: 'POLL_ONLY' };

  if (endpoint && token) {
    push = { attempted: true, ok: false, reason: 'UNSET' };
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          wakeType: 'FLIXO_COUNCIL_WAKE',
          dispatchId,
          accountId: primary,
          exactSha: entrySha,
          taskId,
          workPackageId,
          payload,
        }),
        signal: AbortSignal.timeout(8000),
      });
      push.ok = response.ok;
      push.reason = response.ok ? 'DELIVERED' : 'HTTP_' + response.status;
    } catch (error) {
      push.reason = String(error instanceof Error ? error.message : error);
    }
    if (!push.ok) {
      await db('/rest/v1/flix_council_events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          dispatch_id: dispatchId,
          account_id: primary,
          event_type: 'WAKE_PUSH_FAILED',
          exact_sha: entrySha,
          payload: { reason: push.reason, fallbackAccountId: fallback },
        }),
      }).catch(() => null);
    }
  }

  return {
    dispatchId,
    status: record.status,
    entrySha: record.entry_sha,
    primaryAccountId: primary,
    fallbackAccountId: fallback,
    leaseExpiresAt: record.lease_expires_at,
    push,
    pollUrl: '/api/council/external-runtime?action=poll&accountId=' + primary,
  };
};

export default async function councilExternalRuntime(req: CouncilRequest, res: ServerResponse) {
  const correlationId = crypto.randomUUID();

  try {
    const action = param(req, 'action') || (req.method === 'GET' ? 'poll' : '');
    if (action === 'poll' && req.method === 'GET') {
      const accountId = accountIdFrom(param(req, 'accountId'));
      authenticate(req, accountId);
      const rows = await db('/rest/v1/rpc/council_claim_dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_account_id: accountId }),
      }) as Array<Record<string, unknown>>;
      return json(res, 200, { ok: true, accountId, dispatch: rows?.[0] ?? null }, correlationId);
    }

    if (action === 'handoffs' && req.method === 'GET') {
      authenticate(req, 'CHIEF');
      const since = param(req, 'since');
      const filter = since ? '&created_at=gt.' + encodeURIComponent(since) : '';
      const rows = await db(
        '/rest/v1/flix_council_events?account_id=eq.CHIEF&event_type=eq.HANDOFF_READY&select=*&order=created_at.asc&limit=25' + filter,
      );
      return json(res, 200, { ok: true, accountId: 'CHIEF', events: rows }, correlationId);
    }

    const body = await readBody(req);

    if (action === 'dispatch' && req.method === 'POST') {
      const requestedBy = String(body.requestedByAccountId ?? 'SYSTEM');
      if (requestedBy === 'SYSTEM') authenticateSystem(req);
      else {
        if (requestedBy !== 'CHIEF') throw new Error('COUNCIL_WORKER_DISPATCH_FORBIDDEN');
        authenticate(req, 'CHIEF');
      }
      return json(res, 202, { ok: true, ...(await dispatch(body)) }, correlationId);
    }

    if (action === 'ack' && req.method === 'POST') {
      const accountId = accountIdFrom(body.accountId);
      authenticate(req, accountId);
      const dispatchId = String(body.dispatchId ?? '').trim();
      const sessionId = String(body.sessionId ?? '').trim();
      const entrySha = String(body.entrySha ?? '').trim();
      if (!dispatchId || !sessionId) throw new Error('COUNCIL_ACK_FIELDS_REQUIRED');
      assertExactSha(entrySha);
      const result = await db('/rest/v1/rpc/council_ack_dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_dispatch_id: dispatchId, p_account_id: accountId, p_session_id: sessionId, p_exact_sha: entrySha }),
      });
      return json(res, 200, { ok: true, dispatch: Array.isArray(result) ? (result[0] ?? null) : result }, correlationId);
    }

    if (action === 'heartbeat' && req.method === 'POST') {
      const accountId = accountIdFrom(body.accountId);
      authenticate(req, accountId);
      const dispatchId = String(body.dispatchId ?? '').trim();
      const sessionId = String(body.sessionId ?? '').trim();
      const entrySha = String(body.entrySha ?? '').trim();
      if (!dispatchId || !sessionId) throw new Error('COUNCIL_HEARTBEAT_FIELDS_REQUIRED');
      assertExactSha(entrySha);
      const result = await db('/rest/v1/rpc/council_heartbeat_dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_dispatch_id: dispatchId, p_account_id: accountId, p_session_id: sessionId, p_exact_sha: entrySha }),
      });
      return json(res, 200, { ok: true, dispatch: Array.isArray(result) ? (result[0] ?? null) : result }, correlationId);
    }

    if (action === 'complete' && req.method === 'POST') {
      const accountId = accountIdFrom(body.accountId);
      authenticate(req, accountId);
      const dispatchId = String(body.dispatchId ?? '').trim();
      const sessionId = String(body.sessionId ?? '').trim();
      const entrySha = String(body.entrySha ?? '').trim();
      const status = String(body.status ?? 'DONE');
      if (!dispatchId || !sessionId || !['DONE', 'FAILED'].includes(status)) throw new Error('COUNCIL_COMPLETE_FIELDS_INVALID');
      assertExactSha(entrySha);
      const result = await db('/rest/v1/rpc/council_complete_dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_dispatch_id: dispatchId,
          p_account_id: accountId,
          p_session_id: sessionId,
          p_exact_sha: entrySha,
          p_status: status,
          p_evidence: body.evidence ?? {},
          p_payload: body.payload ?? {},
        }),
      });
      return json(res, 200, { ok: true, dispatch: Array.isArray(result) ? (result[0] ?? null) : result }, correlationId);
    }

    if (action === 'recover' && req.method === 'POST') {
      authenticateSystem(req);
      const limit = Number(body.limit ?? 10);
      if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('COUNCIL_RECOVER_LIMIT_INVALID');
      const rows = await db('/rest/v1/rpc/council_recover_expired_dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_limit: limit }),
      }) as Array<Record<string, unknown>>;

      for (const row of rows ?? []) {
        const accountId = accountIdFrom(row.recipient_account_id);
        const account = getCouncilAccount(accountId);
        const endpoint = account.endpointEnv ? process.env[account.endpointEnv]?.trim() : '';
        const token = process.env[account.tokenEnv]?.trim() ?? '';
        if (endpoint && token) {
          await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({
              wakeType: 'FLIXO_COUNCIL_WAKE_FALLBACK',
              dispatchId: row.dispatch_id,
              accountId,
              exactSha: row.entry_sha,
              taskId: row.task_id,
              workPackageId: row.work_package_id,
              payload: row.payload,
            }),
            signal: AbortSignal.timeout(8000),
          }).catch(() => null);
        }
      }

      return json(res, 200, {
        ok: true,
        recovered: (rows ?? []).map((row) => ({
          dispatchId: row.dispatch_id,
          recipientAccountId: row.recipient_account_id,
          attempts: row.attempts,
          entrySha: row.entry_sha,
        })),
      }, correlationId);
    }

    throw new Error('COUNCIL_ACTION_UNSUPPORTED');
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    const status = message.includes('UNAUTHORIZED') || message.includes('AUTH_') ? 401 : 403;
    return json(res, status, { ok: false, error: message }, correlationId);
  }
}
