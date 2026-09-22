#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildFusion } from './read-only-knowledge-fusion.mjs';

const report=buildFusion({
  failureLog:'workflow concurrency stale sha exact target',
  diagnosis:{errorClass:'stale-sha',stage:'ci-control',rootCause:'stale-sha evidence'},
  targetSha:'b'.repeat(40),
  failedRunId:'KNOWLEDGE-FUSION-TEST',
  prediction:{
    similarCases:[],
    proposedRepair:{confidence:0}
  }
});

assert.equal(report.protocol,'FLIXO-READ-ONLY-KNOWLEDGE-FUSION-v1');
assert.equal(report.authority,'ADVISORY_ONLY');
assert.equal(report.mutationAuthority,false);
assert.equal(report.exactShaBound,true);
assert.equal(report.targetSha,'b'.repeat(40));
assert.ok(report.route.routerRuleCount>=5000);
assert.ok(report.route.matchedGroups.length>0);
assert.ok(report.route.selectedSources.some(x=>String(x).includes('ci-control')));
assert.ok(report.selectedAdvice.length>0);
assert.ok(report.antiLessons.length>0);
assert.ok(report.provenRuleHints.length>0);
assert.notEqual(report.synthesis.disposition,'NO_ACTIONABLE_KNOWLEDGE');
assert.equal(report.synthesis.needsAdversarialReview,true);
assert.equal(report.synthesis.proofAuthority,'CURRENT_EXACT_SHA_CI_ONLY');

console.log(JSON.stringify({
  status:'PASS',
  protocol:report.protocol,
  matchedGroups:report.route.matchedGroups.length,
  selectedAdvice:report.selectedAdvice.length,
  antiLessons:report.antiLessons.length,
  confidence:report.synthesis.confidence
},null,2));
