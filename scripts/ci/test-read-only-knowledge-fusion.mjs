#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildFusion, arbitrateKnowledge } from './read-only-knowledge-fusion.mjs';

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
assert.ok(report.arbitration);
assert.equal(report.arbitration.protocol,'FLIXO-KNOWLEDGE-ARBITRATION-v1');
assert.equal(report.arbitration.mutationAuthority,false);
assert.equal(report.arbitration.exactShaBound,true);
assert.equal(report.arbitration.targetSha,'b'.repeat(40));
assert.equal(typeof report.arbitration.decision,'string');
assert.equal(report.arbitration.requiresCurrentExactShaEvidence,true);

const conflict=arbitrateKnowledge({
  targetSha:'c'.repeat(40),
  selectedAdvice:[
    {kind:'TEACHING',id:'A',text:'Never retry the external provider.',score:0.71},
    {kind:'TEACHING',id:'B',text:'Retry the external provider and continue.',score:0.69}
  ],
  antiLessons:[{kind:'ANTI_LESSON',text:'Never retry the external provider.',score:0.9}],
  predictionConfidence:0.2,
  routeConfidence:0.5
});
assert.equal(conflict.decision,'REJECT_ALL');
assert.equal(conflict.blocksMutation,true);
assert.ok(conflict.conflictCount>0);

const coherent=arbitrateKnowledge({
  targetSha:'d'.repeat(40),
  selectedAdvice:[
    {kind:'CANONICAL_INDEX',id:'T5001',text:'Bind stale SHA evidence to the current execution SHA before analysis.',score:0.93}
  ],
  antiLessons:[],
  predictionConfidence:0.9,
  routeConfidence:1
});
assert.equal(coherent.decision,'SELECT_WITH_EVIDENCE');
assert.equal(coherent.selectedAdviceId,'T5001');
assert.equal(coherent.blocksMutation,false);

console.log(JSON.stringify({
  status:'PASS',
  protocol:report.protocol,
  matchedGroups:report.route.matchedGroups.length,
  selectedAdvice:report.selectedAdvice.length,
  antiLessons:report.antiLessons.length,
  confidence:report.synthesis.confidence
},null,2));
