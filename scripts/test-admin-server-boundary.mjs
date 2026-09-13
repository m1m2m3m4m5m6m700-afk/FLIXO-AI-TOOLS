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

const centersUnauthenticated = await invokeCenters({ query: { center: 'truth' } });
assert.equal(centersUnauthenticated.status, 401);
assert.equal(centersUnauthenticated.body.error.code, 'authentication_required');

const centersDenied = await invokeCenters({
  cookie: `${sessionCookieName}=${signAdminSession({ subject: 'analyst', capabilities: ['admin.read'] }, SECRET)}`,
  query: { center: 'security' },
});
assert.equal(centersDenied.status, 403);
assert.equal(centersDenied.body.error.code, 'capability_denied');

for (const center of ['truth', 'operations', 'incident', 'evidence']) {
  const response = await invokeCenters({ cookie, query: { center } });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.center, center);
  assert.equal(response.body.execution, undefined);
  assert.equal(response.body.data.execution, 'READ_ONLY');
  assert.equal(response.body.identity.subject, 'test-owner');
  assert.equal(response.body.persistence.state, 'BLOCKED');
  assert.equal(response.body.data.event, null);
}

const centersSecurityDeniedByCapabilitySet = await invokeCenters({ cookie, query: { center: 'security' } });
assert.equal(centersSecurityDeniedByCapabilitySet.status, 403);
assert.equal(centersSecurityDeniedByCapabilitySet.body.error.code, 'capability_denied');

const centersContractDeniedByCapabilitySet = await invokeCenters({ cookie, query: { center: 'contract' } });
assert.equal(centersContractDeniedByCapabilitySet.status, 403);
assert.equal(centersContractDeniedByCapabilitySet.body.error.code, 'capability_denied');

const centersDefault = await invokeCenters({ cookie });
assert.equal(centersDefault.status, 200);
assert.equal(centersDefault.body.center, 'truth');
assert.equal(centersDefault.body.data.execution, 'READ_ONLY');
assert.equal(centersDefault.headers['X-Request-Id'], 'centers-request-001');

const securitySession = signAdminSession({ subject: 'security-owner', capabilities: ['security.read'] }, SECRET);
const securityResponse = await invokeCenters({ cookie: `${sessionCookieName}=${securitySession}`, query: { center: 'security' } });
assert.equal(securityResponse.status, 200);
assert.equal(securityResponse.body.center, 'security');
assert.equal(securityResponse.body.capability, 'security.read');
assert.equal(securityResponse.body.data.execution, 'READ_ONLY');

const contractSession = signAdminSession({ subject: 'contract-owner', capabilities: ['contracts.read'] }, SECRET);
const contractResponse = await invokeCenters({ cookie: `${sessionCookieName}=${contractSession}`, query: { center: 'contract' } });
assert.equal(contractResponse.status, 200);
assert.equal(contractResponse.body.center, 'contract');
assert.equal(contractResponse.body.capability, 'contracts.read');
assert.equal(contractResponse.body.data.execution, 'READ_ONLY');

console.log('Admin server boundary contract tests passed: 25 fail-closed/authorization/correlation/overview/read-model cases.');
