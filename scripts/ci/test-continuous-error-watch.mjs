import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateGreen, classifyCancelledRun, validateRepairTarget } from './continuous-error-watch.mjs';
import { deriveRepairIdentity } from './repair-control-plane.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const run = (workflowName, databaseId, conclusion = 'success') => ({
  workflowName,
  databaseId,
  headSha: SHA_A,
  headBranch: 'execution',
  status: 'completed',
  conclusion,
  updatedAt: '2026-09-19T00:00:00Z',
});
const requiredRuns = [
  'FLIXO Test System',
  'FLIXO WP0 Trust Baseline',
  'FLIXO Test Impact',
  'FLIXO Test Impact Execution',
  'Repository Security Baseline',
  'Claude Security Review',
].map((name, i) => run(name, i + 1));
const cancelledRun = { ...run('FLIXO Test Impact Execution', 40, 'cancelled'), updatedAt: '2026-09-19T00:00:00Z' };
const successorRun = { ...run('FLIXO Test Impact Execution', 41, 'success'), updatedAt: '2026-09-19T00:01:00Z' };
assert.equal(classifyCancelledRun(cancelledRun, [cancelledRun, successorRun]).state, 'CANCELLED_SUPERSEDED');
assert.equal(classifyCancelledRun(cancelledRun, [cancelledRun]).state, 'CANCELLED_UNSUPERSEDED');

assert.equal(validateRepairTarget({
  run: {
    databaseId: 10000,
    status: 'completed',
    conclusion: 'failure',
    headSha: 'b'.repeat(40),
    headBranch: 'execution',
    workflowName: '.github/workflows/daily-flixo-green-gate.yml',
  },
  executionSha: 'b'.repeat(40),
  logs: { '10000': 'EVIDENCE_CAPTURE=AVAILABLE\nfailure evidence' },
  branch: 'execution',
}).valid, false);

assert.equal(validateRepairTarget({
  run: {
    databaseId: 9999,
    status: 'completed',
    conclusion: 'failure',
    headSha: 'a'.repeat(40),
    headBranch: 'execution',
    name: 'Daily·FLIXO Green Gate 9999',
  },
  executionSha: 'a'.repeat(40),
  logs: { '9999': 'EVIDENCE_CAPTURE=AVAILABLE\nfailure evidence' },
  branch: 'execution',
}).valid, false);
assert.equal(validateRepairTarget({
  run: { ...run('FLIXO Test Impact Execution', 50, 'failure'), headBranch: 'execution' },
  executionSha: SHA_A,
  workflowRuns: [],
  logs: { 50: 'EVIDENCE_CAPTURE=AVAILABLE\ninternal failure' },
}).valid, true);
assert.equal(validateRepairTarget({
  run: { ...run('FLIXO Test Impact Execution', 51, 'failure'), headBranch: 'main' },
  executionSha: SHA_A,
  workflowRuns: [],
  logs: { 51: 'EVIDENCE_CAPTURE=AVAILABLE\ninternal failure' },
}).valid, false);
assert.equal(validateRepairTarget({
  run: { ...run('FLIXO Test Impact Execution', 52, 'failure'), headBranch: 'execution' },
  executionSha: SHA_B,
  workflowRuns: [],
  logs: { 52: 'EVIDENCE_CAPTURE=AVAILABLE\ninternal failure' },
}).valid, false);
assert.equal(validateRepairTarget({
  run: { ...run('FLIXO Auto Repair Bot', 53, 'failure'), headBranch: 'execution' },
  executionSha: SHA_A,
  workflowRuns: [],
  logs: { 53: 'EVIDENCE_CAPTURE=AVAILABLE\nself target' },
}).errors.includes('TARGET_SELF_REPAIR'), true);
assert.equal(validateRepairTarget({
  run: { ...run('Unknown workflow', 54, 'failure'), headBranch: 'execution' },
  executionSha: SHA_A,
  workflowRuns: [],
  logs: { 54: 'EVIDENCE_CAPTURE=AVAILABLE\nunknown target' },
}).valid, true);
assert.equal(validateRepairTarget({
  run: { ...run('FLIXO Auto Repair Bot', 56, 'failure'), headBranch: 'execution' },
  executionSha: SHA_A,
  workflowRuns: [],
  logs: { 56: 'EVIDENCE_CAPTURE=AVAILABLE\nself repair infrastructure' },
}).errors.includes('TARGET_WORKFLOW_NOT_ALLOWED'), true);
assert.equal(validateRepairTarget({
  run: { ...run('FLIXO Test Impact Execution', 55, 'failure'), headBranch: 'execution' },
  executionSha: SHA_A,
  workflowRuns: [],
  logs: {},
}).errors.includes('EVIDENCE_CAPTURE_FAILED'), true);

