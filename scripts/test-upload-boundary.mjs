import assert from 'node:assert/strict';
import { validateUploadBoundary } from '../src/lib/contracts/upload-boundary.ts';

const policy = {
  allowedMime: ['image/png'],
  allowedExtensions: ['png'],
  maxBytes: 1024 * 1024,
  signatures: ['89504e470d0a1a0a'],
};

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

const safe = validateUploadBoundary(
  { name: 'safe.png', mime: 'image/png', bytes: pngBytes },
  policy,
);
assert.equal(safe.safe, true);
assert.equal(safe.signature, '89504e470d0a1a0a00000000'.slice(0, 18));

const spoofedMime = validateUploadBoundary(
  { name: 'payload.png', mime: 'application/pdf', bytes: pngBytes },
  policy,
);
assert.equal(spoofedMime.safe, false);
assert.ok(spoofedMime.failures.includes('unsupported input MIME type: application/pdf'));

const spoofedBytes = validateUploadBoundary(
  {
    name: 'payload.png',
    mime: 'image/png',
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
  },
  policy,
);
assert.equal(spoofedBytes.safe, false);
assert.ok(spoofedBytes.failures.includes('input signature does not match the allowed file signatures'));

const wrongExtension = validateUploadBoundary(
  { name: 'payload.jpg', mime: 'image/png', bytes: pngBytes },
  policy,
);
assert.equal(wrongExtension.safe, false);
assert.ok(wrongExtension.failures.includes('unsupported file extension: jpg'));

const oversized = validateUploadBoundary(
  { name: 'large.png', mime: 'image/png', bytes: new Uint8Array(policy.maxBytes + 1) },
  policy,
);
assert.equal(oversized.safe, false);
assert.ok(oversized.failures.includes('file exceeds the maximum size'));

console.log('upload boundary security contract checks passed');
