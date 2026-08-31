import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['CI job', /\n\s{2}ci:\n/],
  ['Fast Contract Diagnostics job', /name:\s*Fast Contract Diagnostics/],
  ['Canonical Verification Gate job', /name:\s*Canonical Verification Gate/],
  ['fast micro-check matrix', /fast-check:\s*\n[\s\S]*?matrix:\s*\n[\s\S]*?check:/],
  ['micro-check runner', /FAST_CI_CHECK:\s*\$\{\{\s*matrix\.check\s*\}\}/],
  ['micro-check evidence', /fast-check-\$\{\{\s*matrix\.check\s*\}\}-\$\{\{\s*github\.sha\s*\}\}/],
  ['fast diagnostics aggregate', /Aggregate fast diagnostics/],
  ['PR cancellation', /cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

const canonicalSection = workflow.match(/canonical-verify:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
if (/npm\s+run\s+verify(?![:\w-])/.test(canonicalSection) || /npm\s+test(?![\w-])/.test(canonicalSection)) {
  console.error('CI contract failed: Canonical Verification must aggregate fast-path evidence and must not rerun the repository-wide verification suite.');
  process.exit(1);
}

console.log('CI contract passed: micro-check matrix, evidence aggregation, exact required check names, cancellation, and no duplicate repository-wide verification are enforced.');
