import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const gateDefinitions = [
  ['G3-10', 'Dependencies', ['npm', 'ci', '--prefer-offline', '--no-audit', '--no-fund']],
  ['G3-11', 'TypeScript', ['npx', 'tsc', '--noEmit', '--pretty', 'false']],
  ['G3-12', 'ESLint', ['npm', 'run', 'lint']],
  ['G3-13', 'Build', ['npm', 'run', 'build']],
  ['G3-14', 'Build Identity', ['git', 'rev-parse', 'HEAD']],
  ['G3-20', 'Extension', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=extension']],
  ['G3-21', 'MIME', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=mime']],
  ['G3-22', 'Magic Bytes', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=signature']],
  ['G3-23', 'Extension/MIME', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=extension-mime']],
  ['G3-24', 'MIME/Signature', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=mime-signature']],
  ['G3-25', 'Filename Safety', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=filename']],
  ['G3-26', 'Path Containment', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=containment']],
  ['G3-27', 'Size Limits', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=size']],
  ['G3-28', 'Artifact Existence', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=existence']],
  ['G3-29', 'Artifact Readability', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=readability']],
  ['G3-30', 'Byte Integrity', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=bytes']],
  ['G3-31', 'SHA256 Integrity', ['node', 'scripts/test-g3-artifact-integrity.mjs', '--gate=sha256']],
];

const classify = (code, stderr) => {
  if (code === 0) return { class: null, rootCause: null };
  const text = `${stderr}`.toLowerCase();
  if (text.includes('enoent') || text.includes('command not found')) return { class: 'DEPENDENCY', rootCause: 'TOOLCHAIN_DEPENDENCY' };
  if (text.includes('permission') || text.includes('runner')) return { class: 'INFRA', rootCause: 'RUNNER_INFRASTRUCTURE' };
  return { class: 'PRODUCT', rootCause: 'GATE_UNDER_TEST' };
};

const run = ([command, ...args]) => new Promise((resolve) => {
  const started = Date.now();
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', error => resolve({ code: 1, stdout, stderr: `${stderr}${error.message}`, durationMs: Date.now() - started }));
  child.on('close', code => resolve({ code: code ?? 1, stdout, stderr, durationMs: Date.now() - started }));
});

await fs.mkdir('artifacts/ci/g3/gates', { recursive: true });
const results = [];

for (const [gate, name, command] of gateDefinitions) {
  const r = await run(command);
  const classification = classify(r.code, r.stderr);
  const result = {
    gate,
    name,
    status: r.code === 0 ? 'PASS' : 'FAIL',
    class: classification.class,
    rootCause: classification.rootCause,
    retryable: classification.class === 'INFRA' || classification.class === 'CI',
    sha: process.env.EXPECTED_HEAD_SHA || process.env.GITHUB_SHA || 'unknown',
    durationMs: r.durationMs,
    command: command.join(' '),
    stdout: r.stdout,
    stderr: r.stderr,
  };
  results.push(result);
  await fs.writeFile(`artifacts/ci/g3/gates/${gate}.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(`[${result.status}] ${gate} ${name}`);
}

const failed = results.filter(r => r.status === 'FAIL');
await fs.writeFile('artifacts/ci/g3/gates/index.json', JSON.stringify({ gateCount: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2) + '\n');
process.exit(failed.length ? 1 : 0);
