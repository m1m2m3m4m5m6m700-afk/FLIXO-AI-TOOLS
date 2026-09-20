import assert from 'node:assert/strict';
import { detectZipBombRisk, validateArchiveEntries, validateFileSafety } from '../src/lib/contracts/file-safety.ts';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const safeImagePolicy = {
  allowedMime: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif', 'image/svg+xml'],
  allowedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg'],
  signatures: ['89504e470d0a1a0a'],
  maxBytes: 10 * 1024 * 1024,
  maxPixels: 40_000_000,
};

assert.equal(validateFileSafety({ name: 'photo.png', mime: 'image/png', bytes: png.byteLength, content: png, signature: '89504e470d0a1a0a', width: 1, height: 1 }, safeImagePolicy).safe, true);
assert.equal(validateFileSafety({ name: '/photo.png', mime: 'image/png', bytes: png.byteLength, content: png }, safeImagePolicy).safe, false);
assert.equal(validateFileSafety({ name: '../photo.png', mime: 'image/png', bytes: png.byteLength, content: png }, safeImagePolicy).safe, false);
assert.equal(validateFileSafety({ name: 'photo.pdf', mime: 'application/pdf', bytes: png.byteLength, content: png }, safeImagePolicy).safe, false);
assert.equal(validateFileSafety({ name: 'photo.png', mime: 'image/png', bytes: 0 }, safeImagePolicy).safe, false);
assert.equal(validateFileSafety({ name: 'photo.png', mime: 'image/png', bytes: png.byteLength, content: png, width: 7000, height: 7000 }, safeImagePolicy).safe, false);

const json = new TextEncoder().encode('{"text":"OCR"}');
const jsonPolicy = { allowedMime: ['application/json'], allowedExtensions: ['json'], contentValidation: 'json', maxBytes: 1024 * 1024 };
assert.equal(validateFileSafety({ name: 'ocr.json', mime: 'application/json', bytes: json.byteLength, content: json }, jsonPolicy).safe, true);
assert.equal(validateFileSafety({ name: 'ocr.json', mime: 'application/json', bytes: 6, content: new TextEncoder().encode('{oops') }, jsonPolicy).safe, false);

assert.equal(detectZipBombRisk(100, 2000, 40).isBomb, false);
assert.equal(detectZipBombRisk(100, 5000, 40).isBomb, true);
assert.equal(validateArchiveEntries([{ name: 'result.png', compressedBytes: 100, uncompressedBytes: 1000 }], { maxEntries: 10, maxUncompressedBytes: 20_000, maxDepth: 2, maxCompressionRatio: 40 }).safe, true);
assert.equal(validateArchiveEntries([{ name: '../result.png', compressedBytes: 100, uncompressedBytes: 100 }], { maxEntries: 10, maxUncompressedBytes: 20_000, maxDepth: 2, maxCompressionRatio: 40 }).safe, false);
assert.equal(validateArchiveEntries([{ name: 'nested', nestedEntries: [{ name: 'result.png' }] }], { maxEntries: 10, maxUncompressedBytes: 20_000, maxDepth: 0 }).safe, false);

console.log('File safety regression contract passed.');
