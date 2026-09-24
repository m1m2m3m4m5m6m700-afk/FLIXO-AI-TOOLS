import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  CouncilAckRequest,
  CouncilCompleteRequest,
  CouncilCompleteStatus,
  CouncilDispatchAcceptedResponse,
  CouncilDispatchRecord,
  CouncilDispatchRequest,
  CouncilDispatchStatus,
  CouncilDispatchRpcResponse,
  CouncilEventRecord,
  CouncilHandoffsResponse,
  CouncilHeartbeatRequest,
  CouncilPollResponse,
  CouncilRecoverRequest,
  CouncilRecoverResponse,
  CouncilErrorResponse,
  JsonObject,
  JsonValue,
} from '../contracts.ts';
import {
  COUNCIL_ACCOUNTS,
  type CouncilAccountId,
  assertCouncilDispatchAuthorization,
  getCouncilAccount,
  assertExactSha,
} from '../../src/lib/council-account-registry.ts';

interface CouncilRequest extends IncomingMessage {
  method?: string;
}

const json = <TBody extends CouncilErrorResponse | CouncilPollResponse | CouncilHandoffsResponse | CouncilDispatchAcceptedResponse | CouncilDispatchRpcResponse | CouncilRecoverResponse>(
  res: ServerResponse,
  status: number,
  body: TBody,
  correlationId: string,
): void => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Request-Id', correlationId);
  res.end(JSON.stringify(body));
};

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry));
  return isJsonObject(value) && Object.values(value).every((entry) => isJsonValue(entry));
};

const bearer = (req: CouncilRequest): string => {
  const value = String(req.headers.authorization ?? '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
};

const constantTimeEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('COUNCIL_ENV_MISSING=' + name);
  return value;
};

const authenticate = (req: CouncilRequest, accountId: CouncilAccountId): void => {
  const provided = bearer(req);
  const expected = requireEnv(getCouncilAccount(accountId).tokenEnv);
  if (!provided || !constantTimeEqual(provided, expected)) throw new Error('COUNCIL_ACCOUNT_UNAUTHORIZED');
};

const authenticateSystem = (req: CouncilRequest): void => {
  const provided = bearer(req);
  const expected = requireEnv('COUNCIL_DISPATCH_SECRET');
  if (!provided || !constantTimeEqual(provided, expected)) throw new Error('COUNCIL_SYSTEM_UNAUTHORIZED');
};

const readBody = async (req: CouncilRequest): Promise<JsonObject> => {
  let raw = '';
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    raw += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    if (raw.length > 1_000_000) throw new Error('COUNCIL_BODY_TOO_LARGE');
  }
  if (!raw.trim()) return {};

  const parsed: unknown = JSON.parse(raw);
  if (!isJsonObject(parsed)) throw new Error('COUNCIL_BODY_INVALID');
  return parsed;
};

interface SupabaseConfig {
  url: string;
  key: string;
}

const supabase = (): SupabaseConfig => {
  const url = requireEnv('SUPABASE_URL').replace(/\/$/u, '');
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!key) throw new Error('COUNCIL_ENV_MISSING=SUPABASE_SECRET_KEY');
  return { url, key };
};

const db = async (path: string, init: RequestInit = {}): Promise<JsonValue> => {
  const { url, key } = supabase();
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', 'Bearer ' + key);
  headers.set('Accept', 'application/json');

  const response = await fetch(url + path, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(10000),
  });
  const raw = await response.text();
  let parsed: JsonValue = null;

  if (raw) {
    try {
      const candidate: unknown = JSON.parse(raw);
      if (!isJsonValue(candidate)) throw new Error('COUNCIL_DB_INVALID_JSON_RESPONSE');
      parsed = candidate;
    } catch (error) {
      if (error instanceof Error && error.message === 'COUNCIL_DB_INVALID_JSON_RESPONSE') throw error;
      parsed = raw;
    }
  }

  if (!response.ok) throw new Error('COUNCIL_DB_FAILED=' + response.status);
  return parsed;
};

const param = (req: CouncilRequest, name: string): string =>
  new URL(req.url ?? '/', 'https://flixo.invalid').searchParams.get(name)?.trim() ?? '';

