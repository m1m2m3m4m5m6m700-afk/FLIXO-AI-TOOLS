import assert from 'node:assert/strict';
import {
  MAGIC_BYTE_SIGNATURES,
  validateArchiveEntries,
  validateFileSafety,
} from '../src/lib/contracts/file-safety.ts';

const bytesFrom = (values) => new Uint8Array(values);
const encoded = (value) => new TextEncoder().encode(value);

function expectUnsafe(result, message) {
  assert.equal(result.safe, false, message);
}

function expectFailure(result, failure, message) {
  expectUnsafe(result, message);
  assert.ok(result.failures.includes(failure), message);
}

const rasterPolicy = {
  allowedMime: ['image/png', 'image/jpeg', 'image/webp'],
  allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
  maxBytes: 25 * 1024 * 1024,
  maxPixels: 40_000_000,
  signatures: ['89504e470d0a1a0a', 'ffd8ff', '52494646'],
};

assert.deepEqual(
  validateFileSafety(
    {
      name: 'sample.png',
      mime: 'image/png',
      bytes: 1024,
      width: 4000,
      height: 4000,
      signature: '89504e470d0a1a0a0000000d',
    },
    rasterPolicy,
  ),
  { safe: true, failures: [] },
);

const binaryMatrix = [
  ['png', 'image/png', bytesFrom([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ['jpeg', 'image/jpeg', bytesFrom([0xff, 0xd8, 0xff, 0xe0])],
  ['gif', 'image/gif', bytesFrom([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
  ['bmp', 'image/bmp', bytesFrom([0x42, 0x4d, 0x00, 0x00])],
  ['pdf', 'application/pdf', bytesFrom([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])],
  ['zip', 'application/zip', bytesFrom([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])],
  ['ogg', 'audio/ogg', bytesFrom([0x4f, 0x67, 0x67, 0x53])],
  ['flac', 'audio/flac', bytesFrom([0x66, 0x4c, 0x61, 0x43])],
  ['mp3', 'audio/mpeg', bytesFrom([0x49, 0x44, 0x33, 0x04])],
  ['aac', 'audio/aac', bytesFrom([0xff, 0xf1, 0x50, 0x80])],
  ['webm', 'video/webm', bytesFrom([0x1a, 0x45, 0xdf, 0xa3])],
  ['webp', 'image/webp', bytesFrom([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])],
  ['wav', 'audio/wav', bytesFrom([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45])],
  ['avi', 'video/x-msvideo', bytesFrom([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20])],
  ['mp4', 'video/mp4', bytesFrom([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])],
  ['mov', 'video/quicktime', bytesFrom([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70])],
  ['m4a', 'audio/mp4', bytesFrom([0x00, 0x00, 0x00, 0x10, 0x66, 0x74, 0x79, 0x70])],
  ['avif', 'image/avif', bytesFrom([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70])],
];

for (const [extension, mime, content] of binaryMatrix) {
  const key = extension === 'jpg' ? 'jpeg' : extension;
  const signature = MAGIC_BYTE_SIGNATURES[key];
  assert.ok(signature, `missing magic-byte policy for ${extension}`);
  const result = validateFileSafety(
    {
      name: `valid.${extension}`,
      mime,
      bytes: content.byteLength,
      content,
    },
    {
      allowedMime: [mime],
      allowedExtensions: [extension],
      maxBytes: content.byteLength,
      magicBytes: [signature],
    },
  );
  assert.deepEqual(result, { safe: true, failures: [] }, `valid ${extension} rejected`);

  const spoofedContent = content.slice();
  spoofedContent[0] ^= 0xff;
  const spoofed = validateFileSafety(
    {
      name: `spoofed.${extension}`,
      mime,
      bytes: spoofedContent.byteLength,
      content: spoofedContent,
    },
    {
      allowedMime: [mime],
      allowedExtensions: [extension],
      maxBytes: content.byteLength,
      magicBytes: [signature],
    },
  );
  expectFailure(spoofed, 'input magic bytes do not match the allowed file signatures', `spoofed ${extension} accepted`);
}

const riffPolicy = {
  allowedMime: ['audio/wav'],
  allowedExtensions: ['wav'],
  maxBytes: 1024,
  magicBytes: [MAGIC_BYTE_SIGNATURES.wav],
};

expectFailure(
  validateFileSafety(
    {
      name: 'partial.wav',
      mime: 'audio/wav',
      bytes: 8,
      content: bytesFrom([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]),
    },
    riffPolicy,
  ),
  'input magic bytes do not match the allowed file signatures',
  'partial RIFF accepted',
);

expectFailure(
  validateFileSafety(
    {
      name: 'avi-disguised.wav',
      mime: 'audio/wav',
      bytes: 12,
      content: bytesFrom([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20]),
    },
    riffPolicy,
  ),
  'input magic bytes do not match the allowed file signatures',
  'compound RIFF spoof accepted',
);

expectFailure(
  validateFileSafety(
    { name: 'missing.png', mime: 'image/png', bytes: 8 },
    {
      allowedMime: ['image/png'],
      allowedExtensions: ['png'],
      maxBytes: 1024,
      magicBytes: [MAGIC_BYTE_SIGNATURES.png],
    },
  ),
  'input content bytes are required when magic-byte validation is enabled',
  'missing content accepted',
);

expectFailure(
  validateFileSafety(
    { name: 'truncated.png', mime: 'image/png', bytes: 4, content: bytesFrom([0x89, 0x50, 0x4e, 0x47]) },
    {
      allowedMime: ['image/png'],
      allowedExtensions: ['png'],
      maxBytes: 1024,
      magicBytes: [MAGIC_BYTE_SIGNATURES.png],
    },
  ),
  'input magic bytes do not match the allowed file signatures',
  'truncated signature accepted',
);

const contentPolicy = {
  allowedMime: ['text/plain'],
  allowedExtensions: ['txt'],
  maxBytes: 64,
  contentValidation: 'utf8',
};
const plainText = encoded('FLIXO safety');
assert.deepEqual(
  validateFileSafety(
    { name: 'note.txt', mime: 'text/plain', bytes: plainText.byteLength, content: plainText },
    contentPolicy,
  ),
  { safe: true, failures: [] },
);

const jsonContent = encoded('{"ok":true}');
assert.deepEqual(
  validateFileSafety(
    { name: 'data.json', mime: 'application/json', bytes: jsonContent.byteLength, content: jsonContent },
    { allowedMime: ['application/json'], allowedExtensions: ['json'], maxBytes: 64, contentValidation: 'json' },
  ),
  { safe: true, failures: [] },
);

expectFailure(
  validateFileSafety(
    {
      name: 'broken.json',
      mime: 'application/json',
      bytes: 10,
      content: encoded('{"ok":}'),
    },
    { allowedMime: ['application/json'], allowedExtensions: ['json'], maxBytes: 64, contentValidation: 'json' },
  ),
  'input JSON content is malformed',
  'malformed JSON accepted',
);

const csvContent = encoded('name,value\nflixo,1\n');
assert.deepEqual(
  validateFileSafety(
    { name: 'data.csv', mime: 'text/csv', bytes: csvContent.byteLength, content: csvContent },
    { allowedMime: ['text/csv'], allowedExtensions: ['csv'], maxBytes: 64, contentValidation: 'utf8' },
  ),
  { safe: true, failures: [] },
);

expectFailure(
  validateFileSafety(
    { name: 'bad.txt', mime: 'text/plain', bytes: 3, content: bytesFrom([0xff, 0xfe, 0xfd]) },
    contentPolicy,
  ),
  'input content is not valid UTF-8',
  'invalid UTF-8 accepted',
);

expectFailure(
  validateFileSafety(
    { name: 'fake.jpg', mime: 'image/png', bytes: 8, content: MAGIC_BYTE_SIGNATURES.png.bytes ? bytesFrom(MAGIC_BYTE_SIGNATURES.png.bytes) : bytesFrom([]) },
    { allowedMime: ['image/png'], allowedExtensions: ['jpg'], maxBytes: 1024 },
  ),
  'file extension does not match MIME type: .jpg -> image/png',
  'extension/MIME spoof accepted',
);

expectFailure(
  validateFileSafety(
    { name: 'payload.txt', mime: 'text/plain', bytes: 10, signature: '25504446' },
    rasterPolicy,
  ),
  'unsupported input MIME type: text/plain',
  'MIME spoof accepted',
);

expectFailure(
  validateFileSafety(
    { name: 'empty.png', mime: 'image/png', bytes: 0, content: new Uint8Array(0) },
    rasterPolicy,
  ),
  'file size must be a positive integer',
  'empty file accepted',
);

expectFailure(
  validateFileSafety(
    { name: 'large.png', mime: 'image/png', bytes: rasterPolicy.maxBytes + 1 },
    rasterPolicy,
  ),
  'file exceeds the maximum size',
  'oversized file accepted',
);

const exactMax = validateFileSafety(
  { name: 'boundary.png', mime: 'image/png', bytes: rasterPolicy.maxBytes },
  rasterPolicy,
);
assert.equal(exactMax.safe, true, 'file at exact maximum size rejected');

expectFailure(
  validateFileSafety(
    { name: 'huge.png', mime: 'image/png', bytes: 1024, width: 10_001, height: 4_000 },
    rasterPolicy,
  ),
  'input exceeds the maximum pixel count',
  'pixel limit bypassed',
);

for (const name of [
  '../evil.png',
  '..\\evil.png',
  '/tmp/evil.png',
  'C:\\temp\\evil.png',
  'nested/evil.png',
  'a/./b.png',
]) {
  const result = validateFileSafety(
    { name, mime: 'image/png', bytes: 1024, signature: '89504e470d0a1a0a' },
    rasterPolicy,
  );
  expectFailure(result, 'file name must be a single safe relative name', `unsafe filename accepted: ${name}`);
}

expectFailure(
  validateFileSafety(
    { name: 'mismatch.png', mime: 'image/png', bytes: 8, content: bytesFrom([0x89, 0x50]) },
    { allowedMime: ['image/png'], allowedExtensions: ['png'], maxBytes: 1024, magicBytes: [MAGIC_BYTE_SIGNATURES.png] },
  ),
  'declared file size does not match input content length',
  'content length mismatch accepted',
);

const archivePolicy = { maxEntries: 3, maxUncompressedBytes: 1000, maxDepth: 2 };
assert.deepEqual(
  validateArchiveEntries(
    [
      { name: 'images/photo.png', uncompressedBytes: 400 },
      { name: 'notes/readme.txt', uncompressedBytes: 300 },
    ],
    archivePolicy,
  ),
  { safe: true, failures: [] },
);

assert.equal(
  validateArchiveEntries(
    [
      { name: 'a.txt', uncompressedBytes: 300 },
      { name: 'b.txt', uncompressedBytes: 300 },
      { name: 'c.txt', uncompressedBytes: 400 },
    ],
    archivePolicy,
  ).safe,
  true,
  'archive exactly at entry/size limits rejected',
);

for (const name of ['../evil.txt', '..\\evil.txt', '/etc/passwd', 'C:\\Windows\\system.ini', 'a/./b.txt']) {
  const result = validateArchiveEntries([{ name, uncompressedBytes: 10 }], archivePolicy);
  expectUnsafe(result, `unsafe archive path accepted: ${name}`);
}

expectFailure(
  validateArchiveEntries([{ name: 'a/b/c/file.txt', uncompressedBytes: 10 }], archivePolicy),
  'archive entry exceeds the maximum path depth: a/b/c/file.txt',
  'archive depth boundary bypassed',
);

const exactDepth = validateArchiveEntries([{ name: 'a/b/file.txt', uncompressedBytes: 10 }], archivePolicy);
assert.equal(exactDepth.safe, true, 'archive entry at exact maximum depth rejected');

expectFailure(
  validateArchiveEntries(
    [
      { name: 'one.bin', uncompressedBytes: 700 },
      { name: 'two.bin', uncompressedBytes: 301 },
    ],
    archivePolicy,
  ),
  'archive exceeds the maximum uncompressed size',
  'archive expansion limit bypassed',
);

expectFailure(
  validateArchiveEntries(
    Array.from({ length: 4 }, (_, index) => ({ name: `file-${index}.txt`, uncompressedBytes: 1 })),
    archivePolicy,
  ),
  'archive exceeds the maximum entry count',
  'archive entry count limit bypassed',
);

expectFailure(
  validateArchiveEntries([{ name: 'link.txt', uncompressedBytes: 10, isSymlink: true }], archivePolicy),
  'archive symlink entries are not allowed: link.txt',
  'archive symlink accepted',
);

expectFailure(
  validateArchiveEntries([{ name: 'bad.bin', uncompressedBytes: -1 }], archivePolicy),
  'archive entry has an invalid uncompressed size: bad.bin',
  'negative archive size accepted',
);

console.log('G2 universal file-safety matrix checks passed');
