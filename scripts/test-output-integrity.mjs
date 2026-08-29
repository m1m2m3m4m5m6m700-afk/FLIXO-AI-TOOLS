import assert from 'node:assert/strict';

const { validateOutputIntegrity } = await import('../src/lib/contracts/output-integrity.ts');

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

const imageSpec = {
  toolId: 'output-integrity-test',
  allowedMime: ['image/png', 'image/jpeg'],
  allowedExtensions: ['png', 'jpg', 'jpeg'],
  maxBytes: 100_000,
  minBytes: 8,
  maxPixels: 4_000_000,
  signatures: ['89504e470d0a1a0a', 'ffd8ff'],
};

const validPng = validateOutputIntegrity(
  png.byteLength,
  'image/png',
  imageSpec,
  { width: 100, height: 100 },
  { filename: 'result.png', bytes: png },
);
assert.equal(validPng.valid, true);
assert.deepEqual(validPng.failures, []);

const validJpeg = validateOutputIntegrity(
  512,
  'image/jpeg',
  imageSpec,
  undefined,
  { filename: 'result.jpg', bytes: jpeg },
);
assert.equal(validJpeg.valid, true);

const empty = validateOutputIntegrity(0, 'image/png', imageSpec, undefined, { filename: 'result.png', bytes: new Uint8Array() });
assert.equal(empty.valid, false);
assert.ok(empty.failures.includes('bytes must be a positive integer'));

const badMime = validateOutputIntegrity(512, 'application/octet-stream', imageSpec, undefined, { filename: 'result.png', bytes: png });
assert.equal(badMime.valid, false);
assert.ok(badMime.failures.some((failure) => failure.includes('MIME')));

const badExtension = validateOutputIntegrity(512, 'image/png', imageSpec, undefined, { filename: 'result.txt', bytes: png });
assert.equal(badExtension.valid, false);
assert.ok(badExtension.failures.some((failure) => failure.includes('extension')));

const badSignature = validateOutputIntegrity(512, 'image/png', imageSpec, undefined, { filename: 'result.png', bytes: new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]) });
assert.equal(badSignature.valid, false);
assert.ok(badSignature.failures.some((failure) => failure.includes('signature')));

const tooLarge = validateOutputIntegrity(100_001, 'image/png', imageSpec, undefined, { filename: 'result.png', bytes: png });
assert.equal(tooLarge.valid, false);
assert.ok(tooLarge.failures.includes('output exceeds the maximum size'));

const tooSmall = validateOutputIntegrity(4, 'image/png', imageSpec, undefined, { filename: 'result.png', bytes: png });
assert.equal(tooSmall.valid, false);
assert.ok(tooSmall.failures.includes('output is smaller than the minimum size'));

const tooManyPixels = validateOutputIntegrity(1024, 'image/png', imageSpec, { width: 3000, height: 3000 }, { filename: 'result.png', bytes: png });
assert.equal(tooManyPixels.valid, false);
assert.ok(tooManyPixels.failures.some((failure) => failure.includes('pixel')));

const missingBytes = validateOutputIntegrity(512, 'image/png', imageSpec, undefined, { filename: 'result.png' });
assert.equal(missingBytes.valid, false);
assert.ok(missingBytes.failures.some((failure) => failure.includes('signature bytes')));

console.log('FLIXO output integrity tests: PASS');
