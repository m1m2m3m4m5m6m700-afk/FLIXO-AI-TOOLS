#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildRepairIntelligenceMirror } from './read-only-repair-intelligence.mjs';
const sha='a'.repeat(40);
const log='CI contract failed: validate-ci-contract.mjs; CAPIError: provider model is not supported';
const report=buildRepairIntelligenceMirror({failureLog:log,targetSha:sha,historicalSignals:{}});
assert.equal(report.protocol,'FLIXO-READ-ONLY-REPAIR-INTELLIGENCE-v1');
assert.equal(report.mutationPolicy,'NO_SOURCE_MUTATION');
assert.equal(report.exactShaVerified,true);
assert.ok(report.primaryRepairIntelligence.planner);
assert.ok(report.primaryRepairIntelligence.errorOnlyModel);
assert.ok(report.primaryRepairIntelligence.causalDiscriminator);
assert.ok(report.primaryRepairIntelligence.metaCausalModel);
assert.ok(report.primaryRepairIntelligence.knowledgeGraph);
assert.ok(report.adversarial);
assert.equal(report.synthesis.readOnlyDecision,'REPORT_ONLY');
assert.equal(report.primaryRepairIntelligence.selfCriticPreview.verdict,'REJECT');
assert.equal(report.adversarial.authorityParity,'NO_MUTATION_AUTHORITY');
console.log(JSON.stringify({status:'PASS',checks:11,primary:report.synthesis.primaryCandidate,adversarial:report.adversarial.status},null,2));
