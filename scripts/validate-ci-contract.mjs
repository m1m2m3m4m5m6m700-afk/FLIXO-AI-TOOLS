import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/u],
  ['unified test job', /name:\s*Test — Static \/ Build \/ Browser/u],
  ['STATIC gate', /name:\s*STATIC[\s\S]*npm run test:static/u],
  ['BUILD gate', /name:\s*BUILD[\s\S]*npm run test:build/u],
  ['BROWSER gate', /name:\s*BROWSER[\s\S]*npm run test:browser/u],
  ['cycle diagnostics', /Record repair-cycle diagnostics[\s\S]*always\(\)[\s\S]*diagnose:cycle/u],
  ['diagnostic artifact', /upload-artifact@v6[\s\S]*diagnostics\/ci\//u],
  ['fail-closed certification', /name:\s*CERTIFY[\s\S]*needs:\s*\[test\][\s\S]*needs\.test\.result/u],
];
for (const [label, pattern] of required) if (!pattern.test(workflow)) { console.error(`CI contract failed: ${label}`); process.exit(1); }
if (packageJson.scripts?.test !== 'node scripts/test.mjs --mode=certification') { console.error('CI contract failed: npm test is not the unified certification runner.'); process.exit(1); }
if (packageJson.scripts?.['diagnose:cycle'] !== 'node scripts/ci/record-repair-cycle.mjs') { console.error('CI contract failed: diagnose:cycle is not the cycle collector.'); process.exit(1); }
if (!/cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}/u.test(workflow)) { console.error('CI contract failed: PR cancellation is missing.'); process.exit(1); }
console.log('CI contract passed: one unified runner, three gates, cycle diagnostics, artifact evidence, and fail-closed certification.');
