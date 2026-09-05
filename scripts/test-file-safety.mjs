import assert from 'node:assert/strict';
import {
  MAGIC_BYTE_SIGNATURES,
  validateArchiveEntries,
  validateFileSafety,
} from '../src/lib/contracts/file-safety.ts';

const bytes = (...values) => new Uint8Array(values);
const text = (value) => new TextEncoder().encode(value);

function unsafe(result, message) {
  assert.equal(result.safe, false, message);
}

function rejects(result, failure, message) {
  unsafe(result, message);
  assert.ok(result.failures.includes(failure), message);
}

const imagePolicy = {
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
    imagePolicy,
  ),
  { safe: true, failures: [] },
);

const binaryMatrix = [
  ['png', 'image/png', 'png'],
  ['jpg', 'image/jpeg', 'jpeg'],
  ['gif', 'image/gif', 'gif'],
  ['bmp', 'image/bmp', 'bmp'],
  ['pdf', 'application/pdf', 'pdf'],
  ['zip', 'application/zip', 'zip'],
  ['ogg', 'audio/ogg', 'ogg'],
  ['flac', 'audio/flac', 'flac'],
  ['mp3', 'audio/mpeg', 'mp3'],
  ['aac', 'audio/aac', 'aac'],
  ['webm', 'video/webm', 'webm'],
  ['webp', 'image/webp', 'webp'],
  ['wav', 'audio/wav', 'wav'],
  ['avi', 'video/x-msvideo', 'avi'],
  ['mp4', 'video/mp4', 'mp4'],
  ['mov', 'video/quicktime', 'mov'],
  ['m4a', 'audio/mp4', 'm4a'],
  ['avif', 'image/avif', 'avif'],
].map(([extension, mime, key]) => {
  const signatures = {
    png: bytes(...MAGIC_BYTE_SIGNATURES.png.bytes),
    jpeg: bytes(...MAGIC_BYTE_SIGNATURES.jpeg.bytes, 0xe0),
    gif: bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61),
    bmp: bytes(0x42, 0x4d, 0x00, 0x00),
    pdf: bytes(0x25, 0x50, 0x44, 0x46, 0x2d),
    zip: bytes(0x50, 0x4b, 0x03, 0x04),
    ogg: bytes(0x4f, 0x67, 0x67, 0x53),
    flac: bytes(0x66, 0x4c, 0x61, 0x43),
    mp3: bytes(0x49, 0x44, 0x33, 0x04),
    aac: bytes(0xff, 0xf1, 0x50),
    webm: bytes(0x1a, 0x45, 0xdf, 0xa3),
    webp: bytes(0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50),
    wav: bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45),
    avi: bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20),
    mp4: bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70),
    mov: bytes(0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70),
    m4a: bytes(0x00, 0x00, 0x00, 0x10, 0x66, 0x74, 0x79, 0x70),
    avif: bytes(0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70),
  }[key];
  return { extension, mime, content: signatures, signature: MAGIC_BYTE_SIGNATURES[key === 'jpg' ? 'jpeg' : key] };
});

for (const { extension, mime, content, signature } of binaryMatrix) {
  assert.ok(signature, `missing magic signature for ${extension}`);
  assert.deepEqual(
    validateFileSafety(
      { name: `valid.${extension}`, mime, bytes: content.byteLength, content },
      { allowedMime: [mime], allowedExtensions: [extension], maxBytes: content.byteLength, magicBytes: [signature] },
    ),
    { safe: true, failures: [] },
    `valid ${extension} rejected`,
  );

  const spoofedContent = content.slice();
  const corruptionOffset = signature.offset ?? 0;
  spoofedContent[corruptionOffset] ^= 0xff;
  rejects(
    validateFileSafety(
      { name: `spoofed.${extension}`, mime, bytes: spoofedContent.byteLength, content: spoofedContent },
      { allowedMime: [mime], allowedExtensions: [extension], maxBytes: content.byteLength, magicBytes: [signature] },
    ),
    'input magic bytes do not match the allowed file signatures',
    `spoofed ${extension} accepted`,
  );
}

