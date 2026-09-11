#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const POLICY = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'ci', 'origin-policy.json'), 'utf8'));
const ci = fs.readFileSync(WORKFLOW, 'utf8');
const errors = [];

for (const [label, pattern] of [
  ['canonical workflow', /name:\s*FLIXO Test System/],
  ['verify engine', /\n\s{2}verify:\s*\n/],
  ['FAST engine', /\n\s{2}browser_fast:\s*\n/],
  ['DEEP engine', /\n\s{2}browser_deep:\s*\n/],
  ['single certification gate', /\n\s{2}certify:\s*\n/],
  ['browser matrix', /browser:\s*\[chromium, firefox, webkit\]/],
  ['exact artifact SHA', /flixo-head-sha\.txt/],
  ['exact artifact lock', /flixo-package-lock\.sha256/],
  ['DEEP localization owner', /tests\/localization-runtime\.spec\.ts/],
]) if (!pattern.test(ci)) errors.push(`${label} missing`);

const deepPullRequestGate = /github\.event_name\s*!=\s*'pull_request'/;
if (deepPullRequestGate.test(ci)) errors.push('DEEP browser execution must not be main/release only');

const fast = ci.match(/browser_fast:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
const fastSpecs = [...new Set(fast.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? [])];
if (fastSpecs.length !== 22) errors.push(`FAST unique tool specs=${fastSpecs.length}, expected 22`);
if (!ci.includes(POLICY.runtimeOrigin)) errors.push(`runtime origin ${POLICY.runtimeOrigin} missing from canonical workflow`);
if (ci.includes(POLICY.testSentinel)) errors.push(`canonical workflow contains forbidden test sentinel ${POLICY.testSentinel}`);

const workflowFiles = fs.readdirSync(path.join(ROOT, '.github', 'workflows')).filter((name) => /\.ya?ml$/i.test(name));
const nonTestAutomation = new Set([
  'claude-security-review.yml',
  'dependency-health.yml',
  'dependency-usage-classification-v2.yml',
]);
const automatedNonCanonical = [];
for (const file of workflowFiles) {
  if (file === 'ci.yml' || nonTestAutomation.has(file)) continue;
  const text = fs.readFileSync(path.join(ROOT, '.github', 'workflows', file), 'utf8');
  if (/^\s*(push|pull_request):/m.test(text)) automatedNonCanonical.push(`.github/workflows/${file}`);
}
if (automatedNonCanonical.length) errors.push(...automatedNonCanonical.map((file) => `non-canonical automated workflow: ${file}`));

const result = {
  schema_version: 8,
  authority: 'canonical-certification-surface',
  status: errors.length ? 'FAIL' : 'PASS',
  workflow: '.github/workflows/ci.yml',
  architecture: { layers: ['static+build', 'browser-fast', 'browser-deep', 'certify'], browserFast: { tools: 22, browsers: 3, units: 66 }, browserDeep: { locales: 20, browsers: 3 }, certification: 'single fail-closed certify job' },
  checks: { fastToolCount: fastSpecs.length, browsers: /browser:\s*\[chromium, firefox, webkit\]/.test(ci), deepLocalization: /tests\/localization-runtime\.spec\.ts/.test(ci), immutableArtifact: /flixo-head-sha\.txt/.test(ci) && /flixo-package-lock\.sha256/.test(ci), nonCanonicalAutomatedWorkflows: automatedNonCanonical, nonTestAutomation: [...nonTestAutomation] },
  errors,
};
fs.mkdirSync(path.join(ROOT, 'diagnostics', 'certification'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'diagnostics', 'certification', 'surface.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
