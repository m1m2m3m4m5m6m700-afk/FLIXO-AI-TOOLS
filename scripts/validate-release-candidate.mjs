import { readFileSync } from 'node:fs';

const packageSource = readFileSync('package.json', 'utf8');
const workflowSource = readFileSync('.github/workflows/ci.yml', 'utf8');

const requiredScripts = [
  'verify',
  'test:e2e',
  'audit:production',
  'validate:performance-budget',
  'validate:ci-contract',
];

for (const script of requiredScripts) {
  const pattern = new RegExp(`"${script}"\\s*:`);
  if (!pattern.test(packageSource)) throw new Error(`Required release script is missing: ${script}`);
}

const requiredWorkflowMarkers = [
  'pull_request:',
  'name: Canonical Verification Gate',
  'name: Fast Contract Diagnostics',
  'name: Browser Smoke —',
  'npm run verify',
  'github/codeql-action/analyze@v4',
];

for (const marker of requiredWorkflowMarkers) {
  if (!workflowSource.includes(marker)) throw new Error(`Release CI marker is missing: ${marker}`);
}

const forbiddenPatterns = [
  /npm test(?!:)/,
];
for (const pattern of forbiddenPatterns) {
  if (pattern.test(workflowSource)) throw new Error(`Forbidden CI command detected: ${pattern}`);
}

console.log('Release Candidate audit contract passed: canonical verify, E2E, production audit, performance budget, CI contract, Browser Smoke, and CodeQL markers are present.');
