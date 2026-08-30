import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { validateOutputIntegrity } from '../src/lib/contracts/output-integrity.ts';

const bytes = (...values) => new Uint8Array(values);
const text = (value) => new TextEncoder().encode(value);
const REQUIRED_OUTPUT_TYPES = ['Image', 'PDF', 'ZIP', 'Text', 'JSON', 'CSV', 'Audio', 'Video'];
const REQUIRED_CASES = [
  'empty',
  'missing artifact',
  'size mismatch',
  'mime spoof',
  'extension spoof',
  'unsafe artifact name',
  'corrupt signature',
  'oversized',
  'exact size boundary',
  'pixel overflow',
  'invalid dimensions',
  'malformed JSON',
  'invalid UTF-8',
  'missing extension',
];

const ONE_BY_ONE_PNG = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
));

const buildFixtures = async () => {
  const pdf = await PDFDocument.create();
  const pdfPage = pdf.addPage([100, 100]);
  pdfPage.drawText('FLIXO G3');
  const pdfBytes = new Uint8Array(await pdf.save());

  const zip = new JSZip();
  zip.file('artifact.txt', 'FLIXO G3');
  const zipBytes = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));

  return [
    { type: 'Image', mime: 'image/png', extension: 'png', signature: '89504e470d0a1a0a', content: ONE_BY_ONE_PNG, dimensions: { width: 1, height: 1 }, parse: 'image' },
    { type: 'PDF', mime: 'application/pdf', extension: 'pdf', signature: '255044462d', content: pdfBytes, parse: 'pdf' },
    { type: 'ZIP', mime: 'application/zip', extension: 'zip', signature: '504b0304', content: zipBytes, parse: 'zip' },
    { type: 'Text', mime: 'text/plain', extension: 'txt', content: text('FLIXO artifact\n'), parse: 'utf8' },
    { type: 'JSON', mime: 'application/json', extension: 'json', content: text('{"ok":true}'), parse: 'json' },
    { type: 'CSV', mime: 'text/csv', extension: 'csv', content: text('name,value\nflixo,1\n'), parse: 'utf8' },
    { type: 'Audio', mime: 'audio/mpeg', extension: 'mp3', signature: '494433', content: bytes(0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00), parse: 'signature' },
    { type: 'Video', mime: 'video/mp4', extension: 'mp4', signature: { hex: '66747970', offset: 4 }, content: bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d), parse: 'signature' },
  ];
};

const inspectParseability = async (entry) => {
  if (entry.parse === 'utf8' || entry.parse === 'json') {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(entry.content);
    if (entry.parse === 'json') JSON.parse(decoded);
    return;
  }
  if (entry.parse === 'pdf') {
    assert.ok(entry.content.slice(0, 5).every((value, index) => value === [0x25, 0x50, 0x44, 0x46, 0x2d][index]), 'PDF header is invalid');
    assert.ok(Buffer.from(entry.content).includes(Buffer.from('%%EOF')), 'PDF EOF marker is missing');
    await PDFDocument.load(entry.content);
    return;
  }
  if (entry.parse === 'zip') {
    const loaded = await JSZip.loadAsync(entry.content);
    const names = Object.keys(loaded.files);
    assert.ok(names.length > 0, 'ZIP archive has no entries');
    assert.ok(names.includes('artifact.txt'), 'ZIP fixture entry is missing');
    const payload = await loaded.file('artifact.txt').async('string');
    assert.equal(payload, 'FLIXO G3');
    return;
  }
  if (entry.parse === 'image') {
    assert.deepEqual(Array.from(entry.content.slice(0, 8)), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const width = new DataView(entry.content.buffer, entry.content.byteOffset, entry.content.byteLength).getUint32(16);
    const height = new DataView(entry.content.buffer, entry.content.byteOffset, entry.content.byteLength).getUint32(20);
    assert.deepEqual({ width, height }, entry.dimensions);
    return;
  }
  if (entry.parse === 'signature') return;
  throw new Error(`Unknown G3 parse strategy: ${entry.parse}`);
};

const createSpec = (entry, overrides = {}) => ({
  toolId: `g3-${entry.type.toLowerCase()}`,
  allowedMime: [entry.mime],
  allowedExtensions: [entry.extension],
  signatures: entry.signature === undefined ? undefined : [entry.signature],
  parseAs: entry.parse === 'json' ? 'json' : entry.parse === 'utf8' ? 'utf8' : undefined,
  minBytes: 1,
  maxBytes: 64 * 1024 * 1024,
  maxPixels: entry.type === 'Image' ? 40_000_000 : undefined,
  requireArtifact: true,
  requireSafeFilename: true,
  ...overrides,
});

const results = [];
const runCase = async (name, fn) => {
  try {
    await fn();
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) });
  }
};

const matrix = await buildFixtures();

await runCase('matrix definition', () => {
  assert.deepEqual(matrix.map((entry) => entry.type).sort(), [...REQUIRED_OUTPUT_TYPES].sort());
  assert.equal(new Set(matrix.map((entry) => entry.type)).size, REQUIRED_OUTPUT_TYPES.length, 'G3 output-type matrix contains duplicates');
  for (const entry of matrix) assert.ok(entry.content.byteLength > 0, `${entry.type} fixture is empty`);
});

