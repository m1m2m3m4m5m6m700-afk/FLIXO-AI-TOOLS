import assert from 'node:assert/strict';
import { signAdminSession, sessionCookieName } from '../api/admin/boundary.ts';

const SECRET = '01234567890123456789012345678901';

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

  await (await import('../api/admin/boundary.ts')).default(
    { method, query, headers: { cookie, 'x-request-id': requestId } },
    res,
  );

  if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previous;

  return { status: res.statusCode, headers, body: JSON.parse(body) };
};

const session = signAdminSession({ subject: 'test-owner', capabilities: ['admin.read'] }, SECRET);
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

const unauthorized = await invoke({ cookie, query: { capability: 'users.manage' } });
assert.equal(unauthorized.status, 403);
assert.equal(unauthorized.body.error.code, 'capability_denied');

const allowed = await invoke({ cookie, query: { capability: 'admin.read' } });
assert.equal(allowed.status, 200);
assert.equal(allowed.body.ok, true);
assert.equal(allowed.body.identity.subject, 'test-owner');
assert.equal(allowed.body.authorization.decision, 'ALLOW');
assert.equal(allowed.headers['X-Request-Id'], 'test-request-001');

const wrongMethod = await invoke({ cookie, method: 'POST' });
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.body.error.code, 'method_not_allowed');
assert.equal(wrongMethod.headers.Allow, 'GET');

console.log('Admin server boundary contract tests passed: 6 fail-closed/authorization cases.');
