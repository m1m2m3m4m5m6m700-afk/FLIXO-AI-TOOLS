import assert from 'node:assert/strict';
import { MAGIC_BYTE_SIGNATURES, validateArchiveEntries, validateFileSafety } from '../src/lib/contracts/file-safety.ts';

const bytes = (...values) => new Uint8Array(values);
const text = (value) => new TextEncoder().encode(value);
const reject = (result, expected, message) => {
  assert.equal(result.safe, false, message);
  assert.ok(result.failures.includes(expected), `${message}: ${result.failures.join('; ')}`);
};

const imageCases = [
  ['png', 'image/png', 'png'],
  ['jpg', 'image/jpeg', 'jpeg'],
  ['webp', 'image/webp', 'webp'],
  ['gif', 'image/gif', 'gif'],
  ['bmp', 'image/bmp', 'bmp'],
  ['avif', 'image/avif', 'avif'],
];

for (const [extension, mime, key] of imageCases) {
  const signature = MAGIC_BYTE_SIGNATURES[key];
  assert.ok(signature, `missing image signature: ${key}`);
  const content = new Uint8Array(signature.bytes);
  assert.deepEqual(
    validateFileSafety({ name: `sample.${extension}`, mime, bytes: content.byteLength, content }, {
      allowedMime: [mime], allowedExtensions: [extension], maxBytes: 1024, magicBytes: [signature],
    }),
    { safe: true, failures: [] },
  );
  const corrupt = content.slice();
  corrupt[signature.offset ?? 0] ^= 0xff;
  reject(
    validateFileSafety({ name: `corrupt.${extension}`, mime, bytes: corrupt.byteLength, content: corrupt }, {
      allowedMime: [mime], allowedExtensions: [extension], maxBytes: 1024, magicBytes: [signature],
    }),
    'input magic bytes do not match the allowed file signatures',
    `corrupt ${extension} accepted`,
  );
}

const pngSignature = MAGIC_BYTE_SIGNATURES.png;
const png = bytes(...pngSignature.bytes);
const imagePolicy = { allowedMime: ['image/png'], allowedExtensions: ['png'], maxBytes: 1024, maxPixels: 100, magicBytes: [pngSignature] };
assert.equal(validateFileSafety({ name: 'boundary.png', mime: 'image/png', bytes: 1024, signature: '89504e470d0a1a0a' }, imagePolicy).safe, true);
reject(validateFileSafety({ name: 'empty.png', mime: 'image/png', bytes: 0, content: new Uint8Array() }, imagePolicy), 'file size must be a positive integer', 'empty file accepted');
reject(validateFileSafety({ name: 'large.png', mime: 'image/png', bytes: 1025, signature: '89504e470d0a1a0a' }, imagePolicy), 'file exceeds the maximum size', 'oversized file accepted');
reject(validateFileSafety({ name: 'pixels.png', mime: 'image/png', bytes: png.byteLength, width: 11, height: 10, content: png }, imagePolicy), 'input exceeds the maximum pixel count', 'pixel limit bypassed');
reject(validateFileSafety({ name: 'missing.png', mime: 'image/png', bytes: png.byteLength, signature: '89504e470d0a1a0a' }, imagePolicy), 'input content bytes are required when magic-byte validation is enabled', 'missing content accepted');
reject(validateFileSafety({ name: 'spoof.jpg', mime: 'image/png', bytes: png.byteLength, content: png }, { ...imagePolicy, allowedExtensions: ['jpg'] }), 'file extension does not match MIME type: .jpg -> image/png', 'MIME/extension spoof accepted');

for (const name of ['../evil.png', '..\\evil.png', '/tmp/evil.png', 'C:\\temp\\evil.png', 'a/./b.png']) {
  reject(validateFileSafety({ name, mime: 'image/png', bytes: png.byteLength, content: png }, imagePolicy), 'file name must be a single safe relative name', `unsafe filename accepted: ${name}`);
}

const textPolicy = { allowedMime: ['text/plain'], allowedExtensions: ['txt'], maxBytes: 64, contentValidation: 'utf8' };
const plain = text('FLIXO safety');
assert.equal(validateFileSafety({ name: 'note.txt', mime: 'text/plain', bytes: plain.byteLength, content: plain }, textPolicy).safe, true);
reject(validateFileSafety({ name: 'bad.txt', mime: 'text/plain', bytes: 2, content: bytes(0xff, 0xfe) }, textPolicy), 'input content is not valid UTF-8', 'invalid UTF-8 accepted');

const jsonPolicy = { allowedMime: ['application/json'], allowedExtensions: ['json'], maxBytes: 64, contentValidation: 'json' };
const goodJson = text('{"ok":true}');
assert.equal(validateFileSafety({ name: 'data.json', mime: 'application/json', bytes: goodJson.byteLength, content: goodJson }, jsonPolicy).safe, true);
const badJson = text('{"ok":}');
reject(validateFileSafety({ name: 'bad.json', mime: 'application/json', bytes: badJson.byteLength, content: badJson }, jsonPolicy), 'input JSON content is malformed', 'malformed JSON accepted');

const archivePolicy = { maxEntries: 3, maxUncompressedBytes: 1000, maxDepth: 2 };
assert.equal(validateArchiveEntries([{ name: 'a.txt', uncompressedBytes: 300 }, { name: 'b.txt', uncompressedBytes: 300 }, { name: 'c.txt', uncompressedBytes: 400 }], archivePolicy).safe, true);
reject(validateArchiveEntries([{ name: '../evil.txt', uncompressedBytes: 1 }], archivePolicy), 'archive entry contains an unsafe path segment: ../evil.txt', 'archive traversal accepted');
reject(validateArchiveEntries([{ name: '/etc/passwd', uncompressedBytes: 1 }], archivePolicy), 'archive entry has an unsafe absolute path: /etc/passwd', 'archive absolute path accepted');
reject(validateArchiveEntries([{ name: 'a/b/c/file.txt', uncompressedBytes: 1 }], archivePolicy), 'archive entry exceeds the maximum path depth: a/b/c/file.txt', 'archive depth bypassed');
reject(validateArchiveEntries([{ name: 'link.txt', uncompressedBytes: 1, isSymlink: true }], archivePolicy), 'archive symlink entries are not allowed: link.txt', 'archive symlink accepted');
reject(validateArchiveEntries(Array.from({ length: 4 }, (_, i) => ({ name: `f${i}.txt`, uncompressedBytes: 1 })), archivePolicy), 'archive exceeds the maximum entry count', 'archive entry count bypassed');
reject(validateArchiveEntries([{ name: 'large.bin', uncompressedBytes: 1001 }], archivePolicy), 'archive exceeds the maximum uncompressed size', 'archive expansion limit bypassed');

console.log(`G2 file safety passed: image formats=${imageCases.length}, OCR=text/json, archive=zip`);
