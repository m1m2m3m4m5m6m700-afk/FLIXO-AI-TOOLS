import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const workflowDir = '.github/workflows';
const workflowFiles = readdirSync(workflowDir).filter((file) => /\.(ya?ml)$/.test(file)).sort();
const workflowTexts = workflowFiles.map((file) => ({
  file,
  text: readFileSync(`${workflowDir}/${file}`, 'utf8'),
}));

const workflowSource = readFileSync('.github/workflows/ci.yml', 'utf8');
const wp0Workflow = readFileSync('.github/workflows/wp0-trust-baseline.yml', 'utf8');
const impactExecutionWorkflow = readFileSync('.github/workflows/test-impact-execution.yml', 'utf8');
const securityBaselineWorkflow = readFileSync('.github/workflows/repository-security-baseline.yml', 'utf8');
const greenGateWorkflow = readFileSync('.github/workflows/daily-flixo-green-gate.yml', 'utf8');
const workflow = workflowSource.replace(/\\"/g, '"');
const testEngine = readFileSync('scripts/test.mjs', 'utf8');
const certifyEngine = readFileSync('scripts/ci/certify.mjs', 'utf8');
const certifyCore = readFileSync('scripts/ci/certify-core.mjs', 'utf8');
const resultState = readFileSync('scripts/ci/result-state.mjs', 'utf8');

const required = [
  ['pull_request trigger', /pull_request:\s*\n\s*branches:\s*\[main\]/],
  ['push trigger', /push:\s*\n\s*branches:\s*\[main\]/],
  ['single static-build engine', /\n\s{2}verify:\s*\n/],
  ['Browser FAST engine', /\n\s{2}browser_fast:\s*\n/],
  ['Browser DEEP engine', /\n\s{2}browser_deep:\s*\n/],
  ['single certification gate', /\n\s{2}certify:\s*\n/],
  ['superseding exact-head CI', /cancel-in-progress:\s*true/],
  ['superseding PR/branch concurrency isolation', /group:\s*flixo-test-\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.event\.pull_request\.number\s*\|\|\s*github\.ref\s*\}\}/],
  ['exact SHA', /EXPECTED_SHA/],
  ['immutable artifact identity', /flixo-head-sha\.txt[\s\S]*flixo-package-lock\.sha256/],
  ['minimal checkout', /fetch-depth:\s*1/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(workflow)) {
    console.error(`CI contract failed: ${label} is missing from .github/workflows/ci.yml`);
    process.exit(1);
  }
}

const executionPushDuplicate = /push:\s*\n\s*branches:\s*\[execution\]/;
for (const [label, source] of [
  ['ci.yml', workflow],
  ['wp0-trust-baseline.yml', wp0Workflow],
  ['test-impact-execution.yml', impactExecutionWorkflow],
  ['repository-security-baseline.yml', securityBaselineWorkflow],
]) {
  if (executionPushDuplicate.test(source)) {
    console.error(`CI contract failed: ${label} must not duplicate pull_request verification with an execution-branch push trigger.`);
    process.exit(1);
  }
}

const supersedableVerificationWorkflows = [
  ['ci.yml', workflow],
  ['wp0-trust-baseline.yml', wp0Workflow],
  ['test-impact-execution.yml', impactExecutionWorkflow],
  ['repository-security-baseline.yml', securityBaselineWorkflow],
];

for (const [file, source] of supersedableVerificationWorkflows) {
  if (!/cancel-in-progress:\s*true/.test(source)) {
    console.error('CI contract failed: ' + file + ' must cancel superseded verification runs.');
    process.exit(1);
  }
  if (!/github\.event\.pull_request\.number\s*\|\|\s*github\.ref/.test(source)) {
    console.error('CI contract failed: ' + file + ' must isolate concurrency by PR number or branch ref.');
    process.exit(1);
  }
}

for (const [file, source] of [
  ['auto-repair.yml', readFileSync('.github/workflows/auto-repair.yml', 'utf8')],
  ['execution-sync.yml', readFileSync('.github/workflows/execution-sync.yml', 'utf8')],
]) {
  if (!/cancel-in-progress:\s*false/.test(source)) {
    console.error('CI contract failed: ' + file + ' must remain non-canceling because it carries repair state.');
    process.exit(1);
  }
}
if (!/cancel-in-progress:\s*true/.test(greenGateWorkflow) ||
    !/group:\s*flixo-continuous-error-watch-\$\{\{\s*github\.event\.workflow_run\.head_branch\s*\|\|\s*github\.ref\s*\}\}/.test(greenGateWorkflow)) {
  console.error('CI contract failed: daily green gate must supersede duplicate watcher runs by branch.');
  process.exit(1);
}

const evidenceClassPresent = workflow.includes('evidenceClass') && workflow.includes('PRIMARY_EXECUTION');

const evidenceCaptureSwallowsFailure = greenGateWorkflow
  .split(/\r?\n/u)
  .some((line) => /gh run view.*--log-failed.*\|\|\s*true/u.test(line));
