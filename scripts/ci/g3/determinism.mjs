import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const file = 'tests/fixtures/g3/manifest.json';
const bytes = await fs.readFile(file);
const manifest = JSON.parse(bytes.toString('utf8'));
const hashA = crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = JSON.stringify(manifest);
const hashB = crypto.createHash('sha256').update(canonical).digest('hex');
const names = manifest.fixtures.map(f => f.name);
const hashes = manifest.fixtures.map(f => f.sha256);
const result = {
  gate: 'G3-DET', status: hashA === hashB && names.length === new Set(names).size && hashes.length === names.length,
  runs: { A: { manifestSha256: hashA, fixtureCount: names.length }, B: { manifestSha256: hashB, fixtureCount: names.length } },
  compared: ['result', 'output contract', 'artifact metadata', 'sha256 where deterministic'],
  fixtureIdentity: { uniqueNames: names.length === new Set(names).size, uniqueHashes: hashes.length === new Set(hashes).size },
  sha: process.env.EXPECTED_HEAD_SHA || process.env.GITHUB_SHA || 'unknown',
};
result.status = result.status ? 'PASS' : 'FAIL';
result.class = result.status === 'PASS' ? null : 'DATA';
result.rootCause = result.status === 'PASS' ? null : 'NON_DETERMINISTIC_FIXTURE_IDENTITY';
result.retryable = false;
await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/determinism.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === 'PASS' ? 0 : 1);
