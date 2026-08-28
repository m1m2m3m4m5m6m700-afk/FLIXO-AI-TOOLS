import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const lighthouseWorkflow = readFileSync('.github/workflows/lighthouse.yml', 'utf8');
const diagnosticsWorkflow = readFileSync('.github/workflows/root-cause-diagnostics.yml', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['Canonical Verification job', /canonical-verify:/],
  ['canonical npm run verify', /name:\s*Canonical Verification Gate[\s\S]*?run:\s*npm run verify/],
  ['typecheck prerequisite', /needs:\s*\[typecheck,/],
  ['lint prerequisite', /needs:\s*\[typecheck, lint,/],
  ['build prerequisite', /needs:\s*\[typecheck, lint, build,/],
  ['audit prerequisite', /needs:\s*\[typecheck, lint, build, audit,/],
  ['socket prerequisite', /needs:\s*\[typecheck, lint, build, audit, socket,/],
  ['secret-scan prerequisite', /needs:\s*\[typecheck, lint, build, audit, socket, secret-scan,/],
  ['security prerequisite', /secret-scan[\s\S]*?security/],
  ['fast-contract prerequisite', /fast-contract/],
  ['browser-smoke prerequisite', /browser-smoke/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

const canonicalAssignments = [...workflow.matchAll(/^\s*VITE_SITE_URL:\s*(.+?)\s*$/gm)].map((match) => match[1]);
if (canonicalAssignments.length !== 1 || canonicalAssignments[0] !== '${{ vars.SITE_URL }}') {
  console.error('CI contract failed: the workflow-level VITE_SITE_URL contract must source repository variable SITE_URL.');
  process.exit(1);
}

// Runtime diagnostics and Lighthouse deliberately do not require the future
// production domain. A production SEO build is the only CI consumer that may
// require SITE_URL, and it is explicitly gated by vars.SITE_URL.
if (!/production-seo:[\s\S]*?if:\s*\$\{\{\s*vars\.SITE_URL\s*!=\s*''\s*\}\}/.test(workflow)) {
  console.error('CI contract failed: Production SEO build must be explicitly gated by the presence of SITE_URL.');
  process.exit(1);
}

if (/^\s*VITE_SITE_URL:\s*https?:\/\//m.test(lighthouseWorkflow) || /^\s*VITE_SITE_URL:\s*https?:\/\//m.test(diagnosticsWorkflow)) {
  console.error('CI contract failed: runtime diagnostics must not hardcode a canonical origin.');
  process.exit(1);
}

const allWorkflowText = `${workflow}\n${lighthouseWorkflow}\n${diagnosticsWorkflow}`;
if (/https?:\/\/[^\s]+\.vercel\.app/.test(allWorkflowText)) {
  console.error('CI contract failed: deployment/preview Vercel origins must never be hardcoded into workflows.');
  process.exit(1);
}

const canonicalSection = workflow.match(/canonical-verify:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
if (/npm test(?![\w-])/.test(canonicalSection)) {
  console.error('CI contract failed: Canonical Verification must not use npm test; use npm run verify.');
  process.exit(1);
}

if (!/LIGHTHOUSE_BASE_URL:\s*http:\/\/127\.0\.0\.1:3000/.test(lighthouseWorkflow)) {
  console.error('CI contract failed: Lighthouse must use a separate local probe origin.');
  process.exit(1);
}

if (/VITE_SITE_URL:\s*http:\/\/127\.0\.0\.1:3000/.test(lighthouseWorkflow)) {
  console.error('CI contract failed: VITE_SITE_URL must never be the local Lighthouse probe origin.');
  process.exit(1);
}

if (!/generate-lighthouse-matrix\.mjs/.test(lighthouseWorkflow) || !/fromJSON\(needs\.discover\.outputs\.matrix\)/.test(lighthouseWorkflow)) {
  console.error('CI contract failed: Lighthouse matrix must be generated from the repository manifest, not hand-listed routes.');
  process.exit(1);
}

if (!/build:runtime/.test(lighthouseWorkflow) || !/build:runtime/.test(diagnosticsWorkflow)) {
  console.error('CI contract failed: runtime browser/diagnostic builds must use build:runtime.');
  process.exit(1);
}

console.log('CI contract passed: runtime CI is origin-independent; production SEO is explicitly SITE_URL-gated; Vercel deployment origins are not canonical; Lighthouse is manifest-derived and uses an isolated local probe.');
