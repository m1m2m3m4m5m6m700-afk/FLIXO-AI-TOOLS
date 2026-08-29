import assert from 'node:assert/strict';
import { validateArchiveEntries, validateFileSafety } from '../src/lib/contracts/file-safety.ts';

const rasterPolicy = {
  allowedMime: ['image/png', 'image/jpeg', 'image/webp'],
  allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
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
  { name: 'payload.txt', mime: 'text/plain', bytes: 10, signature: '25504446' },
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

for (const name of ['../evil.png', '..\\evil.png', '/tmp/evil.png', 'C:\\temp\\evil.png', 'nested/evil.png']) {
  const result = validateFileSafety(
    { name, mime: 'image/png', bytes: 1024, signature: '89504e470d0a1a0a' },
    rasterPolicy,
  );
  assert.equal(result.safe, false, `unsafe file name accepted: ${name}`);
  assert.ok(result.failures.includes('file name must be a single safe relative name'));
}

const archivePolicy = { maxEntries: 100, maxUncompressedBytes: 10_000_000, maxDepth: 4 };
assert.deepEqual(
  validateArchiveEntries(
    [
      { name: 'images/photo.png', uncompressedBytes: 1024 },
      { name: 'notes/readme.txt', uncompressedBytes: 512 },
    ],
    archivePolicy,
  ),
  { safe: true, failures: [] },
);

for (const name of ['../evil.txt', '..\\evil.txt', '/etc/passwd', 'C:\\Windows\\system.ini', 'a/./b.txt']) {
  const result = validateArchiveEntries([{ name, uncompressedBytes: 10 }], archivePolicy);
  assert.equal(result.safe, false, `unsafe archive path accepted: ${name}`);
}

const depthRejected = validateArchiveEntries(
  [{ name: 'a/b/c/d/e/file.txt', uncompressedBytes: 10 }],
  archivePolicy,
);
assert.equal(depthRejected.safe, false);
assert.ok(depthRejected.failures.some((failure) => failure.includes('maximum path depth')));

const symlinkRejected = validateArchiveEntries(
  [{ name: 'link.txt', uncompressedBytes: 10, isSymlink: true }],
  archivePolicy,
);
assert.equal(symlinkRejected.safe, false);
assert.ok(symlinkRejected.failures.some((failure) => failure.includes('symlink entries are not allowed')));

const tooManyEntries = validateArchiveEntries(
  Array.from({ length: 3 }, (_, index) => ({ name: `file-${index}.txt`, uncompressedBytes: 1 })),
  { ...archivePolicy, maxEntries: 2 },
);
assert.equal(tooManyEntries.safe, false);
assert.ok(tooManyEntries.failures.includes('archive exceeds the maximum entry count'));

const tooLargeArchive = validateArchiveEntries(
  [
    { name: 'one.bin', uncompressedBytes: 6_000 },
    { name: 'two.bin', uncompressedBytes: 5_000 },
  ],
  { ...archivePolicy, maxUncompressedBytes: 10_000 },
);
assert.equal(tooLargeArchive.safe, false);
assert.ok(tooLargeArchive.failures.includes('archive exceeds the maximum uncompressed size'));

const invalidEntrySize = validateArchiveEntries(
  [{ name: 'bad.bin', uncompressedBytes: -1 }],
  archivePolicy,
);
assert.equal(invalidEntrySize.safe, false);
assert.ok(invalidEntrySize.failures.some((failure) => failure.includes('invalid uncompressed size')));

console.log('file safety runtime contract checks passed');