const securityAndCertification = [
  { id: 101, name: 'github-advanced-security', status: 'completed', conclusion: 'success' },
  { id: 102, name: 'Certification', status: 'completed', conclusion: 'success' },
];


const openPr = { number: 748, headRefOid: SHA_A, baseRefOid: SHA_B };

const securityWorkflowEvidence = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns,
  checkRuns: [
    { id: 109, name: 'Workflow trust baseline', status: 'completed', conclusion: 'success' },
    { id: 110, name: 'Certification', status: 'completed', conclusion: 'success' },
  ],
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(securityWorkflowEvidence.ci.security.present, true);
assert.equal(securityWorkflowEvidence.ci.security.status, 'success');
assert.equal(securityWorkflowEvidence.ci.security.name, 'Workflow trust baseline');
assert.equal(securityWorkflowEvidence.errors.some((x) => x.type === 'SECURITY_EVIDENCE_MISSING'), false);
assert.equal(securityWorkflowEvidence.status, 'GREEN');


const green = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns, checkRuns: securityAndCertification,
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(green.status, 'GREEN');

const mainObservedGreen = evaluateGreen({
  executionSha: SHA_A,
  mainSha: SHA_A,
  observedBranch: 'main',
  openPr: null,
  latestMergedPr: { headRefOid: SHA_B, mergeCommit: { oid: SHA_B } },
  workflowRuns: [
    { ...requiredRuns[0], headBranch: 'main', conclusion: 'success' },
  ],
  checkRuns: securityAndCertification,
  statuses: [{ context: 'Vercel', state: 'success' }],
  compare: { ahead_by: 0, behind_by: 0 },
});
assert.equal(mainObservedGreen.status, 'GREEN');
assert.equal(mainObservedGreen.errors.length, 0);
assert.equal(mainObservedGreen.ci.requiredWorkflows['FLIXO Test System'].status, 'success');
assert.equal(mainObservedGreen.ci.requiredWorkflows['FLIXO WP0 Trust Baseline'], undefined);

const cancelledUnsuperseded = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns.map((item) =>
    item.workflowName === 'FLIXO Test Impact Execution'
      ? { ...item, conclusion: 'cancelled', databaseId: 996, updatedAt: '2026-09-19T00:02:00Z', headBranch: 'execution' }
      : item),
  checkRuns: securityAndCertification,
  logs: { 996: 'EVIDENCE_CAPTURE=AVAILABLE\ncancelled internal run' },
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(cancelledUnsuperseded.status, 'FAIL_CLOSED');
assert.equal(cancelledUnsuperseded.repair.required, false);

const cancelledWithoutEvidence = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns.map((item) =>
    item.workflowName === 'FLIXO Test Impact Execution'
      ? { ...item, conclusion: 'cancelled', databaseId: 994, updatedAt: '2026-09-19T00:03:00Z', headBranch: 'execution' }
      : item),
  checkRuns: securityAndCertification,
  logs: {},
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(cancelledWithoutEvidence.status, 'FAIL_CLOSED');
assert.equal(cancelledWithoutEvidence.repair.required, false);

