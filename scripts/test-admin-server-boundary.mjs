import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { signAdminSession, sessionCookieName } from '../api/admin/boundary.ts';

const SECRET = 'phase1-admin-test-secret'.padEnd(32, '0');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret';
const sessions = new Map();
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (!url.includes('/rest/v1/flix_admin_sessions')) return originalFetch(input, init);
  const method = String(init.method ?? 'GET');
  const match = new URL(url).searchParams.get('session_id');
  const sessionId = match?.replace(/^eq\./, '');
  if (method === 'GET') {
    const row = sessionId ? sessions.get(sessionId) : undefined;
    return new Response(JSON.stringify(row ? [row] : []), { status: 200 });
  }
  throw new Error('unexpected test boundary session-store mutation');
};
const issuedTokens = new Map();
const issue = ({ subject, capabilities, role = 'ADMIN', ttlSeconds } = {}) => {
  const sessionId = randomUUID();
  const now = new Date();
  const token = signAdminSession({ subject, capabilities, role, sessionId, ttlSeconds }, SECRET);
  sessions.set(sessionId, {
    session_id: sessionId,
    token_hash: createHash('sha256').update(token).digest('hex'),
    actor_subject: subject,
    actor_role: role,
    environment: 'test',
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + (ttlSeconds ?? 60 * 60) * 1000).toISOString(),
    revoked_at: null,
  });
  issuedTokens.set(token, sessionId);
  return token;
};

const invoke = async ({ secret = SECRET, cookie = '', method = 'GET', query = {}, requestId = 'test-request-001' } = {}) => {
  const previous = process.env.ADMIN_SESSION_SECRET;
  if (secret === null) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = secret;

  const headers = {};
  let body;
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers[name] = value; },
    end(value) { body = value; },
  };

  try {
    await (await import('../api/admin/boundary.ts')).default(
      { method, query, headers: { cookie, 'x-request-id': requestId } },
      res,
    );
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous;
  }

  return { status: res.statusCode, headers, body: JSON.parse(body) };
};

const invokeOverview = async ({ secret = SECRET, cookie = '', method = 'GET', requestId = 'overview-request-001' } = {}) => {
  const previous = process.env.ADMIN_SESSION_SECRET;
  if (secret === null) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = secret;

  const headers = {};
  let body;
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers[name] = value; },
    end(value) { body = value; },
  };

  try {
    await (await import('../api/admin/overview.ts')).default(
      { method, headers: { cookie, 'x-request-id': requestId } },
      res,
    );
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous;
  }

  return { status: res.statusCode, headers, body: JSON.parse(body) };
};

const invokeCenters = async ({ secret = SECRET, cookie = '', method = 'GET', query = {}, requestId = 'centers-request-001' } = {}) => {
  const previous = process.env.ADMIN_SESSION_SECRET;
  if (secret === null) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = secret;

  const headers = {};
  let body;
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers[name] = value; },
    end(value) { body = value; },
  };

  try {
    await (await import('../api/admin/centers.ts')).default(
      { method, query, headers: { cookie, 'x-request-id': requestId } },
      res,
    );
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous;
  }

  return { status: res.statusCode, headers, body: JSON.parse(body) };
};

const invokeExecutionPreview = async ({ secret = SECRET, cookie = '', method = 'GET', query = {}, requestId = 'execution-preview-request-001' } = {}) => {
  const previous = process.env.ADMIN_SESSION_SECRET;
  if (secret === null) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = secret;

  const headers = {};
  let body;
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers[name] = value; },
    end(value) { body = value; },
  };

  try {
    await (await import('../api/admin/execution-preview.ts')).default(
      { method, query, headers: { cookie, 'x-request-id': requestId } },
      res,
    );
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous;
  }

  return { status: res.statusCode, headers, body: JSON.parse(body) };
};

const session = issue({ subject: 'test-owner', capabilities: ['admin.read', 'truth.read'] }, SECRET);
const cookie = `${sessionCookieName}=${session}`;
const readModelSession = issue({
  subject: 'read-model-owner',
  capabilities: ['truth.read', 'operations.read', 'evidence.read', 'audit.read'],
}, SECRET);
const readModelCookie = `${sessionCookieName}=${readModelSession}`;

const missingConfig = await invoke({ secret: null });
assert.equal(missingConfig.status, 503);
assert.equal(missingConfig.body.error.code, 'server_configuration_unavailable');

const unauthenticated = await invoke();
assert.equal(unauthenticated.status, 401);
assert.equal(unauthenticated.body.error.code, 'authentication_required');

assert.throws(
  () => signAdminSession({
    subject: 'bad-capability',
    capabilities: ['admin.read', 'production.write'],
    role: 'OWNER',
    sessionId: randomUUID(),
  }, SECRET),
  /session capabilities do not match role/,
);

const invalid = await invoke({ cookie: `${sessionCookieName}=invalid.token` });
assert.equal(invalid.status, 401);
assert.equal(invalid.body.error.code, 'authentication_required');

