#!/usr/bin/env node
import { REPAIR_GATE_AUTOMATION } from './control-plane-registry.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const AUTO_REPAIR = path.join(ROOT, '.github', 'workflows', 'auto-repair.yml');
const DAILY_GATE = path.join(ROOT, '.github', 'workflows', 'daily-flixo-green-gate.yml');
const HANDOFF_GATE = path.join(ROOT, '.github', 'workflows', 'agent-repair-handoff-gate.yml');
const WATCHDOG = path.join(ROOT, '.github', 'workflows', 'execution-bot-watchdog.yml');
const MERGE_GATE = path.join(ROOT, '.github', 'workflows', 'auto-repair-merge-gate.yml');
const MAX_CHANGED_FILES = 12;
const MAX_CHANGED_LINES = 300;
const MUTATION_WORKFLOWS = Object.freeze(['auto-repair.yml','execution-sync.yml','historical-action-error-index.yml']);
const MUTATION_LANE = 'flixo-execution-mutation-lane';
const MUTATION_GATE_SCRIPT = path.join(ROOT,'scripts','ci','execution-mutation-gate.mjs');

export const CONTROL_PLANE_FILES = Object.freeze([
  ...REPAIR_GATE_AUTOMATION.map((name) => `.github/workflows/${name}`),
  '.github/workflows/agent-repair-handoff-gate.yml',
  'scripts/ci/execution-mutation-gate.mjs',
  'scripts/ci/test-execution-mutation-gate.mjs',
  'scripts/ci/control-plane-registry.mjs',
  'scripts/ci/validate-auto-repair-boundary.mjs',
  'scripts/ci/auto-repair-chair1-audit.mjs',
  'scripts/ci/post-patch-adversarial-assessor.mjs',
  'scripts/ci/candidate-verification-parallel.mjs',
  'scripts/ci/in-repo-repair-v2.mjs',
  'scripts/ci/test-in-repo-repair-v2.mjs',
  'scripts/ci/test-post-patch-adversarial-v2.mjs',
  'schemas/in-repo-repair-v2.schema.json',
  'configs/in-repo-repair-v2.yml',
  'scripts/ci/task-agent.mjs',
  'scripts/ci/agent-execution-control.mjs',
  'scripts/ci/repair-strategy.mjs',
  'scripts/ci/auto-repair/ai-phase1.mjs',
  'scripts/ci/auto-repair/ai-phase2.mjs',
  'scripts/ci/auto-repair/ai-phase3.mjs',
  'scripts/ci/auto-repair-supervisor.mjs',
  'scripts/ci/auto-repair-learning.mjs',
  'scripts/ci/master-repair-governor.mjs',
  'scripts/ci/patch-truth-engine.mjs',
  'scripts/ci/verify-platform-publication-boundary.mjs',
  'scripts/ci/continuous-error-watch.mjs',
  '.github/workflows/agent-repair-supervisor.yml',
  '.github/workflows/agent-repair-heartbeat.yml',
  'scripts/ci/validate-certification-surface.mjs',
  'scripts/ci/validate-ci-cd-trust.mjs',
  'AGENTS.md',
  'docs/agents/TASK-AGENT.md',
  'docs/agents/CONTINUOUS-ERROR-WATCH-REPAIR-PROTOCOL.md',
]);

const denyPath = (p) =>
  /(^|\/)\.env(?:\.|$)/i.test(p) ||
  /\.(pem|key|p12|pfx)$/i.test(p) ||
  /(^|\/)secrets?\//i.test(p);

const fail = (message) => { throw new Error('AUTO_REPAIR_BOUNDARY_VIOLATION=' + message); };

function read(file) {
  if (!fs.existsSync(file)) fail(`missing-control-plane-file:${path.relative(ROOT, file)}`);
  return fs.readFileSync(file, 'utf8');
}

