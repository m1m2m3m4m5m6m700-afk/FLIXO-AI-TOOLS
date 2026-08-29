import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const temp = await mkdtemp(join(tmpdir(), 'flixo-performance-budget-'));

const run = (budgetPath) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/validate-performance-budget-contract.mjs'], {
    stdio: 'pipe',
    env: { ...process.env, FLIXO_PERFORMANCE_BUDGET: budgetPath },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (code) => resolve({ code, stdout, stderr }));
});

try {
  const goodPath = join(temp, 'good.json');
  const relaxedPath = join(temp, 'relaxed.json');
  const malformedPath = join(temp, 'malformed.json');

  const good = {
    criticalJavascriptBytes: 921600,
    javascriptBytes: 3145728,
    cssBytes: 1048576,
    totalAssetBytes: 5242880,
    notes: 'valid release performance budget',
  };
  const relaxed = { ...good, totalAssetBytes: 5242881 };
  const malformed = { ...good, javascriptBytes: 0 };

  await writeFile(goodPath, JSON.stringify(good));
  await writeFile(relaxedPath, JSON.stringify(relaxed));
  await writeFile(malformedPath, JSON.stringify(malformed));

  const goodResult = await run(goodPath);
  if (goodResult.code !== 0) throw new Error(`valid budget rejected: ${goodResult.stderr || goodResult.stdout}`);

  const relaxedResult = await run(relaxedPath);
  if (relaxedResult.code === 0) throw new Error('budget above release ceiling was accepted');

  const malformedResult = await run(malformedPath);
  if (malformedResult.code === 0) throw new Error('non-positive budget was accepted');

  console.log('FLIXO performance budget contract tests: PASS');
} finally {
  await rm(temp, { recursive: true, force: true });
}
