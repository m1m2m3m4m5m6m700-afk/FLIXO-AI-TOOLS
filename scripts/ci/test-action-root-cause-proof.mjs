import assert from 'node:assert/strict';
import { buildRootCauseProof } from './action-root-cause-proof.mjs';

const diagnosis={
 rootCause:'DOM_SINK',
 causalConfidence:0.92,
 diagnosisQuality:'strong',
 ambiguity:false,
 directFailureSignal:true,
 location:{file:'src/example.ts'},
 features:['security'],
 errorCodes:['CODEQL_DOM_SINK'],
 hypotheses:[
  {id:'DOM_SINK',score:0.94,evidenceLines:['failure at src/example.ts:10','DOM sink warning']},
  {id:'WRONG_FILE',score:0.71,evidenceLines:['caller surface inspected'],suppressedBy:'DIRECT_SIGNAL_DOM_SINK'}
 ],
 causalGraph:{
  trigger:'CodeQL finding',
  propagationPath:['CodeQL finding','DOM_SINK','src/example.ts','observable failure'],
  violatedInvariant:'NO_UNTRUSTED_DOM_SINK',
  responsibleSource:'src/example.ts',
  observableSymptom:'DOM sink warning',
 },
 verificationStrategy:{targeted:['node --check src/example.ts']}
};
const selection={decision:'SELECTED',targetSha:'a'.repeat(40),failureFingerprint:'fp',selectedFiles:[{path:'src/example.ts'}],excludedFiles:[]};
const proof=buildRootCauseProof({
 targetSha:'a'.repeat(40),
 failureFingerprint:'fp',
 failedRunId:'123',
 diagnosis,
 strategy:{strategyId:'fix-dom-sink'},
 fileSelection:selection,
 failureLog:'ERROR CODEQL_DOM_SINK src/example.ts:10'
});
assert.equal(proof.status,'PROVEN');
assert.equal(proof.protocol,'CAUSAL-EVIDENCE-GRAPH-v1');
assert.equal(proof.chain.rootCause,'DOM_SINK');
assert.equal(proof.graph.responsibleSource,'src/example.ts');
assert.equal(proof.proofClaims.ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL,true);
assert.equal(proof.proofClaims.LOCATION_LINKED_TO_CAUSE,true);
assert.equal(proof.proofClaims.ALTERNATIVES_CHALLENGED,true);
assert.equal(proof.sourceMutationAllowed,false);

const blocked=buildRootCauseProof({
 targetSha:'a'.repeat(40),
 failureFingerprint:'fp',
 failedRunId:'123',
 diagnosis:{...diagnosis,ambiguity:true},
 strategy:{strategyId:'x'},
 fileSelection:selection,
 failureLog:'ERROR'
});
assert.equal(blocked.status,'BLOCK');
assert.ok(blocked.failures.includes('RCA_UNRESOLVED_AMBIGUITY'));
console.log('ACTION_ROOT_CAUSE_PROOF=PASS');