import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const expected = process.env.EXPECTED_HEAD_SHA;
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (expected && expected !== actual) {
  console.error(`Agent session guard failed: ${actual} != ${expected}`);
  process.exit(1);
}

const files = ['.github/workflows/matrix-ci-recovery.yml', '.github/workflows/matrix-first.yml', '.github/workflows/full-matrix-parallel.yml'];
const failures = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  if (!/concurrency:/u.test(source)) failures.push(`${file}: concurrency isolation missing.`);
  if (!/cancel-in-progress:/u.test(source)) failures.push(`${file}: cancellation policy missing.`);
  if (!/actions\/checkout@v5/u.test(source)) failures.push(`${file}: exact checkout contract missing.`);
  if (/pull_request:[\s\S]*?ref:\s*\$\{\{\s*github\.sha\s*\}\}/u.test(source)) failures.push(`${file}: PR checkout may not fall back to merge context.`);
  if (/continue-on-error:\s*true/u.test(source)) failures.push(`${file}: session gate suppresses failures.`);
}
if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Agent session guard PASS for exact SHA ${actual}.`);
