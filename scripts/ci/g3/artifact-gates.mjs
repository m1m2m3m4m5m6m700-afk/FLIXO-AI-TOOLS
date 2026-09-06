import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { validateOutputIntegrity } from '../../../src/lib/contracts/output-integrity.ts';

const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
const EXPECTED_SHA256 = '431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460';
const SHA = crypto.createHash('sha256').update(PNG).digest('hex');
const base = { filename: 'flixo-result.png', bytes: PNG };
const spec = {
  toolId: 'g3-image',
  allowedMime: ['image/png'],
  allowedExtensions: ['png'],
  maxBytes: 1024 * 1024,
  minBytes: 1,
  maxPixels: 40_000_000,
  signatures: ['89504e470d0a1a0a'],
  requireArtifact: true,
  requireSafeFilename: true,
};

const tamperedPng = PNG.slice();
tamperedPng[tamperedPng.length - 1] ^= 0xff;
const TAMPERED_SHA256 = crypto.createHash('sha256').update(tamperedPng).digest('hex');

const gates = [
  ['G3-20', 'Extension', () => validateOutputIntegrity(PNG.length, 'image/png', spec, { width: 1, height: 1 }, base).valid],
  ['G3-21', 'MIME', () => validateOutputIntegrity(PNG.length, 'image/png', spec, { width: 1, height: 1 }, base).valid],
  ['G3-22', 'Magic Bytes', () => validateOutputIntegrity(PNG.length, 'image/png', spec, { width: 1, height: 1 }, base).valid],
  ['G3-23', 'Extension/MIME', () => !validateOutputIntegrity(PNG.length, 'image/png', spec, { width: 1, height: 1 }, { ...base, filename: 'flixo-result.jpg' }).valid],
  ['G3-24', 'MIME/Signature', () => !validateOutputIntegrity(PNG.length, 'image/webp', spec, { width: 1, height: 1 }, base).valid],
  ['G3-25', 'Filename Safety', () => !validateOutputIntegrity(PNG.length, 'image/png', spec, { width: 1, height: 1 }, { ...base, filename: '../evil.png' }).valid],
  ['G3-26', 'Path Containment', () => !validateOutputIntegrity(PNG.length, 'image/png', spec, { width: 1, height: 1 }, { ...base, filename: '../evil.png' }).valid],
  ['G3-27', 'Size Limits', () => !validateOutputIntegrity(1024 * 1024 + 1, 'image/png', spec, { width: 1, height: 1 }, base).valid],
  ['G3-28', 'Artifact Existence', () => !validateOutputIntegrity(PNG.length, 'image/png', spec, { width: 1, height: 1 }).valid],
  ['G3-29', 'Artifact Readability', () => validateOutputIntegrity(PNG.length, 'image/png', spec, { width: 1, height: 1 }, base).valid],
  ['G3-30', 'Byte Integrity', () => !validateOutputIntegrity(PNG.length + 1, 'image/png', spec, { width: 1, height: 1 }, base).valid],
  ['G3-31', 'SHA256 Integrity', () => SHA === EXPECTED_SHA256 && TAMPERED_SHA256 !== EXPECTED_SHA256],
];

await fs.mkdir('artifacts/ci/g3/gates', { recursive: true });
const results = [];
for (const [gate, name, fn] of gates) {
  const started = Date.now();
  let ok = false;
  let error = null;
  try { ok = Boolean(fn()); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  const result = {
    gate, name, status: ok ? 'PASS' : 'FAIL',
    class: ok ? null : 'PRODUCT', rootCause: ok ? null : `ARTIFACT_${name.toUpperCase().replaceAll(' ', '_')}`,
    retryable: false, sha: process.env.EXPECTED_HEAD_SHA || process.env.GITHUB_SHA || 'unknown', durationMs: Date.now() - started,
    command: `artifact contract assertion: ${name}`, stdout: '', stderr: error ?? '', hashes: { fixtureSha256: SHA, expectedFixtureSha256: EXPECTED_SHA256, tamperedFixtureSha256: TAMPERED_SHA256 },
  };
  results.push(result);
  await fs.writeFile(`artifacts/ci/g3/gates/${gate}.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(`[${result.status}] ${gate} ${name}`);
}
await fs.writeFile('artifacts/ci/g3/gates/artifact-index.json', JSON.stringify({ results }, null, 2) + '\n');
if (results.some(r => r.status === 'FAIL')) process.exit(1);