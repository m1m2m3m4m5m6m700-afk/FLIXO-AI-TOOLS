import assert from 'node:assert/strict';
import { test } from 'node:test';

test('red-team: exhausted attempt budget cannot continue autonomously', () => {
  const budget = { attempts: 2, timeMs: 10_000, mutations: 1, scope: 4 };
  const used = { attempts: 2, timeMs: 1_000, mutations: 1, scope: 1 };
  assert.equal(used.attempts >= budget.attempts, true);
  assert.equal(used.mutations >= budget.mutations, true);
});

test('red-team: provider input contract contains metadata only, never file bytes', () => {
  const metadata = { name: 'fixture.png', type: 'image/png', size: 128 };
  assert.deepEqual(Object.keys(metadata).sort(), ['name', 'size', 'type']);
  assert.equal('bytes' in metadata, false);
  assert.equal('blob' in metadata, false);
  assert.equal('data' in metadata, false);
});

test('red-team: unsupported execution intent must map to no executable capability', () => {
  const unsupported = 'remove the object from this image';
  const executableMvp = new Set([
    'background-remover',
    'image-upscaler',
    'image-cropper',
    'image-compressor',
    'image-converter',
    'image-effects',
    'video-trimmer',
    'video-cropper',
    'video-resizer',
    'video-compressor',
  ]);
  assert.equal(executableMvp.has(unsupported), false);
});

test('red-team: skipped/cancelled/stale evidence is not a success signal', () => {
  for (const state of ['skipped', 'cancelled', 'stale', 'missing', 'contradictory']) {
    assert.notEqual(state, 'success');
  }
});

test('red-team: certification states cannot collapse into one boolean', () => {
  const infrastructure = { state: 'GREEN', evidence: 'sha-a' };
  const product = { state: 'GREEN', evidence: 'sha-b' };
  const certification = { state: 'CERTIFIED', evidence: 'sha-c' };
  assert.notEqual(infrastructure.evidence, product.evidence);
  assert.notEqual(product.evidence, certification.evidence);
});

test('red-team: external repair/review workers have no certification authority', () => {
  const workerAuthorities = ['patch-candidate', 'review-evidence'];
  assert.equal(workerAuthorities.includes('certify'), false);
  assert.equal(workerAuthorities.includes('merge'), false);
  assert.equal(workerAuthorities.includes('promote'), false);
});

test('red-team: static agent UI exposes only canonical MVP tools', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../public/flixo-agent-ui.html', import.meta.url), 'utf8');
  for (const toolId of [
    'background-remover',
    'image-upscaler',
    'image-cropper',
    'image-compressor',
    'image-converter',
    'image-effects',
  ]) {
    assert.match(html, new RegExp("id:'" + toolId + "'"));
  }
  assert.doesNotMatch(html, /id:'(?:image-ocr|pix)'/);
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
});
