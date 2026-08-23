import assert from 'node:assert/strict';

const validate = (await import('../src/lib/contracts/output-integrity.ts')).validateOutputIntegrity;

const spec = {
  toolId: 'test',
  allowedMime: ['image/png', 'image/webp'],
  maxBytes: 100_000,
  minBytes: 10,
  maxPixels: 4_000_000,
};

const pass = validateOutputIntegrity(1024, 'image/png', spec, { width: 100, height: 100 });
assert.equal(pass.valid, true);
assert.deepEqual(pass.failures, []);

const badMime = validateOutputIntegrity(1024, 'application/octet-stream', spec);
assert.equal(badMime.valid, false);
assert.ok(badMime.failures.some((failure) => failure.includes('MIME')));

const badSize = validateOutputIntegrity(100_001, 'image/png', spec);
assert.equal(badSize.valid, false);

const badPixels = validateOutputIntegrity(1024, 'image/png', spec, { width: 3000, height: 3000 });
assert.equal(badPixels.valid, false);
assert.ok(badPixels.failures.some((failure) => failure.includes('pixel')));

console.log('FLIXO output integrity tests: PASS');