const missingEvidence = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns.map((item) =>
    item.workflowName === 'FLIXO Test Impact Execution'
      ? { ...item, conclusion: 'failure', databaseId: 995, headBranch: 'execution' }
      : item),
  checkRuns: securityAndCertification,
  logs: {},
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(missingEvidence.status, 'FAIL_CLOSED');
assert.equal(missingEvidence.repair.required, false);
assert(missingEvidence.errors.some((x) => x.type === 'EVIDENCE_CAPTURE_FAILED'));

const external = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns,
  checkRuns: [...securityAndCertification, { id: 103, name: 'Vercel', status: 'completed', conclusion: 'failure' }],
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(external.status, 'BLOCKED_EXTERNAL');
assert.equal(external.repair.required, false);

const cloudflareDeployment = evaluateGreen({
  executionSha: SHA_A,
  mainSha: SHA_B,
  openPr,
  workflowRuns: requiredRuns,
  checkRuns: [
    ...securityAndCertification,
    { id: 107, name: 'Deploy exact SHA to Cloudflare flixoai', status: 'completed', conclusion: 'failure' },
  ],
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(cloudflareDeployment.status, 'BLOCKED_EXTERNAL');
assert.equal(cloudflareDeployment.repair.required, false);

const cloudflareSkipped = evaluateGreen({
  executionSha: SHA_A,
  mainSha: SHA_B,
  openPr,
  workflowRuns: requiredRuns,
  checkRuns: [
    ...securityAndCertification,
    { id: 108, name: 'Deploy exact SHA to Cloudflare flixoai', status: 'completed', conclusion: 'skipped' },
  ],
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(cloudflareSkipped.status, 'GREEN');
assert.equal(cloudflareSkipped.repair.required, false);
assert.equal(cloudflareSkipped.externalBlockers.length, 0);

const externalActionRequired = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns,
  checkRuns: [
    ...securityAndCertification,
    { id: 106, name: 'Vercel', status: 'completed', conclusion: 'action_required' },
  ],
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(externalActionRequired.status, 'FAIL_CLOSED');
assert.equal(externalActionRequired.repair.required, false);
assert.equal(externalActionRequired.rootCause, 'EXTERNAL_REVIEW_OR_APPROVAL_REQUIRED');

const externalCommitStatus = evaluateGreen({
  executionSha: SHA_A,
  mainSha: SHA_B,
  openPr,
  workflowRuns: requiredRuns,
  checkRuns: securityAndCertification,
  statuses: [{ context: 'Vercel', state: 'failure' }],
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(externalCommitStatus.status, 'BLOCKED_EXTERNAL');
assert.equal(externalCommitStatus.repair.required, false);

const codeqlSecurityEvidence = evaluateGreen({
  executionSha: SHA_A,
  mainSha: SHA_A,
  observedBranch: 'main',
  openPr: null,
  latestMergedPr: null,
  workflowRuns: [
    { ...requiredRuns[0], headBranch: 'main', conclusion: 'success', updatedAt: '2026-09-19T00:00:00Z' },
  ],
  checkRuns: [
    { id: 201, name: 'Analyze (javascript-typescript)', status: 'completed', conclusion: 'success', updatedAt: '2026-09-19T00:02:00Z' },
    { id: 202, name: 'Certification', status: 'completed', conclusion: 'success', updatedAt: '2026-09-19T00:02:00Z' },
    { id: 203, name: 'Deploy exact SHA to Cloudflare flixoai', status: 'completed', conclusion: 'failure', updatedAt: '2026-09-19T00:01:00Z' },
    { id: 204, name: 'Deploy exact SHA to Cloudflare flixoai', status: 'completed', conclusion: 'skipped', updatedAt: '2026-09-19T00:03:00Z' },
    { id: 205, name: 'Observe, classify, repair-or-block, prove, continue', status: 'completed', conclusion: 'failure', updatedAt: '2026-09-19T00:04:00Z' },
  ],
  statuses: [{ context: 'Vercel', state: 'failure' }],
  compare: { ahead_by: 0, behind_by: 0 },
});
assert.equal(codeqlSecurityEvidence.status, 'BLOCKED_EXTERNAL');
assert.equal(codeqlSecurityEvidence.ci.security.present, true);
assert.equal(codeqlSecurityEvidence.ci.security.name, 'Analyze (javascript-typescript)');
assert.equal(codeqlSecurityEvidence.errors.some((x) => x.type === 'UNEXPECTED_CHECK_RED'), false);
assert.equal(codeqlSecurityEvidence.errors.some((x) => x.type === 'SECURITY_EVIDENCE_MISSING'), false);

const securityProvider = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns,
  checkRuns: [
    { id: 104, name: 'github-advanced-security', status: 'completed', conclusion: 'failure', details_url: 'https://github.com/m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS/actions/runs/35452323662' },
    { id: 102, name: 'Certification', status: 'completed', conclusion: 'success' },
  ],
  logs: { 35452323662: 'CAPIError: 400 The requested model is not supported' },
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(securityProvider.status, 'BLOCKED_EXTERNAL');
assert.equal(securityProvider.externalBlockers[0].rootCause, 'EXTERNAL_SECURITY_PROVIDER_FAILURE');

const securityMissingEvidence = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns,
  checkRuns: [
    { id: 105, name: 'github-advanced-security', status: 'completed', conclusion: 'failure', details_url: 'https://github.com/m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS/actions/runs/35452323663' },
    { id: 102, name: 'Certification', status: 'completed', conclusion: 'success' },
  ],
  logs: {},
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(securityMissingEvidence.status, 'FAIL_CLOSED');
assert.equal(securityMissingEvidence.repair.required, false);

const internal = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns.map((item) =>
    item.workflowName === 'FLIXO Test Impact Execution'
      ? { ...item, conclusion: 'failure', databaseId: 999 }
      : item),
  checkRuns: securityAndCertification,
  logs: { 999: 'EVIDENCE_CAPTURE=AVAILABLE\ninternal failure' },
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(internal.status, 'RED_INTERNAL');
assert.equal(internal.repair.required, true);
assert.equal(internal.repair.targetRunId, 999);
assert.match(internal.repair.failureFingerprint, /^[0-9a-f]{64}$/);
const internalIdentity = deriveRepairIdentity({
  branch: 'execution',
  failedSha: SHA_A,
  failureFingerprint: internal.repair.failureFingerprint,
  targetRunId: '999',
});
assert.equal(internal.repair.repairKey, internalIdentity.claimKey);
assert.equal(internal.repair.claimKey, internalIdentity.claimKey);
assert.equal(internal.repair.repairChainId, internalIdentity.repairChainId);
assert.equal(internal.repair.leaseRef, internalIdentity.leaseRef);
assert.equal(internal.repair.failedSha, SHA_A);
assert.equal(internal.repair.branch, 'execution');

const arbitraryRedWorkflow = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: [
    ...requiredRuns,
    { ...run('Brand New Test Suite', 1200, 'failure') },
  ],
  checkRuns: securityAndCertification,
  logs: { 1200: 'EVIDENCE_CAPTURE=AVAILABLE\nassertion failed' },
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(arbitraryRedWorkflow.status, 'RED_INTERNAL');
assert.equal(arbitraryRedWorkflow.repair.required, true);
assert.equal(arbitraryRedWorkflow.repair.targetRunId, 1200);

const providerWorkflow = evaluateGreen({
  executionSha: SHA_A,
  mainSha: SHA_B,
  openPr,
  workflowRuns: requiredRuns.map((item) =>
    item.workflowName === 'Claude Security Review'
      ? { ...item, conclusion: 'failure', databaseId: 1000 }
      : item),
  checkRuns: securityAndCertification,
  logs: { 1000: 'CAPIError: 400 The requested model is not supported' },
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(providerWorkflow.status, 'BLOCKED_EXTERNAL');
assert.equal(providerWorkflow.repair.required, false);

const missing = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns.slice(1), checkRuns: securityAndCertification,
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(missing.status, 'WAITING_REQUIRED_CHECKS');

const stale = evaluateGreen({
  executionSha: SHA_B, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns, checkRuns: securityAndCertification,
  compare: { ahead_by: 0, behind_by: 0 },
});
assert.equal(stale.status, 'RED_INTERNAL');

const actionRequired = evaluateGreen({
  executionSha: SHA_A,
  mainSha: SHA_B,
  openPr,
  workflowRuns: requiredRuns.map((item) =>
    item.workflowName === 'FLIXO Test System'
      ? { ...item, conclusion: 'action_required', status: 'completed', databaseId: 1001 }
      : item),
  checkRuns: securityAndCertification,
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(actionRequired.status, 'FAIL_CLOSED');
assert.equal(actionRequired.repair.required, false);
assert.equal(actionRequired.rootCause, 'EXTERNAL_REVIEW_OR_APPROVAL_REQUIRED');

const waiting = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns.map((item) =>
    item.workflowName === 'FLIXO Test System' ? { ...item, status: 'in_progress', conclusion: null } : item),
  checkRuns: securityAndCertification,
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(waiting.status, 'WAITING_REQUIRED_CHECKS');

const missingRequiredOnExecution = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr: null,
  latestMergedPr: { headRefOid: SHA_B, mergeCommit: { oid: SHA_B } },
  workflowRuns: requiredRuns.filter((item) => item.workflowName !== 'FLIXO Test System'),
  checkRuns: securityAndCertification,
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(missingRequiredOnExecution.status, 'WAITING_REQUIRED_CHECKS');
assert.equal(missingRequiredOnExecution.repair.required, false);
assert(missingRequiredOnExecution.errors.some((item) => item.type === 'REQUIRED_WORKFLOW_MISSING'));

const postMergeExecutionAdvance = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr: null,
  latestMergedPr: { headRefOid: SHA_B, mergeCommit: { oid: SHA_B } },
  workflowRuns: requiredRuns, checkRuns: securityAndCertification,
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(postMergeExecutionAdvance.status, 'GREEN');
assert.equal(postMergeExecutionAdvance.errors.some((item) => item.type === 'POST_MERGE_MAIN_IDENTITY_MISMATCH'), false);

const postMergeHistoricalHead = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr: null,
  latestMergedPr: { headRefOid: 'c'.repeat(40), mergeCommit: { oid: SHA_B } },
  workflowRuns: requiredRuns, checkRuns: securityAndCertification,
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(postMergeHistoricalHead.status, 'GREEN');
assert.equal(postMergeHistoricalHead.errors.some((item) => item.type === 'POST_MERGE_MAIN_IDENTITY_MISMATCH'), false);

const postMergeMissingCommit = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr: null,
  latestMergedPr: { headRefOid: 'c'.repeat(40), mergeCommit: null },
  workflowRuns: requiredRuns, checkRuns: securityAndCertification,
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(postMergeMissingCommit.status, 'GREEN');
assert.equal(postMergeMissingCommit.errors.some((item) => item.type === 'POST_MERGE_MAIN_IDENTITY_MISMATCH'), false);

const postMerge = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr: null,
  latestMergedPr: { headRefOid: SHA_A, mergeCommit: { oid: SHA_B } },
  workflowRuns: requiredRuns, checkRuns: securityAndCertification,
  compare: { ahead_by: 0, behind_by: 1 },
});
assert.equal(postMerge.status, 'RED_INTERNAL');
assert(postMerge.errors.some((item) => item.type === 'MAIN_DIVERGENCE'));

const mainObservedFailure = evaluateGreen({
  executionSha: SHA_A,
  mainSha: SHA_A,
  observedBranch: 'main',
  openPr: null,
  latestMergedPr: null,
  workflowRuns: requiredRuns.map((item) =>
    item.workflowName === 'FLIXO Test System' ? { ...item, conclusion: 'failure', headBranch: 'main', databaseId: 1100 } : { ...item, headBranch: 'main' }),
  checkRuns: securityAndCertification,
  logs: { 1100: 'EVIDENCE_CAPTURE=AVAILABLE\nmain internal failure' },
  compare: { ahead_by: 0, behind_by: 0 },
});
assert.equal(mainObservedFailure.status, 'RED_INTERNAL');
assert.equal(mainObservedFailure.repair.required, false);

const watchTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-watch-contract-'));
const missingInput = path.join(watchTemp, 'missing-input.json');
const missingOutput = path.join(watchTemp, 'watch-report.json');
const missingRun = spawnSync(process.execPath, ['scripts/ci/continuous-error-watch.mjs', missingInput, missingOutput], { cwd: process.cwd(), encoding: 'utf8' });
assert.notEqual(missingRun.status, 0);
assert.equal(fs.existsSync(missingOutput), true);
const missingReport = JSON.parse(fs.readFileSync(missingOutput, 'utf8'));
assert.equal(missingReport.status, 'FAIL_CLOSED');
assert.equal(missingReport.rootCause, 'REQUIRED_EVIDENCE_MISSING');
assert.equal(missingReport.errors[0]?.type, 'WATCHER_INPUT_INVALID');
fs.rmSync(watchTemp, { recursive: true, force: true });

const dailyGateWorkflow = fs.readFileSync('.github/workflows/daily-flixo-green-gate.yml', 'utf8');
assert.ok(dailyGateWorkflow.includes('Normalize settled workflow-run evidence shape'));
assert.ok(dailyGateWorkflow.includes('databaseId: (.databaseId // .id // null)'));
assert.ok(dailyGateWorkflow.includes('workflowName: (.workflowName // .name // .display_title // "")'));
assert.ok(dailyGateWorkflow.includes('headSha: (.headSha // .head_sha // "")'));
assert.ok(dailyGateWorkflow.includes('headBranch: (.headBranch // .head_branch // "")'));
assert.ok(dailyGateWorkflow.includes('updatedAt: (.updatedAt // .updated_at // .completed_at // .started_at // "")'));
assert.ok(dailyGateWorkflow.includes('if type == "array" then . elif (.workflow_runs | type) == "array" then .workflow_runs else [] end'));
assert.ok(dailyGateWorkflow.includes("jq -e 'type == \"array\" and all(.[];"));
assert.ok(dailyGateWorkflow.includes('Ensure exact-SHA required CI is resident'));
const settlementBlock = dailyGateWorkflow.match(/name: Await required internal CI settlement on exact SHA[\s\S]*?(?=\n\s{6}- name:|$)/)?.[0] ?? '';
assert.ok(!dailyGateWorkflow.includes('declare -A REDISPATCHED=()'));
assert.ok(dailyGateWorkflow.includes('["FLIXO Test System"]="ci.yml"'));
assert.ok(dailyGateWorkflow.includes('SETTLEMENT_WAITING poll=$poll workflow=$workflow state=MISSING'));
assert.ok(!dailyGateWorkflow.includes('REDISPATCHED[$workflow]=1'));
assert.ok(!settlementBlock.includes('gh workflow run "$FILE" --repo "$GITHUB_REPOSITORY" --ref execution'));
assert.ok(dailyGateWorkflow.includes('FILE="${REQUIRED_FILES[$WORKFLOW]}"'));
assert.ok(!dailyGateWorkflow.includes('FILE="\\${REQUIRED_FILES[$WORKFLOW]}"'));
assert.ok(dailyGateWorkflow.includes('actions/runs?head_sha=$EXECUTION_SHA&per_page=100'));
assert.ok(dailyGateWorkflow.includes('.head_sha == $sha'));
assert.ok(!dailyGateWorkflow.includes('gh run list --repo "$GITHUB_REPOSITORY" --workflow'));
for (const file of [
  'ci.yml',
  'wp0-trust-baseline.yml',
  'test-impact.yml',
  'test-impact-execution.yml',
  'repository-security-baseline.yml',
  'claude-security-review.yml',
]) {
  assert.ok(dailyGateWorkflow.includes(file), 'daily gate must know required workflow file: ' + file);
}
console.log('CONTINUOUS_ERROR_WATCH_CONTRACT=PASS');