const [sessionPayload, sessionSignature] = session.split('.');
const tamperedSignature = `${sessionSignature[0] === 'a' ? 'b' : 'a'}${sessionSignature.slice(1)}`;
const tampered = `${sessionPayload}.${tamperedSignature}`;
const tamperedResponse = await invoke({ cookie: `${sessionCookieName}=${tampered}` });
assert.equal(tamperedResponse.status, 401);
assert.equal(tamperedResponse.body.error.code, 'authentication_required');

const durableRecord = sessions.get(issuedTokens.get(session));
durableRecord.token_hash = '0'.repeat(64);
const durableMismatch = await invoke({ cookie });
assert.equal(durableMismatch.status, 401);
assert.equal(durableMismatch.body.error.code, 'authentication_required');
durableRecord.token_hash = createHash('sha256').update(session).digest('hex');

const expired = issue({ subject: 'expired-owner', capabilities: ['admin.read'], ttlSeconds: -1 }, SECRET);
const expiredResponse = await invoke({ cookie: `${sessionCookieName}=${expired}` });
assert.equal(expiredResponse.status, 401);
assert.equal(expiredResponse.body.error.code, 'authentication_required');

const unauthorized = await invoke({ cookie, query: { capability: 'users.manage' } });
assert.equal(unauthorized.status, 403);
assert.equal(unauthorized.body.error.code, 'capability_denied');

const allowed = await invoke({ cookie, query: { capability: 'admin.read' } });
assert.equal(allowed.status, 200);
assert.equal(allowed.body.ok, true);
assert.equal(allowed.body.identity.subject, 'test-owner');
assert.equal(allowed.body.authorization.decision, 'ALLOW');
assert.equal(allowed.headers['X-Request-Id'], 'test-request-001');

const generatedRequestId = await invoke({ cookie, requestId: '' });
assert.equal(generatedRequestId.status, 200);
assert.match(generatedRequestId.headers['X-Request-Id'], /^[0-9a-f-]{36}$/iu);
assert.equal(generatedRequestId.body.correlationId, generatedRequestId.headers['X-Request-Id']);

const wrongMethod = await invoke({ cookie, method: 'POST' });
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.body.error.code, 'method_not_allowed');
assert.equal(wrongMethod.headers.Allow, 'GET');

const overviewUnauthenticated = await invokeOverview();
assert.equal(overviewUnauthenticated.status, 401);
assert.equal(overviewUnauthenticated.body.error.code, 'authentication_required');

const overviewDenied = await invokeOverview({ cookie: `${sessionCookieName}=${issue({ subject: 'analyst', capabilities: ['admin.read'] }, SECRET)}` });
assert.equal(overviewDenied.status, 403);
assert.equal(overviewDenied.body.error.code, 'capability_denied');

const overviewAllowed = await invokeOverview({ cookie });
assert.equal(overviewAllowed.status, 200);
assert.equal(overviewAllowed.body.ok, true);
assert.equal(overviewAllowed.body.source, 'admin-control-plane-foundation');
assert.equal(overviewAllowed.body.truth.state, 'UNAVAILABLE');
assert.equal(overviewAllowed.body.persistence.state, 'BLOCKED');
assert.equal(overviewAllowed.body.identity.subject, 'test-owner');
assert.equal(overviewAllowed.body.modules.length, 10);
assert.equal(overviewAllowed.body.capabilities.length, 9);
assert.equal(overviewAllowed.headers['X-Request-Id'], 'overview-request-001');

const centersUnauthenticated = await invokeCenters({ query: { center: 'truth' } });
assert.equal(centersUnauthenticated.status, 401);
assert.equal(centersUnauthenticated.body.error.code, 'authentication_required');

const centersDenied = await invokeCenters({
  cookie: `${sessionCookieName}=${issue({ subject: 'analyst', capabilities: ['admin.read'] }, SECRET)}`,
  query: { center: 'security' },
});
assert.equal(centersDenied.status, 403);
assert.equal(centersDenied.body.error.code, 'capability_denied');

for (const center of ['truth', 'operations', 'incident', 'evidence']) {
  const response = await invokeCenters({ cookie: readModelCookie, query: { center } });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.center, center);
  assert.equal(response.body.execution, undefined);
  assert.equal(response.body.data.execution, 'READ_ONLY');
  assert.equal(response.body.identity.subject, 'read-model-owner');
  assert.equal(response.body.persistence.state, 'BLOCKED');
  assert.equal(response.body.data.event, null);
}

const centersSecurityDeniedByCapabilitySet = await invokeCenters({ cookie: readModelCookie, query: { center: 'security' } });
assert.equal(centersSecurityDeniedByCapabilitySet.status, 403);
assert.equal(centersSecurityDeniedByCapabilitySet.body.error.code, 'capability_denied');

const centersContractDeniedByCapabilitySet = await invokeCenters({ cookie: readModelCookie, query: { center: 'contract' } });
assert.equal(centersContractDeniedByCapabilitySet.status, 403);
assert.equal(centersContractDeniedByCapabilitySet.body.error.code, 'capability_denied');

