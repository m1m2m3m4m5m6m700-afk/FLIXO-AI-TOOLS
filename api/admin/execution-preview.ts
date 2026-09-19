import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorizeAdminRequestWithDurableSession } from './boundary.ts';
import { createAdminExecutionPlan } from './execution-plan.ts';
import type { AdminExecutionClass } from './execution-policy.ts';

type AdminRequest = IncomingMessage & {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

const EXECUTION_CLASSES: readonly AdminExecutionClass[] = [
  'READ',
  'LOW_RISK_WRITE',
  'HIGH_RISK_WRITE',
  'DESTRUCTIVE',
  'PRODUCTION_CHANGE',
];

const json = (res: ServerResponse, status: number, body: unknown, correlationId: string) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Request-Id', correlationId);
  res.end(JSON.stringify(body));
};

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function adminExecutionPreview(req: AdminRequest, res: ServerResponse) {
  const authorization = authorizeAdminRequest(req, 'system.read');
  if ('status' in authorization) {
    if (authorization.status === 405) res.setHeader('Allow', 'GET');
    return json(res, authorization.status, { ok: false, error: { code: authorization.code, correlationId: authorization.correlationId } }, authorization.correlationId);
  }

  const executionClass = first(req.query?.executionClass) as AdminExecutionClass | undefined;
  const command = first(req.query?.command)?.trim() ?? '';
  const target = first(req.query?.target)?.trim() ?? '';
  const rollbackPlan = first(req.query?.rollbackPlan)?.trim() || undefined;
  const approvalId = first(req.query?.approvalId)?.trim() || undefined;

  if (!executionClass || !EXECUTION_CLASSES.includes(executionClass)) {
    return json(res, 400, { ok: false, error: { code: 'invalid_execution_class', correlationId: authorization.correlationId } }, authorization.correlationId);
  }

  const plan = createAdminExecutionPlan({
    subject: authorization.subject,
    capability: authorization.capability,
    executionClass,
    command,
    target,
    preview: true,
    rollbackPlan,
    approvalId,
  });

  return json(res, 200, {
    ok: true,
    source: 'admin-control-plane-execution-preview',
    correlationId: authorization.correlationId,
    plan,
  }, authorization.correlationId);
}
