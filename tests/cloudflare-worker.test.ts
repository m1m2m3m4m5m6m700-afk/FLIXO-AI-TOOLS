import assert from 'node:assert/strict';
import { test } from 'node:test';

const { default: worker } = await import('../src/worker.ts');

const SHA = 'd'.repeat(40);

const assets = {
  fetch: async (request: Request) => {
    const { pathname } = new URL(request.url);
    if (
      pathname === '/__flixo-identity-' + SHA + '.txt'
      || pathname === '/__flixo/identity/' + SHA + '/index.txt'
    ) {
      return new Response(SHA + '\n', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    return new Response('<html><body>FLIXO</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  },
};

test('Cloudflare Worker returns the exact bound deployment SHA', async () => {
  const response = await worker.fetch(
    new Request('https://flixoai.example/__flixo-identity-' + SHA + '.txt?cache=1'),
    { ASSETS: { fetch: async () => new Response('Not Found\n', { status: 404 }) }, FLIXO_DEPLOYMENT_SHA: SHA },
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), SHA + '\n');
  assert.equal(response.headers.get('x-flixo-deployment-sha'), SHA);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
});

test('Cloudflare Worker rejects a mismatched configured deployment identity', async () => {
  const response = await worker.fetch(
    new Request('https://flixoai.example/__flixo-identity-' + SHA + '.txt'),
    { ASSETS: assets, FLIXO_DEPLOYMENT_SHA: 'e'.repeat(40) },
  );

  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Not Found\n');
});

test('Cloudflare Worker rejects an invalid configured deployment identity', async () => {
  const response = await worker.fetch(
    new Request('https://flixoai.example/__flixo-identity-' + SHA + '.txt'),
    { ASSETS: assets, FLIXO_DEPLOYMENT_SHA: 'invalid' },
  );

  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Not Found\n');
});

test('Cloudflare Worker verifies the versioned asset when the deployment binding is absent', async () => {
  const response = await worker.fetch(
    new Request('https://flixoai.example/__flixo-identity-' + SHA + '.txt'),
    { ASSETS: assets },
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), SHA + '\n');
});

test('Cloudflare Worker serves the directory identity alias without SPA fallback', async () => {
  const response = await worker.fetch(
    new Request('https://flixoai.example/__flixo/identity/' + SHA + '/index.txt'),
    { ASSETS: assets },
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), SHA + '\n');
});

test('Cloudflare Worker rejects an identity path whose asset content does not match the path SHA', async () => {
  const response = await worker.fetch(
    new Request('https://flixoai.example/__flixo-identity-' + 'f'.repeat(40) + '.txt'),
    {
      ASSETS: {
        fetch: async () => new Response(SHA + '\n', { status: 200 }),
      },
    },
  );

  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Not Found\n');
});

test('Cloudflare Worker delegates normal application requests to assets', async () => {
  const response = await worker.fetch(
    new Request('https://flixoai.example/'),
    { ASSETS: assets },
  );

  assert.equal(response.status, 200);
  assert.match(await response.text(), /FLIXO/);
});
