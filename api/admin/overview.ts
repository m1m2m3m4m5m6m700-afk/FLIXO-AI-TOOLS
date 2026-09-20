import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorizeAdminRequestWithDurableSession } from './boundary.ts';
import { probePersistence, isPersistenceConfigured } from './persistence.ts';
import { ADMIN_EXECUTION_CLASSES, ADMIN_MODULES, ADMIN_ROLE_CAPABILITY_MATRIX } from '../../src/lib/admin/module-registry.ts';
import { ADMIN_CAPABILITIES } from '../../src/lib/admin/control-plane.ts';

type AdminRequest = IncomingMessage & {
  method?: string;
};

const json = (res: ServerResponse, status: number, body: unknown, correlationId: string) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Request-Id', correlationId);
  res.end(JSON.stringify(body));
};

export default async function adminOverview(req: AdminRequest, res: ServerResponse) {
  const authorization = authorizeAdminRequestWithDurableSession(req, 'truth.read');

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

  return json(res, 200, {
    ok: true,
    source: 'admin-control-plane-foundation',
    truth: {
      state: persistence.state === 'CONNECTED' ? 'CONNECTED' : 'UNAVAILABLE',
      productionConnected: persistence.state === 'CONNECTED',
      reason: persistence.reason,
    },
    identity: {
      subject: authorization.subject,
      capability: authorization.capability,
    },
    modules: ADMIN_MODULES,
    capabilities: ADMIN_CAPABILITIES,
    roles: ADMIN_ROLE_CAPABILITY_MATRIX,
    executionClasses: ADMIN_EXECUTION_CLASSES,
    persistence,
    provenance: {
      exactSha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unavailable',
      environment: process.env.VERCEL_ENV ?? 'unknown',
    },
    correlationId: authorization.correlationId,
  }, authorization.correlationId);
}
