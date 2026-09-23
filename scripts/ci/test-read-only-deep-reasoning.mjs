#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildDeepInference } from './read-only-deep-reasoning.mjs';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

const observed = [
  {
    runId: 1,
    workflow: 'FLIXO WP0 Trust Baseline',
    headSha: SHA,
    updatedAt: '2026-09-22T05:00:00Z',
    classification: 'INTERNAL_CONTRACT',
    features: ['contract-drift'],
    salientEvidence: ['CI contract failed: validate-ci-contract'],
  },
  {
    runId: 2,
    workflow: 'FLIXO WP0 Trust Baseline',
    headSha: SHA,
    updatedAt: '2026-09-22T05:05:00Z',
    classification: 'INTERNAL_CONTRACT',
    features: ['contract-drift'],
    salientEvidence: ['CI contract failed: validate-ci-contract'],
  },
  {
    runId: 3,
    workflow: 'FLIXO Auto Repair Merge Gate',
    headSha: SHA,
    updatedAt: '2026-09-22T05:06:00Z',
    classification: 'DOWNSTREAM_FAILURE',
    upstreamWorkflow: 'FLIXO WP0 Trust Baseline',
    features: [],
    salientEvidence: ['FAIL CLOSED: RED workflow=FLIXO WP0 Trust Baseline'],
  },
  {
    runId: 4,
    workflow: 'Code scanning AI findings',
    headSha: SHA,
    updatedAt: '2026-09-22T05:07:00Z',
    classification: 'BLOCKED_EXTERNAL',
    features: ['external-tooling'],
    salientEvidence: ['SessionModelError: CAPIError 400 The requested model is not supported'],
  },
  {
    runId: 5,
    workflow: 'Historical Test',
    headSha: OTHER,
    updatedAt: '2026-09-22T05:08:00Z',
    classification: 'STALE_EVIDENCE',
    features: [],
    salientEvidence: ['old failure'],
  },
];

const report = buildDeepInference({
  executionSha: SHA,
  observed,
  historicalSignals: {
    memoryLessons: [{ fingerprint: 'x', rootCause: 'contract-drift' }],
    knownRootCauses: [{ id: 'RC1', category: 'CI_CONTRACT' }],
  },
  securityFindings: [{ tool: 'CodeQL', rule: { id: 'TEST' } }],
  recurringPatterns: [{ recurringSignature: 'r1', occurrences: 2 }],
  downstreamFailures: [observed[2]],
  staleEvidence: [observed[4]],
  fullRepairIntelligence: false,
});

assert.equal(report.protocol, 'FLIXO-DEEP-READ-ONLY-INFERENCE-v1');
assert.equal(report.executionSha, SHA);
assert.equal(report.graph.edgeCount > 0, true);
assert.equal(report.timeline.length, 5);
assert.equal(report.evidenceDiversity.diversity > 0.5, true);
assert.equal(report.causalDiscriminator.protocol,'CAUSAL-DISCRIMINATOR-v1');
assert.equal(report.metaCausalModel.protocol,'META-CAUSAL-MODEL-v1');
assert.equal(report.metaCausalModel.mutationAllowed,false);
assert.equal(report.repairIntelligence.primaryRepairIntelligence.codeMentor.status,'SKIPPED_IN_UNIT_TEST');
assert.equal(report.repairIntelligence.programmerTwin.status,'SKIPPED_IN_UNIT_TEST');
assert.equal(report.hypotheses.some((h) => h.id === 'H-INTERNAL_CONTRACT'), true);
assert.equal(report.falsification.length > 0, true);
assert.equal(report.counterfactuals.length > 0, true);
assert.equal(report.synthesis.noMutationAuthority, true);
assert.equal(report.synthesis.requiresIndependentVerification, true);
assert.equal(['CANDIDATE_ROOT_CAUSE','UNKNOWN_RCA','EXTERNAL_BLOCKED'].includes(report.synthesis.status), true);
console.log(JSON.stringify({ status: 'PASS', checks: 11, selected: report.synthesis.selectedHypothesis }, null, 2));

assert.equal(report.powerProfile,'5X');
