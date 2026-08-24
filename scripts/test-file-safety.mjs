import assert from 'node:assert/strict';
import { validateFileSafety } from '../src/lib/contracts/file-safety.ts';

const rasterPolicy = {
  allowedMime: ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes: 25 * 1024 * 1024,
  maxPixels: 40_000_000,
  signatures: ['89504e470d0a1a0a', 'ffd8ff', '52494646'],
};

const safe = validateFileSafety(
  {
    name: 'sample.png',
    mime: 'image/png',
    bytes: 1024,
    width: 4000,
    height: 4000,
    signature: '89504e470d0a1a0a0000000d',
  },
  rasterPolicy,
);
assert.deepEqual(safe, { safe: true, failures: [] });

const rejectMime = validateFileSafety(
  { name: 'payload.txt', mime: 'text/plain', bytes: 10 },
  rasterPolicy,
);
assert.equal(rejectMime.safe, false);
assert.ok(rejectMime.failures.includes('unsupported input MIME type: text/plain'));

const rejectEmpty = validateFileSafety(
  { name: 'empty.png', mime: 'image/png', bytes: 0 },
  rasterPolicy,
);
assert.equal(rejectEmpty.safe, false);
assert.ok(rejectEmpty.failures.includes('file size must be a positive integer'));

const rejectOversized = validateFileSafety(
  { name: 'large.png', mime: 'image/png', bytes: rasterPolicy.maxBytes + 1 },
  rasterPolicy,
);
assert.equal(rejectOversized.safe, false);
assert.ok(rejectOversized.failures.includes('file exceeds the maximum size'));

const rejectPixels = validateFileSafety(
  { name: 'huge.png', mime: 'image/png', bytes: 1024, width: 10_001, height: 4_000 },
  rasterPolicy,
);
assert.equal(rejectPixels.safe, false);
assert.ok(rejectPixels.failures.includes('input exceeds the maximum pixel count'));

const rejectSignature = validateFileSafety(
  { name: 'spoofed.png', mime: 'image/png', bytes: 1024, signature: '25504446' },
  rasterPolicy,
);
assert.equal(rejectSignature.safe, false);
assert.ok(rejectSignature.failures.includes('input signature does not match the allowed file signatures'));

const requireSignature = validateFileSafety(
  { name: 'missing-signature.png', mime: 'image/png', bytes: 1024 },
  rasterPolicy,
);
assert.equal(requireSignature.safe, false);
assert.ok(requireSignature.failures.includes('input signature is required when signature validation is enabled'));

const rejectInvalidDimensions = validateFileSafety(
  { name: 'invalid-dimensions.png', mime: 'image/png', bytes: 1024, width: 0, height: 100 },
  rasterPolicy,
);
assert.equal(rejectInvalidDimensions.safe, false);
assert.ok(rejectInvalidDimensions.failures.includes('width must be a positive integer'));

console.log('file safety runtime contract checks passed');
