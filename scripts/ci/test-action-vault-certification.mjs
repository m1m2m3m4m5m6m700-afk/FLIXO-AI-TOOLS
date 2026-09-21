import assert from 'node:assert/strict';
import { evaluateCertification } from './action-vault-certification.mjs';

const sha='a'.repeat(40);
const green={source:'DAILY_FLIXO_GREEN_GATE',conclusion:'success',zeroRed:true,exactShaVerified:true,targetSha:sha,recordId:'GREEN-1'};
const globalChecks={
 allIntelligenceTestsPass:true,allSecurityTestsPass:true,allProofTestsPass:true,allFalsificationTestsPass:true,
 allSimulationTestsPass:true,allDifferentialTestsPass:true,allRegressionTestsPass:true,
 noSkippedTests:true,noContinueOnError:true,noWeakenedGate:true,noFalsePositive:true,noFalseGreen:true,noStaleProof:true,noUnresolvedCounterexample:true
};
const ok=evaluateCertification({
 benchmarkScore:100,benchmarkVersion:'ACTION-VAULT-INTELLIGENCE-BENCHMARK-v1',
 testedCapabilities:['cognitive','causal'],passedTests:['all'],failedTests:[],blockedCases:[],
 proofArtifacts:['P1'],simulationArtifacts:['S1'],differentialArtifacts:['D1'],falsificationArtifacts:['F1'],
 exactSha:sha,executionSha:sha,canonicalGreenRecord:green,projectRedCount:0,globalChecks,
});
assert.equal(ok.certificationStatus,'100/100 VERIFIED');
assert.equal(ok.score,100);

const blocked=evaluateCertification({
 benchmarkScore:100,benchmarkVersion:'ACTION-VAULT-INTELLIGENCE-BENCHMARK-v1',
 testedCapabilities:[],passedTests:['all'],failedTests:[],blockedCases:[],
 proofArtifacts:[],simulationArtifacts:[],differentialArtifacts:[],falsificationArtifacts:[],
 exactSha:sha,executionSha:sha,canonicalGreenRecord:null,projectRedCount:0,globalChecks,
});
assert.equal(blocked.certificationStatus,'NOT_CERTIFIED');
assert.equal(blocked.score,0);
console.log('ACTION_VAULT_CERTIFICATION=PASS');