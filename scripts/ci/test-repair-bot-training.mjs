import assert from 'node:assert/strict';
import { trainRepairBot, CURRICULUM, STRATEGIES } from './repair-bot-training.mjs';

const sample = {
  cases: [
    { fingerprint:'aa', rootCause:'lint', outcomes:[
      { outcome:'success', provenance:{strategyId:'reproduce-exact'} },
      { outcome:'failure', provenance:{strategyId:'minimize-failure'} }
    ] },
    { fingerprint:'bb', rootCause:'lint', outcomes:[
      { outcome:'success', provenance:{strategyId:'reproduce-exact'} },
      { outcome:'failure', provenance:{strategyId:'alternate-hypothesis'} }
    ] }
  ],
  playbooks:[],lessons:[],
  antiLessons:[{fingerprint:'cc',rootCause:'lint',rule:'minimize-failure'}],
  actionHistory:[{fingerprint:'dd',rootCause:'lint',rejectedStrategies:['alternate-hypothesis']}]
};
const report=trainRepairBot({memory:sample,log:''});
assert.equal(report.protocol,'FLIXO-REPAIR-BOT-BEHAVIORAL-TRAINING-v1');
assert.equal(report.authority,'TRAINING_ONLY');
assert.equal(report.curriculum.length,CURRICULUM.length);
assert.deepEqual(Object.keys(report.policy.global),STRATEGIES);
assert.ok(report.dataset.positiveExamples>=2);
assert.ok(report.dataset.negativeExamples>=2);
assert.ok(report.decision.rule.includes('NEVER_GRANTS_MUTATION'));
assert.ok(report.decision.eligibilityChecks);
assert.equal(typeof report.decision.eligibilityChecks.mastery,'boolean');
assert.equal(typeof report.decision.eligibleToInfluenceRouting,'boolean');
assert.ok(report.curriculum.every((item)=>['MASTERED','TRAINING','UNSEEN'].includes(item.status)));
assert.equal(report.behaviorModel.epochs,5);
assert.ok(report.behaviorEvaluation);
assert.ok(report.competency);
console.log('REPAIR_BOT_TRAINING_CONTRACT_SELF_TEST=PASS');
