import assert from 'node:assert/strict';
import { evaluateGreen, classifyCancelledRun, validateRepairTarget } from './continuous-error-watch.mjs';

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

const green = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns, checkRuns: securityAndCertification,
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(green.status, 'GREEN');

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
assert.equal(cancelledUnsuperseded.status, 'RED_INTERNAL');
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
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(internal.status, 'RED_INTERNAL');
assert.equal(internal.repair.required, true);
assert.equal(internal.repair.targetRunId, 999);
assert.match(internal.repair.failureFingerprint, /^[0-9a-f]{64}$/);
assert.equal(internal.repair.repairKey, SHA_A + ':' + internal.repair.failureFingerprint);

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
assert.equal(missing.status, 'FAIL_CLOSED');

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

const postMerge = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr: null,
  latestMergedPr: { headRefOid: SHA_A, mergeCommit: { oid: SHA_B } },
  workflowRuns: requiredRuns, checkRuns: securityAndCertification,
  compare: { ahead_by: 0, behind_by: 1 },
});
assert.equal(postMerge.status, 'GREEN');

console.log('CONTINUOUS_ERROR_WATCH_CONTRACT=PASS');
