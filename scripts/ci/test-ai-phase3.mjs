#!/usr/bin/env node
import assert from 'node:assert/strict';
import { calibrateBayesianConfidence, clusterFailures, deriveEvolutionProposals, detectPredictiveAnomaly, selectContextualBandit } from './auto-repair/ai-phase3.mjs';

const current={fingerprint:'current-fp',rootCause:'lint',normalizedFailure:'lint unused variable src/example.ts',features:['lint','typescript']};
const memory={
  cases:[
    {fingerprint:'old-fp-1',rootCause:'lint',normalizedFailure:'lint unused variable src/other.ts',features:['lint','typescript'],attempts:2,successes:1,failures:1,externalBlocks:0,outcomes:[
      {outcome:'success',provenance:{strategyId:'diff-forensics'}},{outcome:'failure',provenance:{strategyId:'reproduce-exact'}}],revertedRules:[]},
    {fingerprint:'old-fp-2',rootCause:'lint',normalizedFailure:'lint unused variable src/third.ts',features:['lint'],attempts:2,successes:2,failures:0,externalBlocks:1,outcomes:[
      {outcome:'success',provenance:{strategyId:'diff-forensics'}},{outcome:'success',provenance:{strategyId:'diff-forensics'}},{outcome:'blocked-external',provenance:{strategyId:'diff-forensics'}}],revertedRules:[]},
  ],
  playbooks:[{rootCause:'lint',rule:'eslint-unused',attempts:3,successes:3,successRate:1,successfulFingerprints:['old-fp-1','old-fp-2']}],
  lessons:[],antiLessons:[],
};
const cluster=clusterFailures(memory,current);
assert(cluster.currentClusterSize>=3);
assert(cluster.relatedFingerprints.includes('old-fp-1'));
const bayes=calibrateBayesianConfidence({successes:2,failures:1,externalBlocks:7});
assert.equal(bayes.posteriorMean,0.6);
assert.equal(bayes.externalBlocksExcluded,true);
const bandit=selectContextualBandit(memory,current,'reproduce-exact');
assert.equal(bandit.algorithm,'BOUNDED_DETERMINISTIC_UCB_BETA');
assert.equal(bandit.advisoryOnly,true);
assert.equal(bandit.randomExploration,false);
assert(bandit.recommendation);
assert(bandit.topCandidates.length<=3);
const anomaly=detectPredictiveAnomaly({cases:[{fingerprint:'current-fp',attempts:3,successes:0,failures:3}]},cluster,current);
assert.equal(anomaly.status,'ANOMALOUS');
const evolution=deriveEvolutionProposals(memory);
assert.equal(evolution.proposals.length,1);
assert.equal(evolution.proposals[0].rule,'eslint-unused');
assert.equal(evolution.proposals[0].autoActivation,false);
console.log('AI_PHASE3_SELF_TEST=PASS');