export function validateStatic() {
  const auto = read(AUTO_REPAIR);
  const dailyGate = read(DAILY_GATE);
  const handoffGate = read(HANDOFF_GATE);
  const watchdog = read(WATCHDOG);
  const mergeGate = read(MERGE_GATE);
  const masterGovernor = read(path.join(ROOT, 'scripts', 'ci', 'master-repair-governor.mjs'));
  const patchTruth = read(path.join(ROOT, 'scripts', 'ci', 'patch-truth-engine.mjs'));
  const platformBoundary = read(path.join(ROOT, 'scripts', 'ci', 'verify-platform-publication-boundary.mjs'));
  const canonicalTest = read(path.join(ROOT, '.github', 'workflows', 'ci.yml'));
  const wp0 = read(path.join(ROOT, '.github', 'workflows', 'wp0-trust-baseline.yml'));
  const testImpact = read(path.join(ROOT, '.github', 'workflows', 'test-impact.yml'));
  const testImpactExecution = read(path.join(ROOT, '.github', 'workflows', 'test-impact-execution.yml'));
  const securityBaseline = read(path.join(ROOT, '.github', 'workflows', 'repository-security-baseline.yml'));
  const claudeSecurity = read(path.join(ROOT, '.github', 'workflows', 'claude-security-review.yml'));
  const supervisor = read(path.join(ROOT, '.github', 'workflows', 'agent-repair-supervisor.yml'));
  const heartbeat = read(path.join(ROOT, '.github', 'workflows', 'agent-repair-heartbeat.yml'));
  const errors = [];
  const must = (condition, code) => { if (!condition) errors.push(code); };
  const workflowDir = path.join(ROOT,'.github','workflows');
  const workflowNames = fs.readdirSync(workflowDir).filter((name)=>/\.ya?ml$/u.test(name));
  for (const name of workflowNames) {
    const workflowText = fs.readFileSync(path.join(workflowDir,name),'utf8');
    const directExecutionPush = /^\s*(?:-\s*)?(?:git\s+push[^\n]*(?:\bexecution\b|HEAD:execution)|gh\s+api[^\n]*--method\s+(?:POST|PATCH|PUT|DELETE)[^\n]*git\/refs\/heads\/execution)/imu.test(workflowText);
    if (directExecutionPush) must(MUTATION_WORKFLOWS.includes(name), `execution-push-outside-mutation-allowlist:${name}`);
  }
  const mutationGate = read(MUTATION_GATE_SCRIPT);
  must(mutationGate.includes('FLIXO-EXECUTION-MUTATION-GATE-v1'),'mutation-gate-canonical-protocol');

  must(/name:\s*FLIXO Auto Repair Bot/.test(auto), 'auto-repair-identity');
  must(!/workflow_run:/.test(auto), 'auto-repair-executor-only-trigger');
  must(/workflow_dispatch:/.test(auto), 'auto-repair-dispatch-trigger');
  must(!/gh\s+workflow\s+run\s+auto-repair\.yml/i.test(auto), 'auto-repair-no-self-dispatch');
  must(/target_run_id:[\s\S]*required:\s*false/.test(auto), 'auto-repair-target-run-input-optional-for-resident');
  must(/case "\$TARGET_RUN_ID"/.test(auto) && /target_run_id must be numeric/.test(auto), 'auto-repair-repair-mode-requires-target-run');
  must(/inputs\.resident == 'true'/.test(auto), 'auto-repair-resident-mode-declared');
  must(
    /git worktree add --detach "\$TARGET_ROOT" "\$EXECUTION_SHA"/.test(auto) &&
      /test "\$\(git -C "\$TARGET_ROOT" rev-parse HEAD\)" = "\$EXECUTION_SHA"/.test(auto) &&
      /test -z "\$\(git -C "\$TARGET_ROOT" branch --show-current\)"/.test(auto),
    'auto-repair-execution-mutation-boundary'
  );
  must(/persist-credentials:\s*false/.test(auto), 'auto-repair-checkout-credential-isolation');
  must(/test "\$\(git -C "\$CONTROLLER_ROOT" rev-parse HEAD\)" = "\$MAIN_SHA"/.test(auto), 'auto-repair-main-controller-trust');
  must(/git worktree add --detach "\$TARGET_ROOT" "\$EXECUTION_SHA"/.test(auto), 'auto-repair-detached-execution-target');
  must(!/git\s+(?:switch|checkout)\s+-c\s+execution/.test(auto), 'auto-repair-no-local-branch-creation');
  must(/TRUST_MODEL=MAIN_CONTROLLER_CODE_EXECUTION_TARGET_DATA/.test(auto), 'auto-repair-trust-model');
  must(/FLIXO_TRUSTED_CONTROLLER_SHA=\$MAIN_SHA/.test(auto), 'auto-repair-controller-provenance');
  must(/contents:\s*read/.test(auto) && /actions:\s*read/.test(auto) && /checks:\s*read/.test(auto) && !/actions:\s*write/.test(auto), 'auto-repair-required-permissions');
  must(!/actions:\s*write/.test(auto), 'auto-repair-no-actions-admin');
  must(/checks:\s*read/.test(auto), 'auto-repair-check-permission');
  must(/group:\s*flixo-execution-mutation-lane/.test(auto), 'auto-repair-global-mutation-lane');
  must(/cancel-in-progress:\s*false/.test(auto), 'auto-repair-single-lane');
  must(!/queue:\s*max/.test(auto), 'auto-repair-no-unsupported-concurrency-queue');
  must(/execution-mutation-gate\.mjs\s+admit/.test(auto) && /execution-mutation-gate\.mjs\s+verify/.test(auto), 'auto-repair-mutation-gate-wired');
  must(/auto-repair-chair1-audit\.mjs/.test(auto), 'auto-repair-chair1-audit-required');
  must(/CHAIR1_AUDIT=APPROVED/.test(auto), 'auto-repair-chair1-audit-approval-required');
  must(/CHAIR1_REVIEW_AUTHORITY=STRICT_INDEPENDENT_AUDITOR/.test(auto), 'auto-repair-chair1-independent-review-required');
  must(/master-repair-governor\.mjs/.test(auto), 'master-repair-governor-required');
  must(/patch-truth-engine\.mjs/.test(auto), 'patch-truth-engine-required');
  must(/verify-platform-publication-boundary\.mjs/.test(auto), 'platform-publication-boundary-required');
  must(/FLIXO-MASTER-REPAIR-GOVERNOR-v1/.test(masterGovernor), 'master-repair-governor-protocol-required');
  must(/PATCH_TEXT_IS_NEVER_AUTHORITATIVE/.test(patchTruth), 'patch-truth-non-authoritative-input-rule');
  must(/FLIXO-PLATFORM-PUBLICATION-BOUNDARY-v1/.test(platformBoundary), 'external-platform-attestation-required');
  must(/FLIXO_AUTO_REPAIR_SELF_APPROVAL:\s*['"]false['"]/.test(auto), 'auto-repair-self-approval-forbidden');
  must(/FLIXO_AUTO_REPAIR_ROLE:\s*AUTO_REPAIR_BOT/.test(auto), 'auto-repair-chair-identity-required');
  must(!/auto-repair-chair-policy-exempt/.test(auto), 'auto-repair-chair-exemption-removed');
  for (const workflowName of MUTATION_WORKFLOWS) {
    const mutationWorkflow = fs.readFileSync(path.join(workflowDir,workflowName),'utf8');
    must(mutationWorkflow.includes(`group: ${MUTATION_LANE}`), `global-mutation-lane:${workflowName}`);
    must(/execution-mutation-gate\.mjs\s+(admit|verify)/.test(mutationWorkflow), `mutation-gate-wired:${workflowName}`);
  }
  must(/FLIXO_STRICT_RED_REPAIR:\s*['"]true['"]/.test(auto), 'auto-repair-strict-red');
  must(/not a diagnosable failure/.test(auto), 'auto-repair-failure-only-policy');
  must(auto.includes('CURRENT_TARGET_SHA=') && auto.includes('FAIL CLOSED: repair target'), 'auto-repair-no-superseded-target');
  must(/BASE_SHA="\$\(git rev-parse HEAD\)/.test(auto), 'auto-repair-candidate-base-sha');
  must(/test "\$BASE_SHA" = "\$FAILED_SHA"/.test(auto), 'auto-repair-candidate-binds-failed-sha');
  must(/test "\$\(git rev-parse origin\/execution\)" = "\$FAILED_SHA"/.test(auto), 'auto-repair-candidate-remote-exact-target');
  must(/CANDIDATE_SHA="\$\(git rev-parse HEAD\)/.test(auto), 'auto-repair-candidate-sha');
  must(/PARENT_SHA="\$\(git rev-parse "\$CANDIDATE_SHA\^"\)/.test(auto), 'auto-repair-candidate-parent-sha');
  must(/PARENT_SHA="\$\(git rev-parse "\$CANDIDATE_SHA\^"\)"/.test(auto) && /test "\$\(git rev-parse origin\/execution\)" = "\$FLIXO_FAILED_SHA"/.test(auto), 'auto-repair-publication-parent-integrity');
  must(!/git\s+push[^\n]*\bexecution\b/.test(auto) && /EXECUTION_PUBLICATION=BLOCKED_BY_CHAIR_GUARD/.test(auto), 'auto-repair-execution-publication-chair-gated');
  must(/if: steps\.chair1_audit\.outcome == 'success'/.test(auto), 'auto-repair-publication-must-depend-on-chair1');
  must(/FLIXO_CHAIR_CONTEXT:\s*\/tmp\/flixo-chair1-proposal\.json/.test(auto), 'auto-repair-chair-context-boundary');
  must(auto.includes('EVIDENCE_CAPTURE=FAILED'), 'auto-repair-evidence-capture-fail-closed');
  must(handoffGate.includes('branches: [execution]'), 'handoff-gate-execution-trigger');
  must(/permissions:\s*[\s\S]*contents:\s+read[\s\S]*checks:\s+read/.test(supervisor) && !/actions:\s*write/.test(supervisor), 'supervisor-read-only');
  must(!/gh\s+workflow\s+run\s+auto-repair\.yml/i.test(supervisor), 'supervisor-no-direct-repair-dispatch');
  must(!/push:\s*\n\s+branches:/m.test(supervisor) && !/pull_request:/m.test(supervisor), 'supervisor-observer-only-trigger');
  must(!/gh\s+workflow\s+run\s+auto-repair\.yml[\s\S]*-f\s+"?(?:target_run_id|failure_fingerprint|repair_lease_ref)=/i.test(heartbeat), 'heartbeat-no-mutation-repair-dispatch');
  must(!/actions:\s*write/.test(heartbeat), 'heartbeat-no-actions-write');
  must(!/actions\/workflows\/auto-repair\.yml\/dispatches/.test(heartbeat), 'heartbeat-no-direct-auto-repair-api-dispatch');
  must(!/actions\/workflows\/daily-flixo-green-gate\.yml\/dispatches/.test(heartbeat), 'heartbeat-no-direct-green-gate-api-dispatch');
  must(/gh\s+workflow\s+run\s+auto-repair\.yml[\s\S]*--ref\s+execution\s+-f\s+resident=true/.test(heartbeat) || !/gh\s+workflow\s+run\s+auto-repair\.yml/.test(heartbeat), 'heartbeat-resident-dispatch-must-be-explicit');
  must(
    /RESIDENT_MODE_IS_(?:OBSERVER|OBSERVATION)_ONLY|resident.*observ(?:er|ation)/i.test(heartbeat) ||
      !/gh\s+workflow\s+run\s+auto-repair\.yml/.test(heartbeat),
    'heartbeat-resident-mode-observer-only'
  );
  must(heartbeat.includes('actions/workflows/agent-repair-supervisor.yml/dispatches'), 'heartbeat-observer-only-wakeup');
  must(handoffGate.includes('CURRENT_EXECUTION_SHA=') && handoffGate.includes('HANDOFF_EXECUTION_SHA'), 'handoff-gate-current-head-check');
  must(/Create exact unpublished candidate commit/.test(auto), 'auto-repair-candidate-commit');
  must(/Run targeted regression and post-patch adversarial falsification in parallel/.test(auto), 'auto-repair-parallel-verification');
  must(/candidate-verification-parallel\.mjs/.test(auto), 'auto-repair-parallel-verification-script');
  must(/candidate-verification-parallel\.mjs/.test(auto) && /repair-adversarial-convergence\.mjs/.test(auto) && /STABLE_FOR_PUBLICATION/.test(auto), 'auto-repair-parallel-aggregate-pass');
  must(/Run targeted regression and post-patch adversarial falsification in parallel/.test(auto), 'auto-repair-post-patch-adversarial');
  must(/\.gate\.adversarialNoCounterexample/.test(auto), 'auto-repair-post-patch-no-counterexample');
  must(/in-repo-repair-v2\.mjs/.test(auto), 'auto-repair-v2-engine-integrated');
  must(/IN_REPO_REPAIR_V2_RCA_MANIFEST=PROVEN/.test(auto), 'auto-repair-v2-rca-manifest-gate');
  must(/Prepare exact Chair publication handoff/.test(auto) && /if: steps\.chair1_audit\.outcome == 'success' && steps\.master_governor_final\.outcome == 'success'/.test(auto), 'auto-repair-post-patch-before-publish');
  must(/cannot repair itself/.test(auto), 'auto-repair-self-protection');
  must(!/assistant[_ -]?fallback/i.test(auto), 'auto-repair-no-peer-fallback');
  must(/AUTO_REPAIR_BOT/.test(auto), 'auto-repair-executor-identity');
  must(/CHAIR1_AUDIT=APPROVED/.test(auto) && /CHAIR1_REVIEW_AUTHORITY=STRICT_INDEPENDENT_AUDITOR/.test(auto) && /CHAIR_GUARD_BLOCKED: direct execution publication is forbidden/.test(auto), 'auto-repair-chair1-final-authority');
  must(!/continue-on-error:\s*true/i.test(auto), 'auto-repair-no-continue-on-error');
  must(!/git\s+(checkout|switch)\s+-[bc]/.test(auto), 'auto-repair-no-third-branch');
  must(!/git\s+push[^\n]*\bmain\b/.test(auto), 'auto-repair-no-main-push');
  must(!/gh\s+pr\s+merge/i.test(auto), 'auto-repair-no-self-merge');
  must(/actions\/workflows\/auto-repair\.yml\/dispatches/.test(dailyGate), 'daily-gate-auto-repair-dispatch');
  must(/group:\s*flixo-execution-mutation-lane/.test(auto), 'auto-repair-single-execution-writer-lane');
  must(/contents:\s*read/.test(dailyGate) && !/contents:\s*write/.test(dailyGate), 'daily-gate-no-source-mutation-permission');
  must(!/gh\s+workflow\s+run\s+execution-bot-watchdog\.yml/i.test(dailyGate), 'daily-gate-no-watchdog-dispatch');
  must(/workflow_run:/.test(watchdog), 'watchdog-workflow-run-trigger');
  must(/FLIXO Test System/.test(watchdog) && /FLIXO WP0 Trust Baseline/.test(watchdog), 'watchdog-required-workflow-set');
  must(watchdog.includes('WATCHDOG_GREEN_GATE_TRIGGER_EXPECTED=true') || watchdog.includes('WATCHDOG_GREEN_GATE_DISPATCH=OBSERVATION_ONLY'), 'watchdog-dispatches-canonical-observer');
  must(!/gh\s+workflow\s+run\s+auto-repair\.yml/.test(watchdog), 'watchdog-no-direct-repair-dispatch');
  must(/CURRENT_EXECUTION_SHA/.test(watchdog) && /SOURCE_RUN_SHA/.test(watchdog), 'watchdog-exact-sha-boundary');
  must(/pull_request:/.test(mergeGate) && /branches:\s*\[main\]/.test(mergeGate), 'merge-gate-pr-main-trigger');
  must(/HEAD_BRANCH.*execution|HEAD_BRANCH.*=\s*"execution"/.test(mergeGate), 'merge-gate-execution-head');
  must(/CURRENT_EXECUTION_SHA/.test(mergeGate), 'merge-gate-exact-sha');
  must(/Certification/.test(mergeGate), 'merge-gate-certification-required');
  const exactShaEvidenceWorkflows = [
    ['canonical-test', canonicalTest],
    ['wp0', wp0],
    ['test-impact', testImpact],
    ['test-impact-execution', testImpactExecution],
    ['security-baseline', securityBaseline],
    ['claude-security', claudeSecurity],
    ['merge-gate', mergeGate],
  ];
  for (const [id, workflow] of exactShaEvidenceWorkflows) {
    must(/github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha/.test(workflow), 'required-evidence-workflow-must-bind-exact-sha:' + id);
  }
  for (const [id, workflow] of exactShaEvidenceWorkflows.filter(([id]) => id !== 'claude-security')) {
    must(/cancel-in-progress:\s*true/.test(workflow), 'required-evidence-workflow-must-cancel-stale:' + id);
  }
  must(/cancel-in-progress:\s*false/.test(claudeSecurity), 'advisory-security-review-must-preserve-started-run');
  must(/Repository Security Baseline/.test(mergeGate), 'merge-gate-security-required');
  must(!/continue-on-error:\s*true/i.test(mergeGate), 'merge-gate-no-continue-on-error');
  must(!/gh\s+pr\s+merge/i.test(mergeGate), 'merge-gate-no-self-merge');



  const residentTimeout = Number(auto.match(/jobs:\s*\n\s+resident:[\s\S]*?timeout-minutes:\s*(\d+)/)?.[1] ?? NaN);
  const repairTimeout = Number(auto.match(/jobs:\s*\n\s+resident:[\s\S]*?\n\s+repair:[\s\S]*?timeout-minutes:\s*(\d+)/)?.[1] ?? NaN);
  must(Number.isFinite(residentTimeout) && residentTimeout <= 345, 'auto-repair-resident-timeout-bound');
  must(Number.isFinite(repairTimeout) && repairTimeout <= 45, 'auto-repair-repair-timeout-bound');

  if (errors.length) fail(errors.join(','));
  return { status: 'PASS', maxChangedFiles: MAX_CHANGED_FILES, maxChangedLines: MAX_CHANGED_LINES, controlPlaneFiles: [...CONTROL_PLANE_FILES] };
}

export function validateDiff() {
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (branch !== 'execution') fail('mutation-branch:' + branch);
  const raw = execFileSync('git', ['diff', '--name-status'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!raw) return { status: 'PASS', changedFiles: 0, changedLines: 0 };
  const entries = raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const [status, ...rest] = line.split(/\s+/);
    return { status, path: rest.at(-1) };
  });
  if (entries.length > MAX_CHANGED_FILES) fail(`changed-files:${entries.length}>${MAX_CHANGED_FILES}`);
  const protectedChanged = entries.filter(({ path: p }) => CONTROL_PLANE_FILES.includes(p));
  if (protectedChanged.length) fail('control-plane-mutation:' + protectedChanged.map((x) => x.path).join(','));
  const denied = entries.filter(({ path: p }) => denyPath(p));
  if (denied.length) fail('sensitive-path-mutation:' + denied.map((x) => x.path).join(','));
  const numstat = execFileSync('git', ['diff', '--numstat'], { cwd: ROOT, encoding: 'utf8' }).trim();
  let changedLines = 0;
  for (const line of numstat.split(/\r?\n/).filter(Boolean)) {
    const [add, del] = line.split(/\s+/).map(Number);
    changedLines += (Number.isFinite(add) ? add : 0) + (Number.isFinite(del) ? del : 0);
  }
  if (changedLines > MAX_CHANGED_LINES) fail(`changed-lines:${changedLines}>${MAX_CHANGED_LINES}`);
  return { status: 'PASS', changedFiles: entries.length, changedLines };
}

const mode = process.argv.includes('--diff-only') ? 'diff' : process.argv.includes('--static-only') ? 'static' : 'both';
const result = mode === 'static' ? validateStatic() : mode === 'diff' ? validateDiff() : { static: validateStatic(), diff: validateDiff() };
console.log(JSON.stringify(result, null, 2));