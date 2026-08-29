import { readdirSync, readFileSync } from 'node:fs';

const workflowDir = '.github/workflows';
const workflows = readdirSync(workflowDir).filter((file) => /\.(ya?ml)$/.test(file));
const text = workflows.map((file) => ({ file, text: readFileSync(`${workflowDir}/${file}`, 'utf8') }));
const failures = [];
const deprecated = new Set([
  'browser-smoke.yml',
  'phase3-chain-compatibility.yml',
  'parallel-diagnostics.yml',
  'root-cause-diagnostics.yml'
]);
for (const item of text) {
  if (deprecated.has(item.file) && /(^|\n)\s*(pull_request|push):/.test(item.text)) {
    failures.push(`${item.file} still has automatic PR/push execution; diagnostics/legacy workflow must be manual-only.`);
  }
}
const ci = text.find((x) => x.file === 'ci.yml')?.text ?? '';
for (const token of ['canonical-verify:', 'fast-contract:', 'build:']) {
  if (!ci.includes(token)) failures.push(`ci.yml missing canonical owner: ${token}`);
}
if (/npm run build(?!:runtime)/.test(ci) && !/Build Once/i.test(ci)) {
  failures.push('ci.yml build owner is not explicitly marked Build Once.');
}
if (/continue-on-error:\s*true[\s\S]{0,800}result.*success/i.test(ci)) {
  failures.push('Blocking CI must not convert failed evidence into success.');
}
if (!/FAIL-CLOSED/i.test(ci)) failures.push('ci.yml must declare the fail-closed architecture contract.');
console.log(failures.length ? failures.map((x) => `FAIL: ${x}`).join('\n') : `CI architecture contract passed: ${workflows.length} workflow definitions inspected.`);
if (failures.length) process.exit(1);