const isCouncilAccountId = (value: unknown): value is CouncilAccountId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(COUNCIL_ACCOUNTS, value);

const accountIdFrom = (value: JsonValue | undefined): CouncilAccountId => {
  const accountId = String(value ?? '').trim();
  if (!isCouncilAccountId(accountId)) throw new Error('COUNCIL_ACCOUNT_UNKNOWN=' + accountId);
  return accountId;
};

const requiredString = (body: JsonObject, key: string, errorCode: string): string => {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(errorCode);
  return value.trim();
};

const optionalString = (body: JsonObject, key: string): string | undefined => {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const requestedByFrom = (value: JsonValue | undefined): CouncilAccountId | 'SYSTEM' => {
  const requestedBy = String(value ?? 'SYSTEM').trim();
  if (requestedBy === 'SYSTEM' || requestedBy === 'CHIEF') return requestedBy;
  throw new Error('COUNCIL_REQUESTER_INVALID');
};

const dispatchStatusFrom = (value: JsonValue | undefined): CouncilCompleteStatus => {
  const status = String(value ?? 'DONE').trim();
  if (status === 'DONE' || status === 'FAILED') return status;
  throw new Error('COUNCIL_COMPLETE_FIELDS_INVALID');
};

const parseDispatchRequest = (body: JsonObject): CouncilDispatchRequest => {
  const primaryAccountId = accountIdFrom(body.primaryAccountId);
  const fallbackAccountId = accountIdFrom(body.fallbackAccountId);
  const messageId = requiredString(body, 'messageId', 'COUNCIL_DISPATCH_IDENTITY_REQUIRED');
  const idempotencyKey = optionalString(body, 'idempotencyKey') ?? messageId;
  const taskId = requiredString(body, 'taskId', 'COUNCIL_DISPATCH_IDENTITY_REQUIRED');
  const workPackageId = requiredString(body, 'workPackageId', 'COUNCIL_DISPATCH_IDENTITY_REQUIRED');
  const entrySha = requiredString(body, 'entrySha', 'COUNCIL_DISPATCH_IDENTITY_REQUIRED');
  const leaseValue = body.leaseSeconds;
  const leaseSeconds = leaseValue === undefined ? undefined : Number(leaseValue);
  if (leaseSeconds !== undefined && !Number.isInteger(leaseSeconds)) throw new Error('COUNCIL_LEASE_SECONDS_INVALID');

  assertExactSha(entrySha);
  if (!messageId || !idempotencyKey || !taskId || !workPackageId) throw new Error('COUNCIL_DISPATCH_IDENTITY_REQUIRED');

  return {
    primaryAccountId,
    fallbackAccountId,
    requestedByAccountId: requestedByFrom(body.requestedByAccountId),
    messageId,
    idempotencyKey,
    taskId,
    workPackageId,
    entrySha,
    leaseSeconds,
  };
};

const parseAckRequest = (body: JsonObject): CouncilAckRequest => {
  const request: CouncilAckRequest = {
    accountId: accountIdFrom(body.accountId),
    dispatchId: requiredString(body, 'dispatchId', 'COUNCIL_ACK_FIELDS_REQUIRED'),
    sessionId: requiredString(body, 'sessionId', 'COUNCIL_ACK_FIELDS_REQUIRED'),
    entrySha: requiredString(body, 'entrySha', 'COUNCIL_ACK_FIELDS_REQUIRED'),
  };
  assertExactSha(request.entrySha);
  return request;
};

const parseHeartbeatRequest = (body: JsonObject): CouncilHeartbeatRequest => {
  const request: CouncilHeartbeatRequest = {
    accountId: accountIdFrom(body.accountId),
    dispatchId: requiredString(body, 'dispatchId', 'COUNCIL_HEARTBEAT_FIELDS_REQUIRED'),
    sessionId: requiredString(body, 'sessionId', 'COUNCIL_HEARTBEAT_FIELDS_REQUIRED'),
    entrySha: requiredString(body, 'entrySha', 'COUNCIL_HEARTBEAT_FIELDS_REQUIRED'),
  };
  assertExactSha(request.entrySha);
  return request;
};

const parseCompleteRequest = (body: JsonObject): CouncilCompleteRequest => {
  const request: CouncilCompleteRequest = {
    ...parseHeartbeatRequest(body),
    status: dispatchStatusFrom(body.status),
    evidence: body.evidence === undefined ? {} : isJsonObject(body.evidence) ? body.evidence : (() => { throw new Error('COUNCIL_COMPLETE_EVIDENCE_INVALID'); })(),
    payload: body.payload === undefined ? {} : isJsonObject(body.payload) ? body.payload : (() => { throw new Error('COUNCIL_COMPLETE_PAYLOAD_INVALID'); })(),
  };
  return request;
};

const parseRecoverRequest = (body: JsonObject): CouncilRecoverRequest => {
  const rawLimit = body.limit;
  const limit = rawLimit === undefined ? 10 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('COUNCIL_RECOVER_LIMIT_INVALID');
  return { limit };
};

const isCouncilDispatchStatus = (value: JsonValue): value is CouncilDispatchStatus =>
  typeof value === 'string'
  && ['LEASED', 'ACKED', 'DONE', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(value);

const isCouncilEventType = (value: JsonValue): value is CouncilEventRecord['event_type'] =>
  typeof value === 'string'
  && [
    'DISPATCHED',
    'ACKED',
    'HEARTBEAT',
    'COMPLETED',
    'FAILED',
    'EXPIRED',
    'HANDOFF_READY',
    'WAKE_PUSH_FAILED',
  ].includes(value);

const isNullableString = (value: JsonValue): value is string | null =>
  value === null || typeof value === 'string';

const isCouncilDispatchRecord = (value: JsonValue): value is CouncilDispatchRecord => {
  if (!isJsonObject(value)) return false;
  return typeof value.dispatch_id === 'string'
    && typeof value.message_id === 'string'
    && typeof value.idempotency_key === 'string'
    && typeof value.task_id === 'string'
    && typeof value.work_package_id === 'string'
    && typeof value.entry_sha === 'string'
    && isCouncilAccountId(value.primary_account_id)
    && isCouncilAccountId(value.fallback_account_id)
    && isCouncilAccountId(value.recipient_account_id)
    && isCouncilAccountId(value.handoff_account_id)
    && isCouncilDispatchStatus(value.status)
    && isJsonObject(value.payload)
    && isJsonObject(value.evidence)
    && isNullableString(value.session_id)
    && isNullableString(value.lease_expires_at)
    && isNullableString(value.acked_at)
    && isNullableString(value.completed_at)
    && typeof value.attempts === 'number'
    && isNullableString(value.last_error)
    && typeof value.created_at === 'string'
    && typeof value.updated_at === 'string';
};

const isCouncilEventRecord = (value: JsonValue): value is CouncilEventRecord => {
  if (!isJsonObject(value)) return false;
  return typeof value.event_id === 'string'
    && isNullableString(value.dispatch_id)
    && (value.account_id === null || isCouncilAccountId(value.account_id))
    && isCouncilEventType(value.event_type)
    && typeof value.exact_sha === 'string'
    && isJsonObject(value.payload)
    && typeof value.created_at === 'string';
};

const councilDispatchRecord = (value: JsonValue): CouncilDispatchRecord => {
  if (!isCouncilDispatchRecord(value)) throw new Error('COUNCIL_DB_INVALID_DISPATCH_RECORD');
  return value;
};

const councilDispatchArray = (value: JsonValue): CouncilDispatchRecord[] => {
  if (!Array.isArray(value) || !value.every((entry) => isCouncilDispatchRecord(entry))) {
    throw new Error('COUNCIL_DB_INVALID_DISPATCH_ROWS');
  }
  return value;
};

const councilEventArray = (value: JsonValue): CouncilEventRecord[] => {
  if (!Array.isArray(value) || !value.every((entry) => isCouncilEventRecord(entry))) {
    throw new Error('COUNCIL_DB_INVALID_EVENT_ROWS');
  }
  return value;
};

interface DispatchPersistenceResult {
  record: CouncilDispatchRecord;
  dispatchId: string;
}

const dispatch = async (request: CouncilDispatchRequest, rawBody: JsonObject): Promise<CouncilDispatchAcceptedResponse> => {
  const primary = request.primaryAccountId;
  const fallback = request.fallbackAccountId;
  const requestedBy = request.requestedByAccountId ?? 'SYSTEM';
  const target = getCouncilAccount(primary);

  assertCouncilDispatchAuthorization(requestedBy, primary, fallback);

  const leaseSeconds = request.leaseSeconds ?? (primary === 'CHIEF' ? 180 : 120);
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 15 || leaseSeconds > 3600) {
    throw new Error('COUNCIL_LEASE_SECONDS_INVALID');
  }

  const leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const payload: JsonObject = {
    ...rawBody,
    requestedByAccountId: requestedBy,
    exactSha: request.entrySha,
  };

  const insert = councilDispatchArray(await db('/rest/v1/flix_council_dispatches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify({
      message_id: request.messageId,
      idempotency_key: request.idempotencyKey,
      task_id: request.taskId,
      work_package_id: request.workPackageId,
      entry_sha: request.entrySha,
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
  }));

  let record: CouncilDispatchRecord | undefined = insert[0];
  if (!record) {
    const existing = councilDispatchArray(await db(
      '/rest/v1/flix_council_dispatches?idempotency_key=eq.' + encodeURIComponent(request.idempotencyKey ?? request.messageId) + '&select=*&limit=1',
    ));
    record = existing[0];
  }
  if (!record) throw new Error('COUNCIL_DISPATCH_NOT_PERSISTED');

  const eventBody = {
    dispatch_id: record.dispatch_id,
    account_id: primary,
    event_type: 'DISPATCHED',
    exact_sha: request.entrySha,
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          wakeType: 'FLIXO_COUNCIL_WAKE',
          dispatchId: record.dispatch_id,
          accountId: primary,
          exactSha: request.entrySha,
          taskId: request.taskId,
          workPackageId: request.workPackageId,
          payload,
        }),
        signal: AbortSignal.timeout(8000),
      });
      push.ok = response.ok;
      push.reason = response.ok ? 'DELIVERED' : 'HTTP_' + response.status;
    } catch (error) {
      push.reason = error instanceof Error ? error.message : String(error);
    }

    if (!push.ok) {
      await db('/rest/v1/flix_council_events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          dispatch_id: record.dispatch_id,
          account_id: primary,
          event_type: 'WAKE_PUSH_FAILED',
          exact_sha: request.entrySha,
          payload: { reason: push.reason, fallbackAccountId: fallback },
        }),
      }).catch(() => null);
    }
  }

  return {
    ok: true,
    dispatchId: record.dispatch_id,
    status: record.status,
    entrySha: record.entry_sha,
    primaryAccountId: primary,
    fallbackAccountId: fallback,
    leaseExpiresAt: record.lease_expires_at,
    push,
    pollUrl: '/api/council/external-runtime?action=poll&accountId=' + primary,
  };
};

