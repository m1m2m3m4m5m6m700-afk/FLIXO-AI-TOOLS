import assert from 'node:assert/strict';
import { signAdminSession, sessionCookieName } from '../api/admin/boundary.ts';

const SECRET = 'phase1-admin-test-secret'.padEnd(32, '0');

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

const session = signAdminSession({ subject: 'test-owner', capabilities: ['admin.read', 'truth.read'] }, SECRET);
const cookie = `${sessionCookieName}=${session}`;

const missingConfig = await invoke({ secret: null });
assert.equal(missingConfig.status, 503);
assert.equal(missingConfig.body.error.code, 'server_configuration_unavailable');

const unauthenticated = await invoke();
assert.equal(unauthenticated.status, 401);
assert.equal(unauthenticated.body.error.code, 'authentication_required');

const invalid = await invoke({ cookie: `${sessionCookieName}=invalid.token` });
assert.equal(invalid.status, 401);
assert.equal(invalid.body.error.code, 'authentication_required');

const [sessionPayload, sessionSignature] = session.split('.');
const tamperedSignature = `${sessionSignature[0] === 'a' ? 'b' : 'a'}${sessionSignature.slice(1)}`;
const tampered = `${sessionPayload}.${tamperedSignature}`;
const tamperedResponse = await invoke({ cookie: `${sessionCookieName}=${tampered}` });
assert.equal(tamperedResponse.status, 401);
assert.equal(tamperedResponse.body.error.code, 'authentication_required');

const expired = signAdminSession({ subject: 'expired-owner', capabilities: ['admin.read'], ttlSeconds: -1 }, SECRET);
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

const overviewDenied = await invokeOverview({ cookie: `${sessionCookieName}=${signAdminSession({ subject: 'analyst', capabilities: ['admin.read'] }, SECRET)}` });
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
assert.equal(overviewAllowed.body.capabilities.length, 8);
assert.equal(overviewAllowed.headers['X-Request-Id'], 'overview-request-001');

console.log('Admin server boundary contract tests passed: 12 fail-closed/authorization/correlation/overview cases.');
