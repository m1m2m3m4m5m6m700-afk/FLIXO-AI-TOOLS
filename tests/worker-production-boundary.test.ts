import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/worker.ts';

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

test('production worker verifies identity against the fixed canonical asset', async () => {
  const requested = 'a'.repeat(40);
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo-identity-' + requested + '.txt'), {
    ASSETS: { fetch: async (request) => {
      assert.equal(new URL(request.url).pathname, '/__flixo-identity.txt');
      return new Response(requested + '\n', { status: 200 });
    } },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.text()).trim(), requested);
  assert.equal(response.headers.get('x-flixo-deployment-sha'), requested);
});

test('production worker serves the exact deployment SHA from the Worker environment', async () => {
  const requested = 'a'.repeat(40);
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo-identity-' + requested + '.txt'), {
    ASSETS: { fetch: async () => new Response('Not Found\\n', { status: 404 }) },
    FLIXO_DEPLOYMENT_SHA: requested,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.text()).trim(), requested);
  assert.equal(response.headers.get('x-flixo-deployment-sha'), requested);
});

test('production worker rejects a versioned identity that does not match the Worker environment', async () => {
  const requested = 'a'.repeat(40);
  const deployed = 'b'.repeat(40);
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo-identity-' + requested + '.txt'), {
    ASSETS: { fetch: async () => new Response('Not Found\\n', { status: 404 }) },
    FLIXO_DEPLOYMENT_SHA: deployed,
  });
  assert.equal(response.status, 404);
});

test('production worker falls back to the exact versioned identity asset', async () => {
  const requested = 'a'.repeat(40);
  const paths: string[] = [];
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo-identity-' + requested + '.txt'), {
    ASSETS: { fetch: async (request) => {
      const path = new URL(request.url).pathname;
      paths.push(path);
      if (path === '/__flixo-identity.txt') return new Response('Not Found\n', { status: 404 });
      if (path === '/__flixo-identity-' + requested + '.txt') return new Response(requested + '\n', { status: 200 });
      throw new Error('unexpected asset path: ' + path);
    } },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.text()).trim(), requested);
  assert.equal(response.headers.get('x-flixo-deployment-sha'), requested);
  assert.deepEqual(paths, ['/__flixo-identity.txt', '/__flixo-identity-' + requested + '.txt']);
});

test('production worker rejects identity when canonical and versioned assets do not match', async () => {
  const requested = 'a'.repeat(40);
  const response = await worker.fetch(new Request('https://flixoai.example/__flixo-identity-' + requested + '.txt'), {
    ASSETS: { fetch: async () => new Response('b'.repeat(40) + '\n', { status: 200 }) },
  });
  assert.equal(response.status, 404);
});
