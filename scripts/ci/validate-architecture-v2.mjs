import { readdirSync, readFileSync } from 'node:fs';
const dir = '.github/workflows';
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
const legacy = new Set(['browser-smoke.yml','phase3-chain-compatibility.yml','parallel-diagnostics.yml','root-cause-diagnostics.yml']);
const failures = [];
for (const file of files) {
  const text = readFileSync(`${dir}/${file}`, 'utf8');
  if (legacy.has(file) && /(^|\n)\s*(pull_request|push):/.test(text)) failures.push(`${file}: automatic trigger remains`);
}
const ci = readFileSync(`${dir}/ci.yml`, 'utf8');
for (const marker of ['canonical-verify:', 'fast-contract:', 'build:']) if (!ci.includes(marker)) failures.push(`ci.yml missing ${marker}`);
if (!/FAIL-CLOSED/i.test(ci)) failures.push('ci.yml missing FAIL-CLOSED marker');
if (/Skip Socket CI when no token is configured/.test(ci)) failures.push('Socket gate silently skips');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Architecture contract PASS (${files.length} workflows inspected).`);
