import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const run = () => new Promise(resolve => {
  const started = Date.now();
  const child = spawn('node', ['scripts/test-g3-artifact-integrity.mjs'], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });
  child.on('close', code => resolve({ code: code ?? 1, stdout, stderr, durationMs: Date.now() - started }));
});

const fixtureManifest = await fs.readFile('tests/fixtures/g3/manifest.json', 'utf8');
const inputHash = crypto.createHash('sha256').update(fixtureManifest).digest('hex');
const A = await run();
const B = await run();
const comparable = value => value.trim().replaceAll(/durationMs.?\d+/g, 'durationMs:<ignored>');
const result = {
  gate: 'G3-DET',
  status: A.code === B.code && comparable(A.stdout) === comparable(B.stdout),
  runs: {
    A: { result: A.code === 0 ? 'PASS' : 'FAIL', stdoutSha256: crypto.createHash('sha256').update(A.stdout).digest('hex'), durationMs: A.durationMs },
    B: { result: B.code === 0 ? 'PASS' : 'FAIL', stdoutSha256: crypto.createHash('sha256').update(B.stdout).digest('hex'), durationMs: B.durationMs },
  },
  fixtureManifestSha256: inputHash,
  compared: ['result', 'output contract', 'artifact metadata', 'hash identity where deterministic'],
  sha: process.env.EXPECTED_HEAD_SHA || process.env.GITHUB_SHA || 'unknown',
  durationMs: A.durationMs + B.durationMs,
};
result.status = result.status ? 'PASS' : 'FAIL';
result.class = result.status === 'PASS' ? null : 'DATA';
result.rootCause = result.status === 'PASS' ? null : 'NON_DETERMINISTIC_CONTRACT_EXECUTION';
result.retryable = false;
await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/determinism.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exit(1);