for (const entry of matrix) {
  await runCase(`${entry.type} valid artifact`, async () => {
    const spec = createSpec(entry);
    const artifact = { filename: `flixo-result.${entry.extension}`, bytes: entry.content };
    const result = validateOutputIntegrity(entry.content.byteLength, entry.mime, spec, entry.dimensions, artifact);
    assert.equal(result.valid, true, `${entry.type} rejected: ${result.failures.join('; ')}`);
    await inspectParseability(entry);
  });
}

const pngEntry = matrix.find((entry) => entry.type === 'Image');
assert.ok(pngEntry);
const pngSpec = createSpec(pngEntry, { maxBytes: 1024, maxPixels: 1 });
const png = pngEntry.content;
const negativeCases = [
  ['empty', () => validateOutputIntegrity(0, 'image/png', pngSpec, undefined, { filename: 'flixo-result.png', bytes: new Uint8Array() }), 'bytes must be a positive integer'],
  ['missing artifact', () => validateOutputIntegrity(png.byteLength, 'image/png', pngSpec), 'artifact bytes and filename are required for artifact integrity validation'],
  ['size mismatch', () => validateOutputIntegrity(png.byteLength + 1, 'image/png', pngSpec, undefined, { filename: 'flixo-result.png', bytes: png }), 'declared output size does not match artifact byte length'],
  ['mime spoof', () => validateOutputIntegrity(png.byteLength, 'application/octet-stream', pngSpec, undefined, { filename: 'flixo-result.png', bytes: png }), 'unsupported output MIME type: application/octet-stream'],
  ['extension spoof', () => validateOutputIntegrity(png.byteLength, 'image/png', pngSpec, undefined, { filename: 'flixo-result.jpg', bytes: png }), 'unsupported output extension: jpg'],
  ['unsafe artifact name', () => validateOutputIntegrity(png.byteLength, 'image/png', pngSpec, undefined, { filename: '../evil.png', bytes: png }), 'output filename must be a single safe relative filename'],
  ['corrupt signature', () => validateOutputIntegrity(png.byteLength, 'image/png', pngSpec, undefined, { filename: 'flixo-result.png', bytes: bytes(0, 1, 2, 3, 4, 5, 6, 7) }), 'output signature does not match the allowed file signatures'],
  ['oversized', () => validateOutputIntegrity(1025, 'image/png', pngSpec, undefined, { filename: 'flixo-result.png', bytes: png }), 'output exceeds the maximum size'],
  ['exact size boundary', () => {
    const boundarySpec = createSpec(pngEntry, { maxBytes: png.byteLength });
    const result = validateOutputIntegrity(png.byteLength, pngEntry.mime, boundarySpec, pngEntry.dimensions, { filename: 'flixo-result.png', bytes: png });
    assert.equal(result.valid, true, `exact output-size boundary rejected: ${result.failures.join('; ')}`);
  }, null],
  ['pixel overflow', () => validateOutputIntegrity(png.byteLength, 'image/png', pngSpec, { width: 2, height: 1 }, { filename: 'flixo-result.png', bytes: png }), 'output exceeds the maximum pixel count'],
  ['invalid dimensions', () => validateOutputIntegrity(png.byteLength, 'image/png', pngSpec, { width: 0, height: 1 }, { filename: 'flixo-result.png', bytes: png }), 'width must be a positive integer'],
  ['missing extension', () => validateOutputIntegrity(png.byteLength, 'image/png', pngSpec, undefined, { filename: 'flixo-result', bytes: png }), 'unsupported output extension: (none)'],
];

for (const [name, fn, expected] of negativeCases) {
  await runCase(name, () => {
    const result = fn();
    if (expected === null) return result;
    assert.equal(result.valid, false, `${name} artifact accepted`);
    assert.ok(result.failures.includes(expected), `${name} diagnostic missing: ${expected}`);
  });
}

await runCase('malformed JSON', () => {
  const malformedJson = text('{"ok":}');
  const result = validateOutputIntegrity(
    malformedJson.byteLength,
    'application/json',
    createSpec(matrix.find((entry) => entry.type === 'JSON')),
    undefined,
    { filename: 'flixo-result.json', bytes: malformedJson },
  );
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('output JSON content is malformed'));
});

await runCase('invalid UTF-8', () => {
  const invalidUtf8 = bytes(0xc3, 0x28);
  const result = validateOutputIntegrity(
    invalidUtf8.byteLength,
    'text/plain',
    createSpec(matrix.find((entry) => entry.type === 'Text')),
    undefined,
    { filename: 'flixo-result.txt', bytes: invalidUtf8 },
  );
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('output content is not valid UTF-8'));
});

const actualCases = results.filter((result) => result.name !== 'matrix definition');
const failed = results.filter((result) => result.status === 'FAIL');
const passed = results.filter((result) => result.status === 'PASS');
const skipped = results.filter((result) => result.status === 'SKIP');
assert.equal(skipped.length, 0, 'G3 must not silently skip cases');
assert.deepEqual([...REQUIRED_CASES].sort(), [...negativeCases.map(([name]) => name), 'malformed JSON', 'invalid UTF-8'].sort(), 'G3 negative matrix drift detected');

console.log(`G3 universal artifact integrity: executed=${results.length} passed=${passed.length} failed=${failed.length} skipped=${skipped.length}`);
for (const result of [...failed, ...skipped]) console.error(`G3 ${result.status}: ${result.name}${result.error ? ` — ${result.error}` : ''}`);
if (failed.length > 0 || skipped.length > 0 || passed.length !== results.length || actualCases.length === 0) process.exit(1);
console.log('G3 universal artifact integrity: PASS — complete matrix, no skips, no failures');