const riffPolicy = {
  allowedMime: ['audio/wav'],
  allowedExtensions: ['wav'],
  maxBytes: 1024,
  magicBytes: [MAGIC_BYTE_SIGNATURES.wav],
};

rejects(
  validateFileSafety(
    { name: 'partial.wav', mime: 'audio/wav', bytes: 8, content: bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0) },
    riffPolicy,
  ),
  'input magic bytes do not match the allowed file signatures',
  'partial RIFF accepted',
);

rejects(
  validateFileSafety(
    { name: 'avi-disguised.wav', mime: 'audio/wav', bytes: 12, content: bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20) },
    riffPolicy,
  ),
  'input magic bytes do not match the allowed file signatures',
  'compound RIFF spoof accepted',
);

rejects(
  validateFileSafety(
    { name: 'missing.png', mime: 'image/png', bytes: 8 },
    { allowedMime: ['image/png'], allowedExtensions: ['png'], maxBytes: 1024, magicBytes: [MAGIC_BYTE_SIGNATURES.png] },
  ),
  'input content bytes are required when magic-byte validation is enabled',
  'missing content accepted',
);

rejects(
  validateFileSafety(
    { name: 'truncated.png', mime: 'image/png', bytes: 4, content: bytes(0x89, 0x50, 0x4e, 0x47) },
    { allowedMime: ['image/png'], allowedExtensions: ['png'], maxBytes: 1024, magicBytes: [MAGIC_BYTE_SIGNATURES.png] },
  ),
  'input magic bytes do not match the allowed file signatures',
  'truncated signature accepted',
);

rejects(
  validateFileSafety(
    { name: 'mismatch.png', mime: 'image/png', bytes: 8, content: bytes(0x89, 0x50) },
    { allowedMime: ['image/png'], allowedExtensions: ['png'], maxBytes: 1024, magicBytes: [MAGIC_BYTE_SIGNATURES.png] },
  ),
  'declared file size does not match input content length',
  'content length mismatch accepted',
);

const textPolicy = { allowedMime: ['text/plain'], allowedExtensions: ['txt'], maxBytes: 64, contentValidation: 'utf8' };
const plainText = text('FLIXO safety');
assert.deepEqual(
  validateFileSafety({ name: 'note.txt', mime: 'text/plain', bytes: plainText.byteLength, content: plainText }, textPolicy),
  { safe: true, failures: [] },
);

const jsonPolicy = { allowedMime: ['application/json'], allowedExtensions: ['json'], maxBytes: 64, contentValidation: 'json' };
const goodJson = text('{"ok":true}');
assert.deepEqual(
  validateFileSafety({ name: 'data.json', mime: 'application/json', bytes: goodJson.byteLength, content: goodJson }, jsonPolicy),
  { safe: true, failures: [] },
);

const badJson = text('{"ok":}');
rejects(
  validateFileSafety({ name: 'broken.json', mime: 'application/json', bytes: badJson.byteLength, content: badJson }, jsonPolicy),
  'input JSON content is malformed',
  'malformed JSON accepted',
);

const csv = text('name,value\nflixo,1\n');
assert.deepEqual(
  validateFileSafety(
    { name: 'data.csv', mime: 'text/csv', bytes: csv.byteLength, content: csv },
    { allowedMime: ['text/csv'], allowedExtensions: ['csv'], maxBytes: 64, contentValidation: 'utf8' },
  ),
  { safe: true, failures: [] },
);

rejects(
  validateFileSafety({ name: 'bad.txt', mime: 'text/plain', bytes: 3, content: bytes(0xff, 0xfe, 0xfd) }, textPolicy),
  'input content is not valid UTF-8',
  'invalid UTF-8 accepted',
);

rejects(
  validateFileSafety(
    { name: 'fake.jpg', mime: 'image/png', bytes: 8, content: bytes(...MAGIC_BYTE_SIGNATURES.png.bytes) },
    { allowedMime: ['image/png'], allowedExtensions: ['jpg'], maxBytes: 1024 },
  ),
  'file extension does not match MIME type: .jpg -> image/png',
  'extension/MIME spoof accepted',
);

