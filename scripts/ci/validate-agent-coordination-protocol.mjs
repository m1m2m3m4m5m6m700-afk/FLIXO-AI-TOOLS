import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const expected = process.env.EXPECTED_HEAD_SHA;
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (expected && actual !== expected) {
  console.error(`Agent coordination protocol failed: checkout SHA ${actual} != expected ${expected}`);
  process.exit(1);
}

const agents = readFileSync('AGENTS.md', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const matrix = readFileSync('.github/workflows/matrix-ci-recovery.yml', 'utf8');
const matrixFirst = readFileSync('.github/workflows/matrix-first.yml', 'utf8');
const failures = [];
if (!/never claim a green release without fresh CI evidence/i.test(agents)) failures.push('AGENTS.md must preserve fresh-CI evidence governance.');
if (!/Do not resurrect deleted product tools/i.test(agents)) failures.push('AGENTS.md must preserve no-resurrection governance.');
for (const [name, source] of [['ci.yml', ci], ['matrix-ci-recovery.yml', matrix], ['matrix-first.yml', matrixFirst]]) {
  if (!/actions\/checkout@v5/u.test(source)) failures.push(`${name}: checkout action is not pinned to v5.`);
  if (!/github\.event\.pull_request\.head\.sha \|\| github\.sha/u.test(source) && name !== 'matrix-first.yml') failures.push(`${name}: PR verification must derive the head SHA, not a merge SHA.`);
}
if (/merge_commit_sha/u.test(ci + matrix + matrixFirst)) failures.push('PR verification must not substitute merge_commit_sha for exact head SHA.');
if (/continue-on-error:\s*true/u.test(ci + matrix + matrixFirst)) failures.push('agent coordination graph contains failure suppression.');
if (!/Matrix First Barrier/u.test(ci)) failures.push('canonical CI must consume Matrix First as its verification barrier.');
if (!/Image Matrix Certification/u.test(matrixFirst)) failures.push('Image Matrix certification owner is missing.');
if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Agent coordination protocol PASS for exact SHA ${actual}.`);
