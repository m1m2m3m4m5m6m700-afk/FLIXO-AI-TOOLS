import assert from 'node:assert/strict';
import { validateOutputIntegrity } from '../src/lib/contracts/output-integrity.ts';

const bytes = (...values) => new Uint8Array(values);

const matrix = [
  { type: 'Image', mime: 'image/png', extension: 'png', signature: '89504e470d0a1a0a', content: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) },
  { type: 'PDF', mime: 'application/pdf', extension: 'pdf', signature: '255044462d', content: bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37) },
  { type: 'ZIP', mime: 'application/zip', extension: 'zip', signature: '504b0304', content: bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00) },
  { type: 'Text', mime: 'text/plain', extension: 'txt', parseAs: 'utf8', content: new TextEncoder().encode('FLIXO artifact\n') },
  { type: 'JSON', mime: 'application/json', extension: 'json', parseAs: 'json', content: new TextEncoder().encode('{"ok":true}') },
  { type: 'CSV', mime: 'text/csv', extension: 'csv', parseAs: 'utf8', content: new TextEncoder().encode('name,value\nflixo,1\n') },
  { type: 'Audio', mime: 'audio/mpeg', extension: 'mp3', signature: '494433', content: bytes(0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00) },
  { type: 'Video', mime: 'video/mp4', extension: 'mp4', signature: { hex: '66747970', offset: 4 }, content: bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70) },
];

for (const entry of matrix) {
  const spec = {
    toolId: `g3-${entry.type.toLowerCase()}`,
    allowedMime: [entry.mime],
    allowedExtensions: [entry.extension],
    signatures: entry.signature === undefined ? undefined : [entry.signature],
    parseAs: entry.parseAs,
    minBytes: 1,
    maxBytes: 64 * 1024 * 1024,
    requireArtifact: true,
    requireSafeFilename: true,
  };
  const result = validateOutputIntegrity(
    entry.content.byteLength,
    entry.mime,
    spec,
    entry.type === 'Image' ? { width: 100, height: 100 } : undefined,
    { filename: `flixo-result.${entry.extension}`, bytes: entry.content },
  );
  assert.equal(result.valid, true, `${entry.type} valid artifact rejected: ${result.failures.join('; ')}`);
}

const baseline = {
  toolId: 'g3-negative',
  allowedMime: ['image/png'],
  allowedExtensions: ['png'],
  signatures: ['89504e470d0a1a0a'],
  minBytes: 1,
  maxBytes: 1024,
  maxPixels: 10_000,
  requireArtifact: true,
  requireSafeFilename: true,
};
const validPng = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

const cases = [
  ['empty', validateOutputIntegrity(0, 'image/png', baseline, undefined, { filename: 'flixo-result.png', bytes: new Uint8Array() }), 'bytes must be a positive integer'],
  ['missing artifact', validateOutputIntegrity(validPng.byteLength, 'image/png', baseline), 'artifact bytes and filename are required for artifact integrity validation'],
  ['size mismatch', validateOutputIntegrity(validPng.byteLength + 1, 'image/png', baseline, undefined, { filename: 'flixo-result.png', bytes: validPng }), 'declared output size does not match artifact byte length'],
  ['mime spoof', validateOutputIntegrity(validPng.byteLength, 'application/octet-stream', baseline, undefined, { filename: 'flixo-result.png', bytes: validPng }), 'unsupported output MIME type: application/octet-stream'],
  ['extension spoof', validateOutputIntegrity(validPng.byteLength, 'image/png', baseline, undefined, { filename: 'flixo-result.jpg', bytes: validPng }), 'unsupported output extension: jpg'],
  ['path traversal', validateOutputIntegrity(validPng.byteLength, 'image/png', baseline, undefined, { filename: '../evil.png', bytes: validPng }), 'output filename must be a single safe relative filename'],
  ['corrupt signature', validateOutputIntegrity(validPng.byteLength, 'image/png', baseline, undefined, { filename: 'flixo-result.png', bytes: bytes(0, 1, 2, 3, 4, 5, 6, 7) }), 'output signature does not match the allowed file signatures'],
  ['oversized', validateOutputIntegrity(1025, 'image/png', baseline, undefined, { filename: 'flixo-result.png', bytes: validPng }), 'output exceeds the maximum size'],
  ['pixel overflow', validateOutputIntegrity(validPng.byteLength, 'image/png', baseline, { width: 101, height: 100 }, { filename: 'flixo-result.png', bytes: validPng }), 'output exceeds the maximum pixel count'],
];

for (const [name, result, expected] of cases) {
  assert.equal(result.valid, false, `${name} artifact accepted`);
  assert.ok(result.failures.includes(expected), `${name} diagnostic missing: ${expected}`);
}

const malformedJson = new TextEncoder().encode('{"ok":}');
const jsonResult = validateOutputIntegrity(
  malformedJson.byteLength,
  'application/json',
  {
    toolId: 'g3-json',
    allowedMime: ['application/json'],
    allowedExtensions: ['json'],
    parseAs: 'json',
    maxBytes: 1024,
    requireArtifact: true,
    requireSafeFilename: true,
  },
  undefined,
  { filename: 'flixo-result.json', bytes: malformedJson },
);
assert.equal(jsonResult.valid, false);
assert.ok(jsonResult.failures.includes('output JSON content is malformed'));

console.log(`G3 universal artifact integrity matrix passed: ${matrix.length} output types, ${cases.length + 1} negative/edge scenarios`);
