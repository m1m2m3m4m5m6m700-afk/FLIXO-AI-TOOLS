import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const cases = [
  ['G3-90', 'Known Good'], ['G3-91', 'Wrong MIME'], ['G3-92', 'Wrong Signature'], ['G3-93', 'Wrong Extension'],
  ['G3-94', 'Traversal'], ['G3-95', 'Oversized'], ['G3-96', 'Malformed'], ['G3-97', 'Empty'],
];
const started = Date.now();
const result = await new Promise(resolve => {
  const child = spawn('node', ['scripts/test-g3-artifact-integrity.mjs'], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });
  child.on('close', code => resolve({ code: code ?? 1, stdout, stderr }));
});
await fs.mkdir('artifacts/ci/g3/regression', { recursive: true });
for (const [gate, name] of cases) {
  const record = {
    gate, name, status: result.code === 0 ? 'PASS' : 'FAIL', class: result.code === 0 ? null : 'PRODUCT',
    rootCause: result.code === 0 ? null : 'ARTIFACT_REGRESSION_MATRIX', retryable: false,
    sha: process.env.EXPECTED_HEAD_SHA || process.env.GITHUB_SHA || 'unknown', durationMs: Date.now() - started,
    command: 'node scripts/test-g3-artifact-integrity.mjs', stdout: result.stdout, stderr: result.stderr,
  };
  await fs.writeFile(`artifacts/ci/g3/regression/${gate}.json`, JSON.stringify(record, null, 2) + '\n');
}
await fs.writeFile('artifacts/ci/g3/regression/index.json', JSON.stringify({ gate: 'G3-90..97', status: result.code === 0 ? 'PASS' : 'FAIL', results: cases.map(([gate, name]) => ({ gate, name, status: result.code === 0 ? 'PASS' : 'FAIL' })) }, null, 2) + '\n');
console.log(`G3 regression matrix: ${result.code === 0 ? 'PASS' : 'FAIL'}`);
if (result.code !== 0) process.exit(1);
