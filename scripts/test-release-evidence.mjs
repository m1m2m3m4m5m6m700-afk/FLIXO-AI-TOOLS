import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const temp = await mkdtemp(join(tmpdir(), 'flixo-release-evidence-'));
const goodPath = join(temp, 'good.json');
const badPath = join(temp, 'bad.json');

const good = {
  schemaVersion: 1,
  commitSha: 'a'.repeat(40),
  verification: { state: 'passed', canonicalGate: 'passed', requiredChecks: 'passed' },
  deployment: { state: 'blocked', provider: 'vercel' },
  runtime: { state: 'unknown' }
};

const bad = structuredClone(good);
bad.commitSha = 'not-a-sha';

await writeFile(goodPath, JSON.stringify(good));
await writeFile(badPath, JSON.stringify(bad));

const run = (path) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/validate-release-evidence.mjs', path], { stdio: 'pipe' });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (code) => resolve({ code, stdout, stderr }));
});

const goodResult = await run(goodPath);
if (goodResult.code !== 0) throw new Error(`valid evidence rejected: ${goodResult.stderr || goodResult.stdout}`);

const badResult = await run(badPath);
if (badResult.code === 0) throw new Error('invalid evidence was accepted');

await rm(temp, { recursive: true, force: true });
console.log('FLIXO release evidence tests: PASS');