export default async function councilExternalRuntime(req: CouncilRequest, res: ServerResponse): Promise<void> {
  const correlationId = randomUUID();

  try {
    const action = param(req, 'action') || (req.method === 'GET' ? 'poll' : '');

    if (action === 'poll' && req.method === 'GET') {
      const accountId = accountIdFrom(param(req, 'accountId'));
      authenticate(req, accountId);
      const rows = councilDispatchArray(await db('/rest/v1/rpc/council_claim_dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_account_id: accountId }),
      }));
      const response: CouncilPollResponse = {
        ok: true,
        accountId,
        dispatch: rows[0] ?? null,
      };
      return json(res, 200, response, correlationId);
    }

    if (action === 'handoffs' && req.method === 'GET') {
      authenticate(req, 'CHIEF');
      const since = param(req, 'since');
      const filter = since ? '&created_at=gt.' + encodeURIComponent(since) : '';
      const rows = councilEventArray(await db(
        '/rest/v1/flix_council_events?account_id=eq.CHIEF&event_type=eq.HANDOFF_READY&select=*&order=created_at.asc&limit=25' + filter,
      ));
      const response: CouncilHandoffsResponse = {
        ok: true,
        accountId: 'CHIEF',
        events: rows,
      };
      return json(res, 200, response, correlationId);
    }

    const body = await readBody(req);

    if (action === 'dispatch' && req.method === 'POST') {
      const request = parseDispatchRequest(body);
      if (request.requestedByAccountId === 'SYSTEM') authenticateSystem(req);
      else authenticate(req, 'CHIEF');
      const response = await dispatch(request, body);
      return json(res, 202, response, correlationId);
    }

    if (action === 'ack' && req.method === 'POST') {
      const request = parseAckRequest(body);
      authenticate(req, request.accountId);
      const result = councilDispatchRecord(await db('/rest/v1/rpc/council_ack_dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_dispatch_id: request.dispatchId,
          p_account_id: request.accountId,
          p_session_id: request.sessionId,
          p_exact_sha: request.entrySha,
        }),
      }));
      const response: CouncilDispatchRpcResponse = {
        ok: true,
        dispatch: result,
      };
      return json(res, 200, response, correlationId);
    }

    if (action === 'heartbeat' && req.method === 'POST') {
      const request = parseHeartbeatRequest(body);
      authenticate(req, request.accountId);
      const result = councilDispatchRecord(await db('/rest/v1/rpc/council_heartbeat_dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_dispatch_id: request.dispatchId,
          p_account_id: request.accountId,
          p_session_id: request.sessionId,
          p_exact_sha: request.entrySha,
        }),
      }));
      const response: CouncilDispatchRpcResponse = {
        ok: true,
        dispatch: result,
      };
      return json(res, 200, response, correlationId);
    }

    if (action === 'complete' && req.method === 'POST') {
      const request = parseCompleteRequest(body);
      authenticate(req, request.accountId);
      const status = request.status ?? 'DONE';
      const result = councilDispatchRecord(await db('/rest/v1/rpc/council_complete_dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_dispatch_id: request.dispatchId,
          p_account_id: request.accountId,
          p_session_id: request.sessionId,
          p_exact_sha: request.entrySha,
          p_status: status,
          p_evidence: request.evidence ?? {},
          p_payload: request.payload ?? {},
        }),
      }));
      const response: CouncilDispatchRpcResponse = {
        ok: true,
        dispatch: result,
      };
      return json(res, 200, response, correlationId);
    }

    if (action === 'recover' && req.method === 'POST') {
      authenticateSystem(req);
      const request = parseRecoverRequest(body);
      const rows = councilDispatchArray(await db('/rest/v1/rpc/council_recover_expired_dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_limit: request.limit }),
      }));

      for (const row of rows) {
        const account = getCouncilAccount(row.recipient_account_id);
        const endpoint = account.endpointEnv ? process.env[account.endpointEnv]?.trim() : '';
        const token = process.env[account.tokenEnv]?.trim() ?? '';
        if (endpoint && token) {
          await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token,
            },
            body: JSON.stringify({
              wakeType: 'FLIXO_COUNCIL_WAKE_FALLBACK',
              dispatchId: row.dispatch_id,
              accountId: row.recipient_account_id,
              exactSha: row.entry_sha,
              taskId: row.task_id,
              workPackageId: row.work_package_id,
              payload: row.payload,
            }),
            signal: AbortSignal.timeout(8000),
          }).catch(() => null);
        }
      }

      const response: CouncilRecoverResponse = {
        ok: true,
        recovered: rows.map((row) => ({
          dispatchId: row.dispatch_id,
          recipientAccountId: row.recipient_account_id,
          attempts: row.attempts,
          entrySha: row.entry_sha,
        })),
      };
      return json(res, 200, response, correlationId);
    }

    throw new Error('COUNCIL_ACTION_UNSUPPORTED');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('UNAUTHORIZED') || message.includes('AUTH_') ? 401 : 403;
    const response: CouncilErrorResponse = { ok: false, error: message };
    return json(res, status, response, correlationId);
  }
}
