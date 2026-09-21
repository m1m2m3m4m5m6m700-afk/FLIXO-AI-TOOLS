import assert from 'node:assert/strict';
import { promoteVerifiedLearning } from './action-vault-learning-promotion.mjs';

const sha='a'.repeat(40);
const green={source:'DAILY_FLIXO_GREEN_GATE',conclusion:'success',zeroRed:true,exactShaVerified:true,targetSha:sha,taskId:'T1',fingerprint:'fp1',recordId:'GREEN-1'};
const verified=promoteVerifiedLearning({
 taskId:'T1',fingerprint:'fp1',targetSha:sha,executionSha:sha,proofIds:['P1','P2'],greenRecord:green,lesson:{rootCause:'x'}
});
assert.equal(verified.status,'VERIFIED');
assert.equal(verified.greenRecordId,'GREEN-1');
assert.deepEqual(verified.proofIds,['P1','P2']);

assert.throws(()=>promoteVerifiedLearning({
 taskId:'T1',fingerprint:'fp1',targetSha:sha,executionSha:sha,proofIds:['P1'],greenRecord:{...green,conclusion:'failure'},lesson:{}
}),/CANONICAL_GREEN_REQUIRED/u);
assert.throws(()=>promoteVerifiedLearning({
 taskId:'T1',fingerprint:'fp1',targetSha:sha,executionSha:'b'.repeat(40),proofIds:['P1'],greenRecord:green,lesson:{}
}),/GREEN_SHA_MISMATCH/u);
console.log('ACTION_VAULT_LEARNING_PROMOTION=PASS');