rejects(
  validateFileSafety({ name: 'empty.png', mime: 'image/png', bytes: 0, content: new Uint8Array(0) }, imagePolicy),
  'file size must be a positive integer',
  'empty file accepted',
);

rejects(
  validateFileSafety({ name: 'large.png', mime: 'image/png', bytes: imagePolicy.maxBytes + 1, signature: '89504e470d0a1a0a' }, imagePolicy),
  'file exceeds the maximum size',
  'oversized file accepted',
);

const exactMax = validateFileSafety(
  { name: 'boundary.png', mime: 'image/png', bytes: imagePolicy.maxBytes, signature: '89504e470d0a1a0a' },
  imagePolicy,
);
assert.equal(exactMax.safe, true, 'file at exact maximum size rejected');

rejects(
  validateFileSafety(
    { name: 'huge.png', mime: 'image/png', bytes: 1024, width: 10_001, height: 4_000, signature: '89504e470d0a1a0a' },
    imagePolicy,
  ),
  'input exceeds the maximum pixel count',
  'pixel limit bypassed',
);

for (const name of ['../evil.png', '..\\evil.png', '/tmp/evil.png', 'C:\\temp\\evil.png', 'nested/evil.png', 'a/./b.png']) {
  rejects(
    validateFileSafety({ name, mime: 'image/png', bytes: 1024, signature: '89504e470d0a1a0a' }, imagePolicy),
    'file name must be a single safe relative name',
    `unsafe filename accepted: ${name}`,
  );
}

const archivePolicy = { maxEntries: 3, maxUncompressedBytes: 1000, maxDepth: 2 };
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
  'archive exactly at count/size boundary rejected',
);

assert.equal(
  validateArchiveEntries([{ name: 'a/b/file.txt', uncompressedBytes: 10 }], archivePolicy).safe,
  true,
  'archive exact depth boundary rejected',
);

for (const name of ['../evil.txt', '..\\evil.txt', 'a/./b.txt']) {
  rejects(
    validateArchiveEntries([{ name, uncompressedBytes: 10 }], archivePolicy),
    `archive entry contains an unsafe path segment: ${name}`,
    `unsafe archive path segment accepted: ${name}`,
  );
}

for (const name of ['/etc/passwd', 'C:\\Windows\\system.ini', '\\\\server\\share\\evil.txt']) {
  rejects(
    validateArchiveEntries([{ name, uncompressedBytes: 10 }], archivePolicy),
    `archive entry has an unsafe absolute path: ${name}`,
    `unsafe archive absolute path accepted: ${name}`,
  );
}

rejects(
  validateArchiveEntries([{ name: 'a/b/c/file.txt', uncompressedBytes: 10 }], archivePolicy),
  'archive entry exceeds the maximum path depth: a/b/c/file.txt',
  'archive depth bypassed',
);

rejects(
  validateArchiveEntries([{ name: 'link.txt', uncompressedBytes: 10, isSymlink: true }], archivePolicy),
  'archive symlink entries are not allowed: link.txt',
  'archive symlink accepted',
);

rejects(
  validateArchiveEntries(Array.from({ length: 4 }, (_, index) => ({ name: `file-${index}.txt`, uncompressedBytes: 1 })), archivePolicy),
  'archive exceeds the maximum entry count',
  'archive entry count limit bypassed',
);

rejects(
  validateArchiveEntries([{ name: 'x.bin', uncompressedBytes: -1 }], archivePolicy),
  'archive entry has an invalid uncompressed size: x.bin',
  'negative archive size accepted',
);

rejects(
  validateArchiveEntries([{ name: 'one.bin', uncompressedBytes: 1001 }], archivePolicy),
  'archive exceeds the maximum uncompressed size',
  'archive expansion limit bypassed',
);

console.log('G2 universal file-safety matrix checks passed');
