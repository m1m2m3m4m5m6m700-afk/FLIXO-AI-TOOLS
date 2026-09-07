import assert from 'node:assert/strict';
import { validateOutputIntegrity } from '../src/lib/contracts/output-integrity.ts';

const bytes = (...values) => new Uint8Array(values);

const REQUIRED_OUTPUT_TYPES = ['Image', 'SVG', 'ZIP', 'Text', 'JSON'];
const REQUIRED_NEGATIVE_CASES = [
  'empty',
  'missing artifact',
  'size mismatch',
  'mime spoof',
  'extension spoof',
  'path traversal',
  'corrupt signature',
  'oversized',
  'pixel overflow',
  'malformed JSON',
  'invalid UTF-8',
];

const matrix = [
  { type: 'Image', mime: 'image/png', extension: 'png', signature: '89504e470d0a1a0a', content: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) },
  { type: 'SVG', mime: 'image/svg+xml', extension: 'svg', content: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'), parseAs: 'utf8' },
  { type: 'ZIP', mime: 'application/zip', extension: 'zip', signature: '504b0304', content: bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00) },
  { type: 'Text', mime: 'text/plain', extension: 'txt', parseAs: 'utf8', content: new TextEncoder().encode('FLIXO artifact\n') },
  { type: 'JSON', mime: 'application/json', extension: 'json', parseAs: 'json', content: new TextEncoder().encode('{"ok":true}') },
];

function assertMatrixDefinition() {
  const types = matrix.map((entry) => entry.type);
  assert.equal(new Set(types).size, types.length, 'G3 output-type matrix contains duplicates');
  assert.deepEqual([...types].sort(), [...REQUIRED_OUTPUT_TYPES].sort(), 'G3 output-type matrix is incomplete or unexpected');
  assert.equal(matrix.length, REQUIRED_OUTPUT_TYPES.length, 'G3 output-type matrix cardinality changed unexpectedly');
}

const results = [];

function runCase(name, fn) {
  try {
    const outcome = fn();
    if (outcome === 'SKIP') {
      results.push({ name, status: 'SKIP' });
      return;
    }
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) });
  }
}

runCase('matrix definition', assertMatrixDefinition);

for (const entry of matrix) {
  runCase(`${entry.type} valid artifact`, () => {
    const spec = {
      toolId: `g3-${entry.type.toLowerCase()}`,
      allowedMime: [entry.mime],
      allowedExtensions: [entry.extension],
      signatures: entry.signature === undefined ? undefined : [entry.signature],
      parseAs: entry.parseAs,
      minBytes: 1,
      maxBytes: 64 * 1024 * 1024,
      maxPixels: entry.type === 'Image' ? 40_000_000 : undefined,
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
  });
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

const negativeCases = [
  ['empty', () => validateOutputIntegrity(0, 'image/png', baseline, undefined, { filename: 'flixo-result.png', bytes: new Uint8Array() }), 'bytes must be a positive integer'],
  ['missing artifact', () => validateOutputIntegrity(validPng.byteLength, 'image/png', baseline), 'artifact bytes and filename are required for artifact integrity validation'],
  ['size mismatch', () => validateOutputIntegrity(validPng.byteLength + 1, 'image/png', baseline, undefined, { filename: 'flixo-result.png', bytes: validPng }), 'declared output size does not match artifact byte length'],
  ['mime spoof', () => validateOutputIntegrity(validPng.byteLength, 'application/octet-stream', baseline, undefined, { filename: 'flixo-result.png', bytes: validPng }), 'unsupported output MIME type: application/octet-stream'],
  ['extension spoof', () => validateOutputIntegrity(validPng.byteLength, 'image/png', baseline, undefined, { filename: 'flixo-result.jpg', bytes: validPng }), 'unsupported output extension: jpg'],
  ['path traversal', () => validateOutputIntegrity(validPng.byteLength, 'image/png', baseline, undefined, { filename: '../evil.png', bytes: validPng }), 'output filename must be a single safe relative filename'],
  ['corrupt signature', () => validateOutputIntegrity(validPng.byteLength, 'image/png', baseline, undefined, { filename: 'flixo-result.png', bytes: bytes(0, 1, 2, 3, 4, 5, 6, 7) }), 'output signature does not match the allowed file signatures'],
  ['oversized', () => validateOutputIntegrity(1025, 'image/png', baseline, undefined, { filename: 'flixo-result.png', bytes: validPng }), 'output exceeds the maximum size'],
  ['pixel overflow', () => validateOutputIntegrity(validPng.byteLength, 'image/png', baseline, { width: 101, height: 100 }, { filename: 'flixo-result.png', bytes: validPng }), 'output exceeds the maximum pixel count'],
];

for (const [name, fn, expected] of negativeCases) {
  runCase(name, () => {
    const result = fn();
    assert.equal(result.valid, false, `${name} artifact accepted`);
    assert.ok(result.failures.includes(expected), `${name} diagnostic missing: ${expected}`);
  });
}

runCase('malformed JSON', () => {
  const malformedJson = new TextEncoder().encode('{"ok":}');
  const result = validateOutputIntegrity(
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
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('output JSON content is malformed'));
});

runCase('invalid UTF-8', () => {
  const invalidUtf8 = bytes(0xc3, 0x28);
  const result = validateOutputIntegrity(
    invalidUtf8.byteLength,
    'text/plain',
    {
      toolId: 'g3-utf8',
      allowedMime: ['text/plain'],
      allowedExtensions: ['txt'],
      parseAs: 'utf8',
      maxBytes: 1024,
      requireArtifact: true,
      requireSafeFilename: true,
    },
    undefined,
    { filename: 'flixo-result.txt', bytes: invalidUtf8 },
  );
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('output content is not valid UTF-8'));
});

const expectedCaseNames = [
  'matrix definition',
  ...matrix.map((entry) => `${entry.type} valid artifact`),
  ...negativeCases.map(([name]) => name),
  'malformed JSON',
  'invalid UTF-8',
];
assert.deepEqual(results.map((result) => result.name), expectedCaseNames, 'G3 test registration drift detected');
assert.equal(new Set(results.map((result) => result.name)).size, expectedCaseNames.length, 'G3 test registration contains duplicates');
assert.deepEqual([...negativeCases.map(([name]) => name), 'malformed JSON', 'invalid UTF-8'].sort(), [...REQUIRED_NEGATIVE_CASES].sort(), 'G3 negative matrix is incomplete or unexpected');

const skipped = results.filter((result) => result.status === 'SKIP');
const failed = results.filter((result) => result.status === 'FAIL');
const passed = results.filter((result) => result.status === 'PASS');

console.log(`G3 image artifact integrity matrix: executed=${results.length} passed=${passed.length} failed=${failed.length} skipped=${skipped.length}`);

if (skipped.length > 0 || failed.length > 0 || passed.length !== results.length) {
  for (const result of [...failed, ...skipped]) {
    console.error(`G3 ${result.status}: ${result.name}${result.error ? ` — ${result.error}` : ''}`);
  }
  process.exitCode = 1;
} else {
  console.log('G3 image artifact integrity matrix: PASS — no skipped or errored cases');
}
