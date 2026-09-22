import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const workflowDir = '.github/workflows';
const packageSource = readFileSync('package.json', 'utf8');
const scriptsBlock = packageSource.match(/"scripts"\s*:\s*\{([\s\S]*?)\n\s*\},\n\s*"dependencies"/u)?.[1] ?? '';
const scriptKeys = [...scriptsBlock.matchAll(/^\s*"([^"\n]+)"\s*:/gmu)].map((match) => match[1]);
const duplicateScriptKeys = [...new Set(scriptKeys.filter((key, index) => scriptKeys.indexOf(key) !== index))];
if (duplicateScriptKeys.length) {
  console.error('CI contract failed: duplicate package.json script keys=' + duplicateScriptKeys.join(','));
  process.exit(1);
}
const workflowFiles = readdirSync(workflowDir).filter((file) => /\.(ya?ml)$/.test(file)).sort();
const workflowTexts = workflowFiles.map((file) => ({
  file,
  text: readFileSync(`${workflowDir}/${file}`, 'utf8'),
}));

const workflowSource = readFileSync('.github/workflows/ci.yml', 'utf8');
const wp0Workflow = readFileSync('.github/workflows/wp0-trust-baseline.yml', 'utf8');
const impactPlanWorkflow = readFileSync('.github/workflows/test-impact.yml', 'utf8');
const impactExecutionWorkflow = readFileSync('.github/workflows/test-impact-execution.yml', 'utf8');
const securityBaselineWorkflow = readFileSync('.github/workflows/repository-security-baseline.yml', 'utf8');
const claudeSecurityWorkflow = readFileSync('.github/workflows/claude-security-review.yml', 'utf8');
const greenGateWorkflow = readFileSync('.github/workflows/daily-flixo-green-gate.yml', 'utf8');
const currentCommitGuard = readFileSync('scripts/ci/assert-current-commit.mjs', 'utf8');
const workflow = workflowSource.replace(/\\"/g, '"');
const testEngine = readFileSync('scripts/test.mjs', 'utf8');
const certifyEngine = readFileSync('scripts/ci/certify.mjs', 'utf8');
const certifyCore = readFileSync('scripts/ci/certify-core.mjs', 'utf8');
const autoRepairWorkflow = readFileSync('.github/workflows/auto-repair.yml', 'utf8');
const cellMasterConsultWorkflow = readFileSync('.github/workflows/cell-master-consult.yml', 'utf8');
const executionWatchdogWorkflow = readFileSync('.github/workflows/execution-bot-watchdog.yml', 'utf8');
const resultState = readFileSync('scripts/ci/result-state.mjs', 'utf8');

const required = [
  ['canonical push trigger', /push:\s*\n\s*branches:\s*\[main, execution\]/],
  ['single static-build engine', /\n\s{2}verify:\s*\n/],
  ['Browser FAST engine', /\n\s{2}browser_fast:\s*\n/],
  ['Browser DEEP engine', /\n\s{2}browser_deep:\s*\n/],
  ['single certification gate', /\n\s{2}certify:\s*\n/],
  ['superseding exact-SHA verification CI', /cancel-in-progress:\s*true/],
  ['event-scoped exact-SHA concurrency isolation', /group:\s*flixo-test-\$\{\{\s*github\.event_name\s*\}\}-\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/],
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

const canonicalVerificationPushTrigger = /push:\s*\n\s*branches:\s*\[main, execution\]/;
const securityExecutionPushTrigger = /push:\s*\n\s*branches:\s*\[main, execution\]/;
for (const [label, source] of [
  ['wp0-trust-baseline.yml', wp0Workflow],
  ['test-impact.yml', impactPlanWorkflow],
  ['test-impact-execution.yml', impactExecutionWorkflow],
  ['repository-security-baseline.yml', securityBaselineWorkflow],
  ['claude-security-review.yml', claudeSecurityWorkflow],
]) {
  const trigger = label === 'repository-security-baseline.yml' ? securityExecutionPushTrigger : canonicalVerificationPushTrigger;
  if (!trigger.test(source)) {
    console.error('CI contract failed: ' + label + ' must verify both canonical main and execution push heads.');
    process.exit(1);
  }
}

const canonicalConcurrencyWorkflows = [
  ['ci.yml', workflow],
  ['wp0-trust-baseline.yml', wp0Workflow],
  ['test-impact.yml', impactPlanWorkflow],
  ['test-impact-execution.yml', impactExecutionWorkflow],
  ['repository-security-baseline.yml', securityBaselineWorkflow],
  ['claude-security-review.yml', claudeSecurityWorkflow],
];
for (const [file, source] of canonicalConcurrencyWorkflows) {
  const block = source.match(/concurrency:[\s\S]*?(?=\n\s*(?:permissions:|env:|jobs:|#|$))/)?.[0] ?? '';
  const eventScopedSha = /\$\{\{\s*github\.event_name\s*\}\}/.test(block) &&
    /\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/.test(block);
  const legacyBranchLane = /github\.event\.pull_request\.head\.ref\s*\|\|\s*github\.ref_name/.test(block) ||
    /github\.event\.pull_request\.number\s*\|\|\s*github\.ref/.test(block);
  const exactShaLane = /github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha/.test(block);
  if (!block || (!eventScopedSha && !legacyBranchLane && !exactShaLane)) {
    console.error('CI contract failed: ' + file + ' must bind concurrency to a canonical branch/PR or an event-scoped exact SHA.');
    process.exit(1);
  }
}

const exactShaVerificationWorkflows = [
  ['ci.yml', workflow],
  ['wp0-trust-baseline.yml', wp0Workflow],
  ['test-impact.yml', impactPlanWorkflow],
  ['test-impact-execution.yml', impactExecutionWorkflow],
  ['repository-security-baseline.yml', securityBaselineWorkflow],
];

if (!/EXPECTED_SHA/.test(currentCommitGuard) ||
    !/EXPECTED_BRANCH/.test(currentCommitGuard) ||
    !/FAIL CLOSED/.test(currentCommitGuard) ||
    !/actualSha !== expectedSha/.test(currentCommitGuard)) {
  console.error('CI contract failed: exact current-commit freshness guard is missing or not fail-closed.');
  process.exit(1);
}
const requiredCurrentCommitGuardJobs = ['verify', 'browser_dependencies', 'browser_fast', 'browser_deep', 'certify'];
const missingCurrentCommitGuardJobs = requiredCurrentCommitGuardJobs.filter((jobName) => {
  const jobBlock = workflow.match(new RegExp('\\n  ' + jobName + ':[\\s\\S]*?(?=\\n  [A-Za-z0-9_-]+:|$)', 'u'))?.[0] ?? '';
  return !/assert-current-commit\\.mjs/u.test(jobBlock);
});
if (missingCurrentCommitGuardJobs.length) {
  console.error('CI contract failed: canonical CI must guard every verification job against a superseding commit: ' + missingCurrentCommitGuardJobs.join(', '));
  process.exit(1);
}

for (const [file, source] of exactShaVerificationWorkflows) {
  if (!/cancel-in-progress:\s*true/.test(source)) {
    console.error('CI contract failed: ' + file + ' must cancel superseded verification runs.');
    process.exit(1);
  }
  const sourceUsesEventScopedSha =
    /group:\s*[^\n]*github\.event_name[^\n]*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha/.test(source);
  const sourceUsesPrOrBranch =
    /github\.event\.pull_request\.number\s*\|\|\s*github\.ref/.test(source) ||
    /github\.event\.pull_request\.head\.ref\s*\|\|\s*github\.ref_name/.test(source);
  const sourceUsesExactSha = /group:\s*[^\n]*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha/.test(source);
  if (!sourceUsesEventScopedSha && !sourceUsesPrOrBranch && !sourceUsesExactSha) {
    console.error('CI contract failed: ' + file + ' must isolate runs by PR/branch or event-scoped exact SHA.');
    process.exit(1);
  }
  if (!/EXPECTED_SHA/.test(source)) {
    console.error('CI contract failed: ' + file + ' must retain exact-SHA verification.');
    process.exit(1);
  }
}

if (!/cancel-in-progress:\s*false/.test(claudeSecurityWorkflow)) {
  console.error('CI contract failed: claude-security-review.yml must preserve advisory review runs once started.');
  process.exit(1);
}
const claudeConcurrencyBlock = claudeSecurityWorkflow.match(/concurrency:[\s\S]*?(?=\n#|\npermissions:)/)?.[0] ?? '';
const claudeGroupLine = claudeConcurrencyBlock.split(/\r?\n/).find((line) => line.trim().startsWith('group:'))?.trim() ?? '';
const claudeGroupUsesRepository = claudeGroupLine.includes('github.event.pull_request.head.repo.full_name || github.repository');
const claudeGroupUsesExactSha = claudeGroupLine.includes('github.event.pull_request.head.sha || github.sha');
if (!claudeGroupLine.startsWith('group: claude-security-') || !claudeGroupUsesRepository || !claudeGroupUsesExactSha) {
  console.error('CI contract failed: claude-security-review.yml must bind advisory review grouping to repository and exact SHA.');
  process.exit(1);
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

if (/flixo-repair-twins-/.test(autoRepairWorkflow) ||
    /gh run download.*flixo-repair-twins-/.test(autoRepairWorkflow) ||
    /actions\/download-artifact/.test(autoRepairWorkflow)) {
  console.error('CI contract failed: auto-repair twin results must not cross the repair trust boundary through downloadable artifacts.');
  process.exit(1);
}
const localTwinBoundary =
  /name: Run adversarial twins locally inside the canonical repair trust domain[\s\S]*?id: twin/.test(autoRepairWorkflow) &&
  /git worktree add --detach \/tmp\/flixo-twin-target "\$EXPECTED_SHA"/.test(autoRepairWorkflow) &&
  /OUTPUT=\/tmp\/flixo-twin-a\.json/.test(autoRepairWorkflow) &&
  /OUTPUT=\/tmp\/flixo-twin-b\.json/.test(autoRepairWorkflow) &&
  /FLIXO_TWIN_DETACHED='true'/.test(autoRepairWorkflow) &&
  /validate-adversarial-repair-twin\.mjs/.test(autoRepairWorkflow) &&
  /ACTION-WISE select best repair option from history and twin A\/B[\s\S]*?if: steps\.twin\.outcome == 'success'/.test(autoRepairWorkflow) &&
  /--twin-a=\/tmp\/flixo-twin-a\.json/.test(autoRepairWorkflow) &&
  /--twin-b=\/tmp\/flixo-twin-b\.json/.test(autoRepairWorkflow) &&
  !/repair:[\s\S]*?needs:\s*adversarial_twin/.test(autoRepairWorkflow);
if (!localTwinBoundary) {
  console.error('CI contract failed: adversarial twin execution must remain inside the canonical repair job, on a fixed detached exact-SHA worktree, with bounded fixed-path validated handoff.');
  process.exit(1);
}
if (/FLIXO_SELECTED_REPAIR_STRATEGY=\$SELECTED/.test(autoRepairWorkflow) ||
    /ACTION_WISE_NO_SOLUTION=true.*GITHUB_ENV/.test(autoRepairWorkflow)) {
  console.error('CI contract failed: selected repair strategy must not be written into GITHUB_ENV from untrusted JSON.');
  process.exit(1);
}
if (!/permissions:\s*\n\s*contents:\s*read\s*\n\s*actions:\s*read/.test(cellMasterConsultWorkflow)) {
  console.error('CI contract failed: cell-master-consult.yml must declare explicit read-only token permissions.');
  process.exit(1);
}
const watchdogExactCheckout =
  /name: Checkout trusted watchdog source[\s\S]*actions\/checkout@[^\n]+[\s\S]*ref: main/.test(executionWatchdogWorkflow);
const watchdogExactVerify =
  /name: Verify trusted watchdog checkout[\s\S]*git rev-parse HEAD[\s\S]*test "\$ACTUAL_WATCHDOG_SHA" = "\$TRUSTED_MAIN_SHA"[\s\S]*WATCHDOG_CHECKOUT_MODE=TRUSTED_MAIN/.test(executionWatchdogWorkflow);
const watchdogSourceFreshnessMarkers = [
  'name: Capture exact execution state',
  "SOURCE_RUN_SHA: ${{ github.event.workflow_run.head_sha || '' }}",
  'LIVE_EXECUTION_SHA="$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/execution" --jq \'.object.sha\')"',
  'if [ "$LIVE_EXECUTION_SHA" != "$SOURCE_RUN_SHA" ]',
  'STALE_WATCHDOG_EVENT=true',
];
const watchdogSourceFreshness = watchdogSourceFreshnessMarkers.every((marker) =>
  executionWatchdogWorkflow.includes(marker),
);
const watchdogConcurrency =
  /concurrency:[\s\S]*group:\s*flixo-execution-watchdog-single-observer[\s\S]*cancel-in-progress:\s*true/.test(executionWatchdogWorkflow);
if (!watchdogExactCheckout || !watchdogExactVerify || !watchdogSourceFreshness || !watchdogConcurrency) {
  console.error('CI contract failed: execution-bot-watchdog.yml must execute only trusted controller code from main, observe the exact execution SHA through GitHub APIs, and reject stale workflow_run events.');
  process.exit(1);
}
const watchdogStepBlock = (workflowText, stepName) => {
  const marker = `      - name: ${stepName}`;
  const startIndex = workflowText.indexOf(marker);
  if (startIndex < 0) return '';
  const remainder = workflowText.slice(startIndex);
  const nextStep = remainder.search(/\n\s{6}-\sname:/u);
  return nextStep >= 0 ? remainder.slice(0, nextStep) : remainder;
};

const pushWakeBlock = watchdogStepBlock(executionWatchdogWorkflow, 'Record exact execution push wake');
const pushWakeMarkers = [
  'name: Record exact execution push wake',
  'if: github.event_name == \'push\' && github.ref_name == \'execution\' && steps.source.outputs.stale != \'true\'',
  'SOURCE_EXECUTION_SHA: ${{ steps.source.outputs.execution_sha }}',
  'EXECUTION_SHA="$SOURCE_EXECUTION_SHA"',
  'EXPECTED_PUSH_SHA="$GITHUB_SHA"',
  'test "$EXECUTION_SHA" = "$EXPECTED_PUSH_SHA"',
];
if (!pushWakeMarkers.every((marker) => pushWakeBlock.includes(marker)) ||
    pushWakeBlock.includes('git rev-parse HEAD')) {
  console.error('CI contract failed: push watchdog wake must bind the observed execution state to the exact push SHA without using the trusted-main HEAD.');
  process.exit(1);
}

const canonicalTestBlock = watchdogStepBlock(executionWatchdogWorkflow, 'Verify canonical Test System exists for exact SHA');
const canonicalTestMarkers = [
  'name: Verify canonical Test System exists for exact SHA',
  'SOURCE_EXECUTION_SHA: ${{ steps.source.outputs.execution_sha }}',
  'EXECUTION_SHA="$SOURCE_EXECUTION_SHA"',
  'actions/runs?head_sha=$EXECUTION_SHA&per_page=100',
  'path == ".github/workflows/ci.yml"',
  '.head_sha == $sha',
  'FAIL CLOSED: canonical FLIXO Test System did not start for exact SHA',
];
if (!canonicalTestMarkers.every((marker) => canonicalTestBlock.includes(marker)) || /\/dispatches/.test(canonicalTestBlock)) {
  console.error('CI contract failed: watchdog must observe the canonical exact-SHA Test System run without dispatching it.');
  process.exit(1);
}
const greenGateConcurrency = greenGateWorkflow.match(/concurrency:[\s\S]*?(?=\njobs:|$)/)?.[0] ?? '';
if (!/cancel-in-progress:\s*true/.test(greenGateConcurrency) ||
    !/group:\s*flixo-continuous-error-watch-\$\{\{\s*github\.ref_name\s*\}\}/.test(greenGateConcurrency) ||
    /github\.run_id/.test(greenGateConcurrency)) {
  console.error('CI contract failed: daily green gate must use one replaceable observer lane per canonical branch without run-id fan-out.');
  process.exit(1);
}
const residentCiBlock =
  greenGateWorkflow.match(/name: Ensure exact-SHA required CI is resident[\s\S]*?(?=\n\s{6}- name:|$)/)?.[0] ?? '';
const settlementBlock =
  greenGateWorkflow.match(/name: Await required internal CI settlement on exact SHA[\s\S]*?(?=\n\s{6}- name:|$)/)?.[0] ?? '';
if (!/if:\s*(?:>-\s*)?\n?\s*steps\.capture\.outputs\.branch == 'execution'/.test(residentCiBlock) ||
    /actions\/workflows\//.test(residentCiBlock) ||
    !/FAIL_CLOSED: required CI residency is incomplete for exact SHA(?: after [^\n]+)?/.test(residentCiBlock)) {
  console.error('CI contract failed: Green Gate must observe required execution-push CI residency and fail closed without redispatch.');
  process.exit(1);
}
if (/actions\/workflows\//.test(residentCiBlock) || /gh workflow run/.test(settlementBlock)) {
  console.error('CI contract failed: Green Gate must not redispatch required CI.');
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

const protectedLiveRuntime = workflowTexts.find(({ file }) => file === 'council-live-runtime-verification.yml');
if (!protectedLiveRuntime ||
    !/^\s{2}verify:\s*$/m.test(protectedLiveRuntime.text) ||
    !/environment:\s*flixo-live-runtime-verification/.test(protectedLiveRuntime.text) ||
    !/Run read-only live runtime verification/.test(protectedLiveRuntime.text)) {
  console.error('CI contract failed: protected live-runtime verification owner is missing or not explicitly isolated.');
  process.exit(1);
}

for (const job of ['verify', 'browser_fast', 'browser_deep', 'certify']) {
  const owners = workflowTexts.filter(({ file, text }) =>
    file !== 'council-live-runtime-verification.yml' &&
    new RegExp('^\\s{2}' + job + ':\\s*$', 'm').test(text),
  );
  if (owners.length !== 1 || owners[0].file !== 'ci.yml') {
    console.error(
      `CI contract failed: canonical job ${job} must have exactly one workflow owner (ci.yml), excluding the separately protected live-runtime verifier; owners=${owners.map(({ file }) => file).join(',') || 'none'}`,
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

const semanticValidationCommands = [
  'scripts/ci/test-execution-graph-semantic-identity.mjs',
  'scripts/ci/test-image-core-foundation.mjs',
  'scripts/ci/validate-playwright-surface.mjs',
  'scripts/ci/validate-certification-surface.mjs',
  'scripts/ci/validate-agent-protocol.mjs',
  'scripts/ci/validate-agent-coordination.mjs',
  'scripts/ci/action-vault-agent-gate.mjs',
  'scripts/ci/test-action-vault-agent-gate.mjs',
  'scripts/ci/test-action-vault-targeted-test.mjs',
  'scripts/ci/test-action-agent-runtime.mjs',
  'scripts/ci/test-action-agent-history.mjs',
  'scripts/ci/test-swarm-controller.mjs',
  'scripts/ci/test-repair-protocol.mjs',
  'scripts/ci/test-task-agent-contract.mjs',
  'scripts/ci/test-agent-admission.mjs',
];
try {
  for (const command of semanticValidationCommands) {
    console.log('CI_CONTRACT_CHILD_TEST_START=' + command);
    execFileSync(process.execPath, [command], { stdio: 'inherit' });
    console.log('CI_CONTRACT_CHILD_TEST_PASS=' + command);
  }
} catch (error) {
  const command = semanticValidationCommands.find((candidate) => {
    try {
      execFileSync(process.execPath, [candidate], { stdio: 'ignore' });
      return false;
    } catch {
      return true;
    }
  });
  console.error('CI_CONTRACT_CHILD_TEST_FAILURE=' + (command ?? 'UNKNOWN'));
  console.error(error instanceof Error ? error.message : String(error));
  console.error('CI contract failed: execution-graph semantic identity/image-core/browser/certification/agent-protocol/coordination/Task-Agent authority/admission surface validation failed.');
  process.exit(1);
}

const autoRepairGlobalEnv = autoRepairWorkflow.match(/^env:\s*\n[\s\S]*?(?=^jobs:)/m)?.[0] ?? '';
const autoRepairProvenanceContract = [
  /on:\s*\n\s*workflow_dispatch:/,
  /name:\s*Repair dispatch provenance guard/,
  /test "\$GITHUB_EVENT_NAME" = "workflow_dispatch"/,
  /test "\$GITHUB_REF" = "refs\/heads\/main"/,
  /GITHUB_WORKFLOW_REF/,
  /refs\/heads\/main/,
  /resident:\s*\n\s*needs:\s*\[provenance-guard\]/,
  /repair:\s*\n\s*needs:\s*\[provenance-guard\]/,
];
if (!autoRepairProvenanceContract.every((pattern) => pattern.test(autoRepairWorkflow))) {
  console.error('CI contract failed: Auto Repair provenance guard is missing or incomplete.');
  process.exit(1);
}
const securityBoundaryContracts = [
  ['auto-repair-main-only', autoRepairWorkflow, /resident:[\s\S]*?if:\s*github\.ref\s*==\s*'refs\/heads\/main'/],
  ['auto-repair-isolated-target', autoRepairWorkflow, autoRepairWorkflow.includes('git worktree add --detach "$TARGET_ROOT" "$EXECUTION_SHA"') && autoRepairWorkflow.includes('BASH_ENV=/tmp/flixo-repair-bash-env') && autoRepairWorkflow.includes('TRUST_MODEL=MAIN_CONTROLLER_CODE_EXECUTION_TARGET_DATA') && !autoRepairWorkflow.includes('git switch --create execution "$EXECUTION_BASE_SHA"')],
  ['auto-repair-no-global-supabase-secret', autoRepairGlobalEnv, !autoRepairGlobalEnv.includes('SUPABASE_SERVICE_ROLE_KEY')],
  ['auto-repair-repair-main-only', autoRepairWorkflow, /repair:[\s\S]*?if:\s*github\.ref\s*==\s*'refs\/heads\/main'/],
  ['green-gate-no-execution-push', greenGateWorkflow, !/push:\s*\n\s*branches:\s*\[execution\]/.test(greenGateWorkflow)],
  ['watchdog-no-execution-push', executionWatchdogWorkflow, !/push:\s*\n\s*branches:\s*\[execution(?:,\s*main)?\]/.test(executionWatchdogWorkflow)],
  ['live-runtime-main-only', protectedLiveRuntime.text, /verify:[\s\S]*?if:\s*github\.ref\s*==\s*'refs\/heads\/main'/],
  ['live-runtime-main-checkout', protectedLiveRuntime.text, /ref:\s*main/],
  ['council-priority-main-only', readFileSync('.github/workflows/council-priority-wake.yml', 'utf8'), /wake:[\s\S]*?if:\s*github\.ref\s*==\s*'refs\/heads\/main'/],
  ['agent-relay-main-only', readFileSync('.github/workflows/agent-communication-relay.yml', 'utf8'), /if:\s*\$\{\{\s*github\.ref\s*==\s*'refs\/heads\/main'/],
  ['green-gate-auto-repair-dispatch-main', greenGateWorkflow, greenGateWorkflow.includes('actions/workflows/auto-repair.yml/dispatches') && greenGateWorkflow.includes('-f ref=main') && !greenGateWorkflow.includes('-f ref=execution')],
];
for (const [label, source, rule] of securityBoundaryContracts) {
  const ok = typeof rule === 'boolean' ? rule : rule.test(source);
  if (!ok) {
    console.error('CI contract failed: privileged security boundary regression=' + label);
    process.exit(1);
  }
}

console.log(
  `CI contract passed: one execution graph, centralized result-state reduction, explicit evidence provenance, canonical DEEP semantic identity, shared image-core foundation, minimal SHA checkout, one FAST engine, one DEEP engine, canonical push DEEP coverage, one fail-closed certification gate, single workflow certification authority across ${workflowFiles.length} workflow definitions, and mandatory multi-agent coordination protocol.`,
);