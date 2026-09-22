#!/usr/bin/env node
import assert from 'node:assert/strict';
import { runInvestigator } from './read-only-error-investigator.mjs';

const SHA='a'.repeat(40);
const OTHER='b'.repeat(40);
const runs=[
  {databaseId:101,workflowName:'FLIXO WP0 Trust Baseline',status:'completed',conclusion:'failure',headSha:SHA,headBranch:'execution',updatedAt:'2026-09-22T05:00:00Z',log:'CI contract failed: ci.yml must converge push/pull_request observations into one concurrency lane per canonical branch/SHA.'},
  {databaseId:102,workflowName:'FLIXO WP0 Trust Baseline',status:'completed',conclusion:'failure',headSha:SHA,headBranch:'execution',updatedAt:'2026-09-22T05:05:00Z',log:'CI contract failed: ci.yml must converge push/pull_request observations into one concurrency lane per canonical branch/SHA.'},
  {databaseId:103,workflowName:'FLIXO Auto Repair Merge Gate',status:'completed',conclusion:'failure',headSha:SHA,headBranch:'execution',updatedAt:'2026-09-22T05:06:00Z',log:'FAIL CLOSED: RED workflow=FLIXO WP0 Trust Baseline conclusion=failure'},
  {databaseId:104,workflowName:'Code scanning AI findings',status:'completed',conclusion:'failure',headSha:SHA,headBranch:'execution',updatedAt:'2026-09-22T05:07:00Z',log:'SessionModelError: Execution failed: CAPIError: 400 The requested model is not supported.'},
  {databaseId:105,workflowName:'Historical Test',status:'completed',conclusion:'failure',headSha:OTHER,headBranch:'execution',updatedAt:'2026-09-22T05:08:00Z',log:'CI contract failed: stale historical failure'},
  {databaseId:106,workflowName:'FLIXO Test System',status:'completed',conclusion:'cancelled',headSha:SHA,headBranch:'execution',updatedAt:'2026-09-22T05:10:00Z',log:''},
  {databaseId:107,workflowName:'FLIXO Test System',status:'completed',conclusion:'success',headSha:SHA,headBranch:'execution',updatedAt:'2026-09-22T05:11:00Z',log:''},
];

const report=runInvestigator({observedBranch:'execution',executionSha:SHA,mainSha:'c'.repeat(40),runs});
assert.equal(report.authority,'READ_ONLY_ERROR_INVESTIGATOR');
assert.equal(report.mutationPolicy,'NO_SOURCE_MUTATION');
assert.equal(report.exactShaVerified,true);
assert.equal(report.summary.recurringPatterns,1);
assert.equal(report.rootCauseCandidates.some((x)=>x.workflow==='FLIXO WP0 Trust Baseline'),true);
assert.equal(report.rootCauseCandidates.some((x)=>x.classification==='BLOCKED_EXTERNAL'),true);
assert.equal(report.downstreamFailures.some((x)=>x.workflow==='FLIXO Auto Repair Merge Gate'),true);
assert.equal(report.staleEvidence.length,2);
assert.equal(report.staleEvidence.some((x)=>x.runId===105),true);
assert.equal(report.staleEvidence.some((x)=>x.runId===106),true);
assert.equal(report.staleEvidence.some((x)=>x.classification==='CANCELLED_SUPERSEDED'),true);
assert.equal(report.securitySignals.some((x)=>x.runId===104),true);
console.log(JSON.stringify({status:'PASS',checks:11},null,2));
