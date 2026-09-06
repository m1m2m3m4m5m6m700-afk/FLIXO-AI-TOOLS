import assert from 'node:assert/strict';
import { detectZipBombRisk, MAGIC_BYTE_SIGNATURES, validateArchiveEntries, validateFileSafety } from '../src/lib/contracts/file-safety.ts';
import { validateUploadBoundary } from '../src/lib/contracts/upload-boundary.ts';

const bytes = (...values) => new Uint8Array(values);
const text = (value) => new TextEncoder().encode(value);

const failContains = (result, fragment, message) => {
  assert.equal(result.safe, false, message);
  assert.ok(result.failures.some((failure) => failure.includes(fragment)), `${message}: missing ${fragment}`);
};

const makeSignatureContent = (key) => {
  const signature = MAGIC_BYTE_SIGNATURES[key];
  assert.ok(signature, `missing signature for ${key}`);
  const maxOffset = Math.max(signature.offset ?? 0, ...(signature.segments ?? []).map((segment) => segment.offset));
  const length = Math.max((signature.offset ?? 0) + signature.bytes.length, ...((signature.segments ?? []).map((segment) => segment.offset + segment.bytes.length)), maxOffset + 1);
  const content = new Uint8Array(length);
  content.set(signature.bytes, signature.offset ?? 0);
  for (const segment of signature.segments ?? []) content.set(segment.bytes, segment.offset);
  return content;
};

const matrix = [
  ['png', 'image/png', 'png'],
  ['jpg', 'image/jpeg', 'jpeg'],
  ['webp', 'image/webp', 'webp'],
  ['gif', 'image/gif', 'gif'],
  ['pdf', 'application/pdf', 'pdf'],
  ['zip', 'application/zip', 'zip'],
  ['mp3', 'audio/mpeg', 'mp3'],
  ['wav', 'audio/wav', 'wav'],
  ['mp4', 'video/mp4', 'mp4'],
  ['webm', 'video/webm', 'webm'],
  ['txt', 'text/plain', null],
  ['json', 'application/json', null],
  ['csv', 'text/csv', null],
];

const binaryKeys = new Set(matrix.filter(([, , key]) => key).map(([, , key]) => key));

for (const [extension, mime, signatureKey] of matrix) {
  if (!signatureKey) continue;
  const content = makeSignatureContent(signatureKey);
  const signature = MAGIC_BYTE_SIGNATURES[signatureKey];
  const policy = {
    allowedMime: [mime],
    allowedExtensions: [extension],
    maxBytes: 256,
    magicBytes: [signature],
  };

  assert.deepEqual(
    validateFileSafety({ name: `valid.${extension}`, mime, bytes: content.byteLength, content }, policy),
    { safe: true, failures: [] },
    `valid ${extension} rejected`,
  );

  const corrupt = content.slice();
  const corruptOffset = signature.offset ?? 0;
  corrupt[corruptOffset] ^= 0xff;
  failContains(
    validateFileSafety({ name: `corrupt.${extension}`, mime, bytes: corrupt.byteLength, content: corrupt }, policy),
    'input magic bytes do not match',
    `corrupt ${extension} accepted`,
  );
}

for (const [extension, mime] of [['txt', 'text/plain'], ['csv', 'text/csv']]) {
  const content = text(extension === 'csv' ? 'name,value\nflixo,1\n' : 'FLIXO safe text');
  const policy = { allowedMime: [mime], allowedExtensions: [extension], maxBytes: 64, contentValidation: 'utf8' };
  assert.equal(validateFileSafety({ name: `valid.${extension}`, mime, bytes: content.byteLength, content }, policy).safe, true);
}

const goodJson = text('{"ok":true}');
assert.equal(
  validateFileSafety(
    { name: 'valid.json', mime: 'application/json', bytes: goodJson.byteLength, content: goodJson },
    { allowedMime: ['application/json'], allowedExtensions: ['json'], maxBytes: 64, contentValidation: 'json' },
  ).safe,
  true,
);
failContains(
  validateFileSafety(
    { name: 'malformed.json', mime: 'application/json', bytes: 7, content: text('{"ok":}') },
    { allowedMime: ['application/json'], allowedExtensions: ['json'], maxBytes: 64, contentValidation: 'json' },
  ),
  'input JSON content is malformed',
  'malformed JSON accepted',
);

const emptyPolicy = { allowedMime: ['image/png'], allowedExtensions: ['png'], maxBytes: 64 };
failContains(
  validateFileSafety({ name: 'empty.png', mime: 'image/png', bytes: 0, content: new Uint8Array(0) }, emptyPolicy),
  'file size must be a positive integer',
  'empty file accepted',
);

const oversizePolicy = { allowedMime: ['image/png'], allowedExtensions: ['png'], maxBytes: 8 };
failContains(
  validateFileSafety({ name: 'huge.png', mime: 'image/png', bytes: 9, signature: '89504e470d0a1a0a' }, oversizePolicy),
  'file exceeds the maximum size',
  'oversized file accepted',
);

const dimensionPolicy = {
  allowedMime: ['image/png'],
  allowedExtensions: ['png'],
  maxBytes: 256,
  maxPixels: 100,
};
assert.equal(validateFileSafety({ name: 'boundary.png', mime: 'image/png', bytes: 8, signature: '89504e470d0a1a0a', width: 10, height: 10 }, dimensionPolicy).safe, true);
failContains(
  validateFileSafety({ name: 'pixel-bomb.png', mime: 'image/png', bytes: 8, signature: '89504e470d0a1a0a', width: 11, height: 10 }, dimensionPolicy),
  'input exceeds the maximum pixel count',
  'pixel limit bypassed',
);
failContains(
  validateFileSafety({ name: 'bad-dimensions.png', mime: 'image/png', bytes: 8, signature: '89504e470d0a1a0a', width: 0, height: 10 }, dimensionPolicy),
  'width must be a positive integer',
  'invalid width accepted',
);

