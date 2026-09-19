import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { sessionCookieName, signAdminSession } from '../api/admin/boundary.ts';

const SECRET = 'admin-session-test-secret'.padEnd(32, '0');
const PASSWORD = 'Test-Admin-Password-123!';
const salt = randomBytes(16);
const key = scryptSync(PASSWORD, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 128 * 16_384 * 8 + 1_048_576 });
const HASH = `$scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`;

const invoke = async ({
  method = 'GET',
  body,
  cookie = '',
  origin,
  host = 'localhost:3000',
  secret = SECRET,
  passwordHash = HASH,
  forwardedProto = 'http',
} = {}) => {
  process.env.ADMIN_SESSION_SECRET = secret;
  process.env.ADMIN_PASSWORD_HASH = passwordHash;

  const headers = {};
  let responseBody = '';
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers[name] = value; },
    end(value) { responseBody = value ?? ''; },
  };

  const request = {
    method,
    body,
    headers: {
      cookie,
      host,
      origin,
      'x-forwarded-proto': forwardedProto,
      'x-request-id': 'admin-auth-test',
    },
  };

  await (await import('../api/admin/session.ts')).default(request, res);
  return { status: res.statusCode, headers, body: responseBody ? JSON.parse(responseBody) : null };
};

const missingConfig = await invoke({ secret: null });
assert.equal(missingConfig.status, 503);
assert.equal(missingConfig.body.error.code, 'server_configuration_unavailable');

const wrongPassword = await invoke({ method: 'POST', body: { password: 'wrong' } });
assert.equal(wrongPassword.status, 401);
assert.equal(wrongPassword.body.error.code, 'invalid_credentials');

const csrfDenied = await invoke({
  method: 'POST',
  body: { password: PASSWORD },
  origin: 'https://attacker.example',
});
assert.equal(csrfDenied.status, 403);
assert.equal(csrfDenied.body.error.code, 'csrf_origin_denied');

const login = await invoke({
  method: 'POST',
  body: { password: PASSWORD },
  origin: 'http://localhost:3000',
});
assert.equal(login.status, 200);
assert.equal(login.body.ok, true);
assert.equal(login.body.identity.subject, 'owner');
assert.equal(login.body.identity.role, 'OWNER');
assert.ok(String(login.headers['Set-Cookie']).startsWith(`${sessionCookieName}=`));
assert.match(String(login.headers['Set-Cookie']), /HttpOnly/);
assert.match(String(login.headers['Set-Cookie']), /SameSite=Lax/);

const setCookie = String(login.headers['Set-Cookie']).split(';')[0];
const cookie = setCookie;

const session = await invoke({ cookie });
assert.equal(session.status, 200);
assert.equal(session.body.authenticated, true);
assert.equal(session.body.identity.subject, 'owner');
assert.equal(session.body.identity.role, 'OWNER');
assert.equal(Array.isArray(session.body.capabilities), true);

const tampered = await invoke({
  cookie: `${sessionCookieName}=invalid.invalid`,
});
assert.equal(tampered.status, 401);
assert.equal(tampered.body.error.code, 'authentication_required');

const loggedOut = await invoke({
  method: 'DELETE',
  cookie,
  origin: 'http://localhost:3000',
});
assert.equal(loggedOut.status, 200);
assert.equal(loggedOut.body.authenticated, false);
assert.match(String(loggedOut.headers['Set-Cookie']), /Max-Age=0/);

const wrongMethod = await invoke({ method: 'PUT' });
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.body.error.code, 'method_not_allowed');

console.log('Admin auth/session contract tests: PASS');
