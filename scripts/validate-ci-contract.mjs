import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/u],
  ['unified test job', /name:\s*Test — Static \/ Build \/ Browser/u],
  ['exact SHA checkout', /name:\s*Checkout exact SHA[\s\S]*ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/u],
  ['exact SHA verification', /name:\s*Verify exact SHA[\s\S]*git rev-parse HEAD[\s\S]*EXPECTED_SHA/u],
  ['dependency bootstrap', /name:\s*Install committed dependency graph[\s\S]*npm ci/u],
  ['playwright browser bootstrap', /name:\s*Install Playwright browsers[\s\S]*chromium firefox webkit/u],
  ['unified diagnostic runner', /name:\s*Unified diagnostic runner[\s\S]*npm run test:diagnose/u],
  ['technical debt audit', /name:\s*Technical-debt classification audit[\s\S]*npm run audit:technical-debt/u],
  ['diagnostic artifact', /upload-artifact@v6[\s\S]*diagnostics\/ci\//u],
  ['fail-closed certification', /name:\s*CERTIFY[\s\S]*needs:\s*\[test\][\s\S]*needs\.test\.result/u],
  ['authoritative evidence', /completeness\.authoritative\s*==\s*true/u],
];
for (const [label, pattern] of required) if (!pattern.test(workflow)) { console.error(`CI contract failed: ${label}`); process.exit(1); }
if (packageJson.scripts?.test !== 'node scripts/test.mjs --mode=certification') { console.error('CI contract failed: npm test is not the unified certification runner.'); process.exit(1); }
if (packageJson.scripts?.['diagnose:cycle'] !== 'node scripts/ci/record-repair-cycle.mjs') { console.error('CI contract failed: diagnose:cycle is not the cycle collector.'); process.exit(1); }
if (packageJson.scripts?.['test:diagnose'] !== 'node scripts/test.mjs --mode=diagnose') { console.error('CI contract failed: test:diagnose is not the unified diagnostic runner.'); process.exit(1); }
if (!/cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}/u.test(workflow)) { console.error('CI contract failed: PR cancellation is missing.'); process.exit(1); }
if (/full-matrix-parallel|Matrix First Certification|failure-memory\.json/u.test(workflow)) { console.error('CI contract failed: retired CI infrastructure reference remains.'); process.exit(1); }
console.log('CI contract passed: exact-SHA bootstrap, one unified diagnostic runner, authoritative evidence, technical-debt audit, and fail-closed certification.');