for (const name of ['../evil.png', '..\\evil.png', '/tmp/evil.png', 'C:\\temp\\evil.png', 'nested/evil.png', 'a/./b.png']) {
  failContains(
    validateFileSafety({ name, mime: 'image/png', bytes: 8, signature: '89504e470d0a1a0a' }, emptyPolicy),
    'file name must be a single safe relative name',
    `unsafe filename accepted: ${name}`,
  );
}

const pngBytes = bytes(...MAGIC_BYTE_SIGNATURES.png.bytes, 0x00);
const uploadPolicy = {
  allowedMime: ['image/png'],
  allowedExtensions: ['png'],
  maxBytes: 64,
  signatures: ['89504e470d0a1a0a'],
  magicBytes: [MAGIC_BYTE_SIGNATURES.png],
};
assert.equal(validateUploadBoundary({ name: 'safe.png', mime: 'image/png', bytes: pngBytes }, uploadPolicy).safe, true);
failContains(
  validateUploadBoundary({ name: 'fake.png', mime: 'image/png', bytes: bytes(0x25, 0x50, 0x44, 0x46, 0x2d) }, uploadPolicy),
  'magic',
  'upload boundary accepted spoofed bytes',
);
failContains(
  validateUploadBoundary({ name: 'fake.jpg', mime: 'image/png', bytes: pngBytes }, { ...uploadPolicy, allowedExtensions: ['jpg'] }),
  'extension',
  'upload boundary accepted extension spoof',
);
failContains(
  validateUploadBoundary({ name: 'fake.png', mime: 'application/pdf', bytes: pngBytes }, uploadPolicy),
  'unsupported input MIME type',
  'upload boundary accepted MIME spoof',
);

const archivePolicy = { maxEntries: 4, maxUncompressedBytes: 1000, maxDepth: 2 };
assert.equal(
  validateArchiveEntries([
    { name: 'root.txt', uncompressedBytes: 100 },
    { name: 'bundle.zip', uncompressedBytes: 100, nestedEntries: [{ name: 'nested.txt', uncompressedBytes: 200 }] },
  ], archivePolicy).safe,
  true,
);

assert.equal(detectZipBombRisk(10, 400).isBomb, false, 'exact compression threshold should be safe');
assert.equal(detectZipBombRisk(10, 401).isBomb, true, 'compression ratio above threshold must be rejected');
assert.equal(detectZipBombRisk(0, 1).isBomb, true, 'zero compressed size must fail closed');
failContains(
  validateArchiveEntries([{ name: 'bomb.bin', compressedBytes: 10, uncompressedBytes: 401 }], archivePolicy),
  'Potential ZIP bomb detected',
  'archive compression ratio bypassed',
);
assert.equal(
  validateArchiveEntries([{ name: 'safe.bin', compressedBytes: 10, uncompressedBytes: 400 }], archivePolicy).safe,
  true,
  'archive exactly at compression ratio boundary rejected',
);

failContains(
  validateArchiveEntries([
    { name: 'outer.zip', nestedEntries: [{ name: 'level1.zip', nestedEntries: [{ name: 'level2.zip', nestedEntries: [{ name: 'payload.bin', uncompressedBytes: 1 }] }] }] },
  ], archivePolicy),
  'maximum path depth',
  'nested archive depth bypassed',
);
failContains(
  validateArchiveEntries([
    { name: 'outer.zip', uncompressedBytes: 1, nestedEntries: [{ name: 'inner.zip', uncompressedBytes: 1 }, { name: 'inner2.zip', uncompressedBytes: 1 }, { name: 'inner3.zip', uncompressedBytes: 1 }, { name: 'inner4.zip', uncompressedBytes: 1 }] },
  ], archivePolicy),
  'maximum entry count',
  'nested archive entry-count limit bypassed',
);
failContains(
  validateArchiveEntries([{ name: 'archive.zip', nestedEntries: [{ name: 'payload.bin', uncompressedBytes: 1001 }] }], archivePolicy),
  'maximum uncompressed size',
  'nested archive expansion limit bypassed',
);
for (const name of ['../evil.txt', '..\\evil.txt', 'a/./b.txt']) {
  failContains(validateArchiveEntries([{ name, uncompressedBytes: 1 }], archivePolicy), 'unsafe path segment', `archive path traversal accepted: ${name}`);
}
for (const name of ['/etc/passwd', 'C:\\Windows\\system.ini', '\\\\server\\share\\evil.txt']) {
  failContains(validateArchiveEntries([{ name, uncompressedBytes: 1 }], archivePolicy), 'unsafe absolute path', `archive absolute path accepted: ${name}`);
}
failContains(validateArchiveEntries([{ name: 'link.txt', uncompressedBytes: 1, isSymlink: true }], archivePolicy), 'symlink entries are not allowed', 'archive symlink accepted');

const categories = ['PNG', 'JPEG', 'WebP', 'GIF', 'PDF', 'ZIP', 'Audio', 'Video', 'Text', 'JSON', 'CSV'];
assert.equal(binaryKeys.size >= 10, true);
assert.equal(categories.length, 11);

console.log(`G2 UNIVERSAL FILE SAFETY PASSED: matrix=${matrix.length} formats, binary=${binaryKeys.size}, archive=nested-recursive+compression-ratio, upload=raw-bytes, dimensions=bounded`);
