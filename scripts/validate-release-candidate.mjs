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
  if (!new RegExp(`"${script}"\\s*:`).test(packageSource)) {
    throw new Error(`Required release script is missing: ${script}`);
  }
}

const requiredWorkflowMarkers = [
  'pull_request:',
  'name: Canonical Verification Gate',
  'name: Fast Contract Diagnostics',
  'name: Browser Smoke',
  'npm run verify',
  'github/codeql-action/analyze@v4',
];

for (const marker of requiredWorkflowMarkers) {
  if (!workflowSource.includes(marker)) {
    throw new Error(`Release CI marker is missing: ${marker}`);
  }
}

if (/npm test(?!:)/.test(workflowSource)) {
  throw new Error('Forbidden CI command detected: npm test');
}

console.log('Release Candidate audit contract passed.');
