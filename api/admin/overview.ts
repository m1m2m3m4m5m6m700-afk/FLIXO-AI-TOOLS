import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorizeAdminRequest } from './boundary.ts';
import { ADMIN_EXECUTION_CLASSES, ADMIN_MODULES, ADMIN_ROLE_CAPABILITY_MATRIX } from '../../src/lib/admin/module-registry';
import { ADMIN_CAPABILITIES } from '../../src/lib/admin/control-plane';

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
  const authorization = authorizeAdminRequest(req, 'truth.read');

  if ('status' in authorization) {
    if (authorization.status === 405) res.setHeader('Allow', 'GET');
    return json(res, authorization.status, { ok: false, error: { code: authorization.code, correlationId: authorization.correlationId } }, authorization.correlationId);
  }

  return json(res, 200, {
    ok: true,
    source: 'admin-control-plane-foundation',
    truth: {
      state: 'UNAVAILABLE',
      productionConnected: false,
      reason: 'live_production_truth_sources_not_connected',
    },
    identity: {
      subject: authorization.subject,
      capability: authorization.capability,
    },
    modules: ADMIN_MODULES,
    capabilities: ADMIN_CAPABILITIES,
    roles: ADMIN_ROLE_CAPABILITY_MATRIX,
    executionClasses: ADMIN_EXECUTION_CLASSES,
    persistence: {
      state: 'BLOCKED',
      reason: 'canonical_production_persistence_provider_not_proven',
    },
    provenance: {
      exactSha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unavailable',
      environment: process.env.VERCEL_ENV ?? 'unknown',
    },
    correlationId: authorization.correlationId,
  }, authorization.correlationId);
}
