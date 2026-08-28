import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/u],
  ['Canonical Verification job', /canonical-verify:/u],
  ['canonical npm run verify', /name:\s*Canonical Verification Gate[\s\S]*?run:\s*npm run verify/u],
  ['typecheck prerequisite', /needs:\s*\[typecheck,/u],
  ['lint prerequisite', /needs:\s*\[typecheck,\s*lint,/u],
  ['build prerequisite', /needs:\s*\[typecheck,\s*lint,\s*build,/u],
  ['audit prerequisite', /needs:\s*\[typecheck,\s*lint,\s*build,\s*audit,/u],
  ['socket prerequisite', /needs:\s*\[typecheck,\s*lint,\s*build,\s*audit,\s*socket,/u],
  ['secret-scan prerequisite', /needs:\s*\[typecheck,\s*lint,\s*build,\s*audit,\s*socket,\s*secret-scan,/u],
  ['security prerequisite', /secret-scan[\s\S]*?security/u],
  ['fast-contract prerequisite', /fast-contract/u],
  ['browser-smoke prerequisite', /browser-smoke/u],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

if (!workflow.includes('run: npm run build:runtime')) {
  console.error('CI contract failed: the normal build job must use the runtime-only build.');
  process.exit(1);
}
if (!workflow.includes('VITE_SITE_URL: https://canonical.test')) {
  console.error('CI contract failed: Fast Contract Diagnostics must use the deterministic HTTPS test origin.');
  process.exit(1);
}
if (!workflow.includes('VITE_SITE_URL: ${{ vars.SITE_URL }}')) {
  console.error('CI contract failed: production gates must source VITE_SITE_URL from repository variable SITE_URL.');
  process.exit(1);
}
if (!workflow.includes('run: npm run validate:site-origin')) {
  console.error('CI contract failed: S3 production certification must validate the canonical origin explicitly.');
  process.exit(1);
}
if (workflow.includes('flexoai.vercel.app') || workflow.includes('VERCEL_PROJECT_PRODUCTION_URL')) {
  console.error('CI contract failed: deployment-specific Vercel domains must not be part of the canonical CI contract.');
  process.exit(1);
}

const canonicalSection = workflow.match(/canonical-verify:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/u)?.[0] ?? '';
if (/npm test(?![\w-])/u.test(canonicalSection)) {
  console.error('CI contract failed: Canonical Verification must not use npm test; use npm run verify.');
  process.exit(1);
}

console.log('CI contract passed: runtime build is origin-independent; production gates consume repository SITE_URL; deterministic test origin is isolated; deployment-specific Vercel domains are forbidden.');
