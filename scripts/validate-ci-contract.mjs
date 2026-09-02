import { readFileSync } from 'node:fs';

const executiveWorkflow = readFileSync('.github/workflows/ci-executive.yml', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['18 executive paths', /ci-001:[\s\S]*ci-018:/],
  ['Executive aggregator', /name:\s*Aggregation — Executive Error Report/],
  ['artifact aggregation', /actions\/download-artifact@v5/],
  ['always-run aggregator', /aggregator:[\s\S]*?if:\s*always\(\)/],
  ['Executive error report', /scripts\/collect-errors\.mjs/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(executiveWorkflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci-executive.yml`);
    process.exit(1);
  }
}

if (executiveWorkflow.includes('merge-multiple: true')) {
  console.error('CI contract failed: executive artifacts must retain per-job directories for aggregation.');
  process.exit(1);
}

const jobs = [...executiveWorkflow.matchAll(/^\s{2}ci-(\d{3}):$/gm)].map((match) => match[1]);
const expected = Array.from({ length: 18 }, (_, index) => String(index + 1).padStart(3, '0'));
if (jobs.length !== expected.length || jobs.some((job, index) => job !== expected[index])) {
  console.error('CI contract failed: Executive CI paths must be exactly CI-001..CI-018.');
  process.exit(1);
}

console.log('CI contract passed: Executive Contract owns the 18-path PR verification surface and authoritative aggregation.');