const centersDefault = await invokeCenters({ cookie: readModelCookie });
assert.equal(centersDefault.status, 400);
assert.equal(centersDefault.body.error.code, 'invalid_admin_center');

const securitySession = issue({ subject: 'security-owner', capabilities: ['security.read'] }, SECRET);
const securityResponse = await invokeCenters({ cookie: `${sessionCookieName}=${securitySession}`, query: { center: 'security' } });
assert.equal(securityResponse.status, 200);
assert.equal(securityResponse.body.center, 'security');
assert.equal(securityResponse.body.capability, 'security.read');
assert.equal(securityResponse.body.data.execution, 'READ_ONLY');

const contractSession = issue({ subject: 'contract-owner', capabilities: ['contracts.read'] }, SECRET);
const contractResponse = await invokeCenters({ cookie: `${sessionCookieName}=${contractSession}`, query: { center: 'contract' } });
assert.equal(contractResponse.status, 200);
assert.equal(contractResponse.body.center, 'contract');
assert.equal(contractResponse.body.capability, 'contracts.read');
assert.equal(contractResponse.body.data.execution, 'READ_ONLY');

const previewUnauthenticated = await invokeExecutionPreview({ query: {
  executionClass: 'READ',
  command: 'inspect',
  target: 'system',
} });
assert.equal(previewUnauthenticated.status, 401);
assert.equal(previewUnauthenticated.body.error.code, 'authentication_required');

const previewDenied = await invokeExecutionPreview({
  cookie: `${sessionCookieName}=${session}`,
  query: { executionClass: 'READ', command: 'inspect', target: 'system' },
});
assert.equal(previewDenied.status, 403);
assert.equal(previewDenied.body.error.code, 'capability_denied');

const executionSession = issue({ subject: 'execution-owner', capabilities: ['system.read'] }, SECRET);
const executionCookie = `${sessionCookieName}=${executionSession}`;

const previewWrongMethod = await invokeExecutionPreview({
  cookie: executionCookie,
  method: 'POST',
  query: { executionClass: 'READ', command: 'inspect', target: 'system' },
});
assert.equal(previewWrongMethod.status, 405);
assert.equal(previewWrongMethod.body.error.code, 'method_not_allowed');
assert.equal(previewWrongMethod.headers.Allow, 'GET');

const previewInvalidClass = await invokeExecutionPreview({
  cookie: executionCookie,
  query: { executionClass: 'UNKNOWN', command: 'restart', target: 'service' },
});
assert.equal(previewInvalidClass.status, 400);
assert.equal(previewInvalidClass.body.error.code, 'invalid_execution_class');

const preview = await invokeExecutionPreview({
  cookie: executionCookie,
  query: { executionClass: 'HIGH_RISK_WRITE', command: 'restart', target: 'service' },
});
assert.equal(preview.status, 200);
assert.equal(preview.body.ok, true);
assert.equal(preview.body.source, 'admin-control-plane-execution-preview');
assert.equal(preview.body.plan.execution.mode, 'PREVIEW_ONLY');
assert.equal(preview.body.plan.execution.enabled, false);
assert.equal(preview.body.plan.policy.decision, 'ALLOW_PREVIEW');
assert.equal(preview.body.plan.policy.reason, 'preview_only');
assert.equal(preview.body.plan.rollback.required, true);
assert.equal(preview.body.plan.approval.required, true);
assert.equal(preview.body.plan.audit.eventType, 'ADMIN_EXECUTION_PREVIEW');
assert.equal(preview.body.plan.audit.subject, 'execution-owner');
assert.equal(preview.body.plan.execution.command, 'restart');
assert.equal(preview.body.plan.execution.target, 'service');
assert.equal(preview.headers['X-Request-Id'], 'execution-preview-request-001');

const previewMissingTarget = await invokeExecutionPreview({
  cookie: executionCookie,
  query: { executionClass: 'LOW_RISK_WRITE', command: 'restart', target: '' },
});
assert.equal(previewMissingTarget.status, 200);
assert.equal(previewMissingTarget.body.plan.policy.decision, 'DENY');
assert.equal(previewMissingTarget.body.plan.policy.reason, 'missing_target');
assert.equal(previewMissingTarget.body.plan.execution.enabled, false);

const revokedToken = issue({ subject: 'revoked-owner', capabilities: ['admin.read', 'truth.read'], role: 'OWNER' });
const revokedSessionId = issuedTokens.get(revokedToken);
sessions.get(revokedSessionId).revoked_at = new Date().toISOString();
const revokedResponse = await invokeOverview({ cookie: sessionCookieName + '=' + revokedToken });
assert.equal(revokedResponse.status, 401);
assert.equal(revokedResponse.body.error.code, 'authentication_required');

console.log('Admin server boundary contract tests passed: 36 fail-closed/authorization/correlation/overview/read-model/execution-preview cases.');
