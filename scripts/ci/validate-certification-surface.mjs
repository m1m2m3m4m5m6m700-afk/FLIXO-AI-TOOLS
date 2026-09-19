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
  ['DEEP required on PR and push', /if:\s*needs\.verify\.result\s*==\s*'success'/],
  ['DEEP localization owner', /tests\/localization-runtime\.spec\.ts/],
]) if (!pattern.test(ci)) errors.push(`${label} missing`);

const fast = ci.match(/browser_fast:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
const fastSpecs = [...new Set(fast.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? [])];
if (fastSpecs.length !== 22) errors.push(`FAST unique tool specs=${fastSpecs.length}, expected 22`);
if (!ci.includes(POLICY.runtimeOrigin)) errors.push(`runtime origin ${POLICY.runtimeOrigin} missing from canonical workflow`);
if (ci.includes(POLICY.testSentinel)) errors.push(`canonical workflow contains forbidden test sentinel ${POLICY.testSentinel}`);

const workflowFiles = fs.readdirSync(path.join(ROOT, '.github', 'workflows')).filter((name) => /\.ya?ml$/i.test(name));
for (const required of ['auto-repair.yml', 'daily-flixo-green-gate.yml']) {
  if (!workflowFiles.includes(required)) errors.push(`permanent repair control missing: ${required}`);
}
const nonTestAutomation = new Set([
  'claude-security-review.yml',
  'dependency-health.yml',
  'dependency-usage-classification-v2.yml',
  'repository-security-baseline.yml',
]);
const auxiliaryEvidenceAutomation = new Set(['test-impact.yml', 'test-impact-execution.yml']);
const trustBaselineAutomation = new Set(['wp0-trust-baseline.yml']);
const repairGateAutomation = new Set(['auto-repair.yml', 'daily-flixo-green-gate.yml', 'execution-sync.yml']);
const automatedNonCanonical = [];
for (const file of workflowFiles) {
  if (file === 'ci.yml' || nonTestAutomation.has(file) || auxiliaryEvidenceAutomation.has(file) || trustBaselineAutomation.has(file) || repairGateAutomation.has(file)) continue;
  const text = fs.readFileSync(path.join(ROOT, '.github', 'workflows', file), 'utf8');
  if (/^\s*(push|pull_request):/m.test(text)) automatedNonCanonical.push(`.github/workflows/${file}`);
}

const impactWorkflow = path.join(ROOT, '.github', 'workflows', 'test-impact.yml');
if (fs.existsSync(impactWorkflow)) {
  const impactSource = fs.readFileSync(impactWorkflow, 'utf8');
  if (/npm\s+(ci|install|test|run\s+(test|build|lint|typecheck))/i.test(impactSource)) {
    errors.push('impact evidence workflow must remain planning-only and must not execute project tests/builds');
  }
  if (!/test-impact\.mjs/.test(impactSource)) {
    errors.push('impact evidence workflow must execute only the canonical test-impact planner');
  }
}

const impactExecutionWorkflow = path.join(ROOT, '.github', 'workflows', 'test-impact-execution.yml');
if (fs.existsSync(impactExecutionWorkflow)) {
  const executionSource = fs.readFileSync(impactExecutionWorkflow, 'utf8');
  for (const [label, pattern] of [
    ['execution workflow identity', /name:\s*FLIXO Test Impact Execution/],
    ['canonical impact execution', /node scripts\/ci\/test-impact\.mjs --mode=pr --base="\$BASE_SHA" --execute/],
    ['bounded concurrency', /IMPACT_MAX_CONCURRENCY:\s*['"]10['"]/],
    ['immutable execution SHA', /execution\.sha\s*!==\s*expected/],
    ['execution PASS reducer', /execution\.status\s*!==\s*'PASS'/],
    ['execution result coverage', /execution\.results\.length\s*!==\s*execution\.commands\.length/],
    ['execution evidence reducer', /node scripts\/ci\/test-evidence-reducer\.mjs/],
  ]) if (!pattern.test(executionSource)) errors.push(`impact execution invariant missing: ${label}`);
  if (/continue-on-error\s*:\s*true/i.test(executionSource)) errors.push('impact execution workflow contains continue-on-error=true');
}

if (automatedNonCanonical.length) errors.push(...automatedNonCanonical.map((file) => `non-canonical automated workflow: ${file}`));

const result = {
  schema_version: 10,
  authority: 'canonical-certification-surface',
  status: errors.length ? 'FAIL' : 'PASS',
  workflow: '.github/workflows/ci.yml',
  architecture: { layers: ['impact-plan', 'impact-execution', 'static+build', 'browser-fast', 'browser-deep', 'certify'], browserFast: { tools: 22, browsers: 3, units: 66 }, browserDeep: { locales: 20, browsers: 3 }, certification: 'single fail-closed certify job' },
  checks: { fastToolCount: fastSpecs.length, browsers: /browser:\s*\[chromium, firefox, webkit\]/.test(ci), deepLocalization: /tests\/localization-runtime\.spec\.ts/.test(ci), immutableArtifact: /flixo-head-sha\.txt/.test(ci) && /flixo-package-lock\.sha256/.test(ci), auxiliaryEvidenceAutomation: [...auxiliaryEvidenceAutomation], trustBaselineAutomation: [...trustBaselineAutomation], repairGateAutomation: [...repairGateAutomation], nonCanonicalAutomatedWorkflows: automatedNonCanonical, nonTestAutomation: [...nonTestAutomation] },
  errors,
};
fs.mkdirSync(path.join(ROOT, 'diagnostics', 'certification'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'diagnostics', 'certification', 'surface.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
