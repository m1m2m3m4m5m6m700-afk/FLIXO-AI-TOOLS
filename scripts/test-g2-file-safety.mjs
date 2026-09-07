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
  const length = Math.max(
    (signature.offset ?? 0) + signature.bytes.length,
    ...((signature.segments ?? []).map((segment) => segment.offset + segment.bytes.length)),
  );
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
  ['bmp', 'image/bmp', 'bmp'],
  ['avif', 'image/avif', 'avif'],
  ['zip', 'application/zip', 'zip'],
];

const binaryKeys = new Set(matrix.map(([, , key]) => key));

for (const [extension, mime, signatureKey] of matrix) {
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
  corrupt[signature.offset ?? 0] ^= 0xff;
  failContains(
    validateFileSafety({ name: `corrupt.${extension}`, mime, bytes: corrupt.byteLength, content: corrupt }, policy),
    'input magic bytes do not match',
    `corrupt ${extension} accepted`,
  );
}

const textContent = text('FLIXO safe text');
assert.equal(
  validateFileSafety(
    { name: 'valid.txt', mime: 'text/plain', bytes: textContent.byteLength, content: textContent },
    { allowedMime: ['text/plain'], allowedExtensions: ['txt'], maxBytes: 64, contentValidation: 'utf8' },
  ).safe,
  true,
);

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

const imagePolicy = { allowedMime: ['image/png'], allowedExtensions: ['png'], maxBytes: 64, maxPixels: 100 };
failContains(
  validateFileSafety({ name: 'empty.png', mime: 'image/png', bytes: 0, content: new Uint8Array(0) }, imagePolicy),
  'file size must be a positive integer',
  'empty file accepted',
);
failContains(
  validateFileSafety({ name: 'huge.png', mime: 'image/png', bytes: 65, signature: '89504e470d0a1a0a' }, imagePolicy),
  'file exceeds the maximum size',
  'oversized file accepted',
);
assert.equal(
  validateFileSafety({ name: 'boundary.png', mime: 'image/png', bytes: 64, signature: '89504e470d0a1a0a', width: 10, height: 10 }, imagePolicy).safe,
  true,
);
failContains(
  validateFileSafety({ name: 'pixel-bomb.png', mime: 'image/png', bytes: 8, signature: '89504e470d0a1a0a', width: 11, height: 10 }, imagePolicy),
  'input exceeds the maximum pixel count',
  'pixel limit bypassed',
);

for (const name of ['../evil.png', '..\\evil.png', '/tmp/evil.png', 'C:\\temp\\evil.png', 'nested/evil.png', 'a/./b.png']) {
  failContains(
    validateFileSafety({ name, mime: 'image/png', bytes: 8, signature: '89504e470d0a1a0a' }, imagePolicy),
    'file name must be a single safe relative name',
    `unsafe filename accepted: ${name}`,
  );
}

const uploadPolicy = {
  allowedMime: ['image/png'],
  allowedExtensions: ['png'],
  maxBytes: 64,
  signatures: ['89504e470d0a1a0a'],
  magicBytes: [MAGIC_BYTE_SIGNATURES.png],
};
const pngBytes = bytes(...MAGIC_BYTE_SIGNATURES.png.bytes, 0x00);
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
assert.equal(validateArchiveEntries([{ name: 'safe.bin', compressedBytes: 10, uncompressedBytes: 400 }], archivePolicy).safe, true);
failContains(
  validateArchiveEntries([{ name: 'outer.zip', nestedEntries: [{ name: 'level1.zip', nestedEntries: [{ name: 'level2.zip', nestedEntries: [{ name: 'payload.bin', uncompressedBytes: 1 }] }] }] }], archivePolicy),
  'maximum path depth',
  'nested archive depth bypassed',
);
failContains(
  validateArchiveEntries([{ name: 'outer.zip', uncompressedBytes: 1, nestedEntries: [{ name: 'inner.zip', uncompressedBytes: 1 }, { name: 'inner2.zip', uncompressedBytes: 1 }, { name: 'inner3.zip', uncompressedBytes: 1 }, { name: 'inner4.zip', uncompressedBytes: 1 }] }], archivePolicy),
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

assert.equal(matrix.length, 7, 'G2 image/archive matrix drift detected');
assert.equal(binaryKeys.size, 7, 'G2 binary matrix drift detected');
console.log(`G2 image file-safety passed: matrix=${matrix.length}, binary=${binaryKeys.size}, OCR=text/json, archive=zip`);
