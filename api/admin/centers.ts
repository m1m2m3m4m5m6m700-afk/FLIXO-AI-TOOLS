import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorizeAdminRequestWithDurableSession } from './boundary.ts';
import { getEvent, getLatestAuditForEvidence, getLatestAuditForEvidence, getLatestEvidenceForAssertion, isPersistenceConfigured, probePersistence } from './persistence.ts';

const CENTER_CAPABILITY = {
  truth: 'truth.read',
  operations: 'operations.read',
  incident: 'operations.read',
  evidence: 'evidence.read',
  security: 'security.read',
  contract: 'contracts.read',
} as const;

type Center = keyof typeof CENTER_CAPABILITY;
type AdminRequest = IncomingMessage & { method?: string; query?: Record<string, string | string[] | undefined> };

const json = (res: ServerResponse, status: number, body: unknown, correlationId: string) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Request-Id', correlationId);
  res.end(JSON.stringify(body));
};

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function adminCenters(req: AdminRequest, res: ServerResponse) {
  const rawCenter = first(req.query?.center)?.trim().toLowerCase();
  if (!rawCenter || !(rawCenter in CENTER_CAPABILITY)) {
    const correlationId = first(req.headers['x-request-id'])?.trim() || randomUUID();
    return json(res, 400, { ok: false, error: { code: 'invalid_admin_center', correlationId } }, correlationId);
  }

  const center = rawCenter as Center;
  const authorization = authorizeAdminRequest(req, CENTER_CAPABILITY[center]);

  if ('status' in authorization) {
    if (authorization.status === 405) res.setHeader('Allow', 'GET');
    return json(res, authorization.status, { ok: false, error: { code: authorization.code, correlationId: authorization.correlationId } }, authorization.correlationId);
  }

  let persistence: { state: 'CONNECTED' | 'BLOCKED'; reason: string; table?: string };
  if (!isPersistenceConfigured()) {
    persistence = { state: 'BLOCKED', reason: 'supabase_server_binding_missing' };
  } else {
    try {
      const probe = await probePersistence();
      persistence = { state: 'CONNECTED', reason: 'canonical_persistence_reachable', table: probe.table };
    } catch {
      persistence = { state: 'BLOCKED', reason: 'canonical_persistence_unreachable' };
    }
  }

  const eventId = first(req.query?.eventId);
  const assertionId = first(req.query?.assertionId);
  let event: Awaited<ReturnType<typeof getEvent>> | undefined;
  let evidence: Awaited<ReturnType<typeof getLatestEvidenceForAssertion>> | undefined;
  let audit: Awaited<ReturnType<typeof getLatestAuditForEvidence>> | undefined;
  if (eventId && (center === 'truth' || center === 'incident')) {
    try {
      event = await getEvent(eventId);
    } catch {
      return json(res, 503, { ok: false, error: { code: 'event_source_unavailable', correlationId: authorization.correlationId } }, authorization.correlationId);
    }
  }
  if (assertionId && (center === 'truth' || center === 'evidence')) {
    try {
      evidence = await getLatestEvidenceForAssertion(assertionId);
    } catch {
      return json(res, 503, { ok: false, error: { code: 'evidence_source_unavailable', correlationId: authorization.correlationId } }, authorization.correlationId);
    }
  }

  const sourceState = persistence.state === 'CONNECTED' ? 'AVAILABLE' : 'UNAVAILABLE';
  return json(res, 200, {
    ok: true,
    source: 'admin-control-plane-read-model',
    center,
    capability: authorization.capability,
    identity: { subject: authorization.subject },
    truth: { state: sourceState, productionConnected: persistence.state === 'CONNECTED', reason: persistence.reason },
    persistence,
    data: {
      event: event ?? null,
      eventLookup: eventId ? (event === null ? 'NOT_FOUND' : 'READ_BACK') : 'NOT_REQUESTED',
      evidence: evidence ?? null,
      evidenceLookup: assertionId ? (evidence === null ? 'NOT_FOUND' : 'READ_BACK') : 'NOT_REQUESTED',
      execution: 'READ_ONLY',
    },
    provenance: {
      exactSha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unavailable',
      environment: process.env.VERCEL_ENV ?? 'unknown',
    },
    correlationId: authorization.correlationId,
  }, authorization.correlationId);
}
