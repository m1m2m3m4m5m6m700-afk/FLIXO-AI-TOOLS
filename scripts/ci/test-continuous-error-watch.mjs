import assert from 'node:assert/strict';
import { evaluateGreen } from './continuous-error-watch.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const run = (workflowName, databaseId, conclusion = 'success') => ({
  workflowName,
  databaseId,
  headSha: SHA_A,
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

const external = evaluateGreen({
  executionSha: SHA_A, mainSha: SHA_B, openPr,
  workflowRuns: requiredRuns,
  checkRuns: [...securityAndCertification, { id: 103, name: 'Vercel', status: 'completed', conclusion: 'failure' }],
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(external.status, 'BLOCKED_EXTERNAL');
assert.equal(external.repair.required, false);

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
    { id: 104, name: 'github-advanced-security', status: 'completed', conclusion: 'failure' },
    { id: 102, name: 'Certification', status: 'completed', conclusion: 'success' },
  ],
  logs: { 104: 'CAPIError: 400 The requested model is not supported' },
  compare: { ahead_by: 1, behind_by: 0 },
});
assert.equal(securityProvider.status, 'BLOCKED_EXTERNAL');
assert.equal(securityProvider.externalBlockers[0].rootCause, 'EXTERNAL_SECURITY_PROVIDER_FAILURE');

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