if (evidenceCaptureSwallowsFailure) {
  console.error('CI contract failed: evidence capture must not swallow gh run view failures.');
  process.exit(1);
}
for (const marker of ['EVIDENCE_CAPTURE=AVAILABLE', 'EVIDENCE_CAPTURE=FAILED']) {
  if (!greenGateWorkflow.includes(marker)) {
    console.error(`CI contract failed: daily green gate evidence marker ${marker} is missing.`);
    process.exit(1);
  }
}
if (!evidenceClassPresent) {
  console.error('CI contract failed: PRIMARY_EXECUTION evidence class is missing from .github/workflows/ci.yml');
  process.exit(1);
}

const certificationEngineOwners = workflowTexts.filter(({ text }) =>
  text.includes('node scripts/ci/certification-engine.mjs'),
);
if (
  certificationEngineOwners.length !== 1 ||
  certificationEngineOwners[0].file !== 'ci.yml'
) {
  console.error(
    `CI contract failed: canonical certification engine must have exactly one workflow owner (ci.yml); owners=${certificationEngineOwners.map(({ file }) => file).join(',') || 'none'}`,
  );
  process.exit(1);
}

const certificationJobOwners = workflowTexts.filter(({ text }) =>
  /^\s{4}name:\s*Certification\s*$/m.test(text),
);
if (
  certificationJobOwners.length !== 1 ||
  certificationJobOwners[0].file !== 'ci.yml'
) {
  console.error(
    `CI contract failed: canonical Certification job must have exactly one workflow owner (ci.yml); owners=${certificationJobOwners.map(({ file }) => file).join(',') || 'none'}`,
  );
  process.exit(1);
}

for (const job of ['verify', 'browser_fast', 'browser_deep', 'certify']) {
  const owners = workflowTexts.filter(({ text }) => new RegExp(`^  ${job}:\\s*$`, 'm').test(text));
  if (owners.length !== 1 || owners[0].file !== 'ci.yml') {
    console.error(
      `CI contract failed: canonical job ${job} must have exactly one workflow owner (ci.yml); owners=${owners.map(({ file }) => file).join(',') || 'none'}`,
    );
    process.exit(1);
  }
}

for (const [label, source, pattern] of [
  ['central result-state reducer', testEngine, /result-state\.mjs/],
  ['central result-state reducer import in certification core', certifyCore, /result-state\.mjs/],
  ['certification wrapper delegates to canonical core', certifyEngine, /certify-core\.mjs/],
  ['explicit cancellation state', resultState, /['"]CANCELLED['"]/],
  ['explicit missing-evidence state', resultState, /['"]MISSING_EVIDENCE['"]/],
  ['explicit malformed-evidence state', resultState, /['"]MALFORMED_EVIDENCE['"]/],
  ['fail-closed state reduction', resultState, /counts\.CANCELLED === 0[\s\S]*counts\.NOT_EXECUTED === 0/],
]) {
  if (!pattern.test(source)) {
    console.error(`CI contract failed: ${label} is missing.`);
    process.exit(1);
  }
}

if (!/browser:\s*\[chromium, firefox, webkit\]/.test(workflow)) {
  console.error('CI contract failed: browser engine must own Chromium, Firefox and WebKit.');
  process.exit(1);
}

const fast = workflow.match(/browser_fast:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
const deep = workflow.match(/browser_deep:[\s\S]*?(?=\n\s{2}[A-Za-z0-9_-]+:\n|$)/)?.[0] ?? '';
const fastSpecs = [...new Set(fast.match(/tests\/[A-Za-z0-9_-]+\.spec\.ts/g) ?? [])];
if (fastSpecs.length !== 22) {
  console.error(`CI contract failed: FAST browser ownership must contain exactly 22 unique canonical tool specs; found ${fastSpecs.length}.`);
  process.exit(1);
}
if (!/tests\/localization-runtime\.spec\.ts/.test(deep)) {
  console.error('CI contract failed: DEEP browser ownership must retain localization runtime coverage.');
  process.exit(1);
}
if (!/if:\s*needs\.verify\.result\s*==\s*'success'/.test(deep)) {
  console.error('CI contract failed: DEEP browser execution must require successful static/build verification.');
  process.exit(1);
}
if (/github\.event_name\s*!=\s*'pull_request'/.test(deep)) {
  console.error('CI contract failed: DEEP browser execution must not exclude pull_request events.');
  process.exit(1);
}

try {
  execFileSync(process.execPath, ['scripts/ci/test-execution-graph-semantic-identity.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/ci/test-image-core-foundation.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/ci/validate-playwright-surface.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/ci/validate-certification-surface.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/ci/validate-agent-protocol.mjs'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/ci/validate-agent-coordination.mjs'], { stdio: 'inherit' });
} catch {
  console.error('CI contract failed: execution-graph semantic identity/image-core/browser/certification/agent-protocol/coordination surface validation failed.');
  process.exit(1);
}

console.log(
  `CI contract passed: one execution graph, centralized result-state reduction, explicit evidence provenance, canonical DEEP semantic identity, shared image-core foundation, minimal SHA checkout, one FAST engine, one DEEP engine, PR+push DEEP coverage, one fail-closed certification gate, single workflow certification authority across ${workflowFiles.length} workflow definitions, and mandatory multi-agent coordination protocol.`,
);
