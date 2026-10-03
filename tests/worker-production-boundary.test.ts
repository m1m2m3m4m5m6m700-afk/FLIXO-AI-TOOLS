import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { resolveDeploymentIdentity } from '../src/worker.ts';

test('deployment identity resolver requires an exact 40-character SHA match', () => {
  const sha = 'a'.repeat(40);
  assert.equal(resolveDeploymentIdentity(sha, sha), sha);
  assert.equal(resolveDeploymentIdentity(sha, 'b'.repeat(40)), null);
  assert.equal(resolveDeploymentIdentity(sha, 'a'.repeat(39)), null);
});


test('production worker applies security headers', async () => {
  const response = await worker.fetch(new Request('https://flixoai.example/'), { ASSETS: { fetch: async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }) } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=63072000; includeSubDomains; preload');
});

test('production worker returns JSON 404 for API paths instead of SPA HTML', async () => {
  const response = await worker.fetch(new Request('https://flixoai.example/api/flixo-agent'), { ASSETS: { fetch: async () => { throw new Error('API asset fallback must not run'); } } });
  assert.equal(response.status, 404);
  assert.equal((response.headers.get('content-type') ?? '').includes('application/json'), true);
  assert.equal((await response.json() as { error: string }).error, 'API_NOT_EXPOSED_ON_STATIC_PRODUCTION_WORKER');
});

test('production worker rejects identity before deploy-time SHA binding', async () => {
  const requested = 'a'.repeat(40);
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo-identity-' + requested + '.txt'), {
    ASSETS: { fetch: async () => new Response(requested + '\n', { status: 200 }) },
  });
  assert.equal(response.status, 404);
});

test('production worker rejects identity when the exact versioned asset does not match', async () => {
  const requested = 'a'.repeat(40);
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo-identity-' + requested + '.txt'), {
    ASSETS: { fetch: async (request) => {
      assert.equal(new URL(request.url).pathname, '/__flixo-identity-' + requested + '.txt');
      return new Response('b'.repeat(40) + '\n', { status: 200 });
    } },
  });
  assert.equal(response.status, 404);
});
