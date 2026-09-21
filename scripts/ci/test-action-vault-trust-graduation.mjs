#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runGate } from './action-vault-agent-gate.mjs';

const profile=JSON.parse(fs.readFileSync('diagnostics/auto-repair/action-vault/ACTION-VAULT-TRUST-GRADUATION.json','utf8'));
assert.equal(profile.schemaVersion,1);
assert.equal(profile.currentAuthority,'DAILY_FLIXO_GREEN_GATE');
assert.equal(profile.immutableBoundaries.mutationBranch,'execution');
assert.equal(profile.immutableBoundaries.soleMutationOwner,'ACTION-REPAIR');
assert.equal(profile.immutableBoundaries.independentVerifier,'ACTION-REPAIR-2');
assert.equal(profile.immutableBoundaries.historian,'ACTION-HISTORIAN-3');
assert.equal(profile.immutableBoundaries.selfCertification,false);
assert.equal(profile.graduationRequirements.minimumVerifiedMissions,3);
assert.equal(profile.graduationRequirements.minimumDistinctFailureFingerprints,3);
assert.equal(profile.graduationRequirements.minimumVerifiedGreenRecords,3);
assert.equal(profile.graduationRequirements.minimumIndependentChallengeProofs,3);
assert.equal(profile.graduationRequirements.minimumRecoveryOrHandoffProofs,1);
assert.equal(profile.missionProof.requiredGreenSource,'DAILY_FLIXO_GREEN_GATE');
assert.equal(profile.missionProof.requiredExactShaVerified,true);
assert.equal(profile.revalidationTriggers.length>=5,true);


// Permanent residency: no sleep/freeze/idle/withdrawal, including after GREEN.
const residency=JSON.parse(fs.readFileSync('diagnostics/auto-repair/action-vault/ACTION-RESIDENCY-POLICY.json','utf8'));
assert.equal(residency.schemaVersion,3);
assert.equal(residency.residency.alwaysResident,true);
assert.equal(residency.residency.leaveVault,false);
assert.equal(residency.residency.sleepState,'PERMANENTLY_FORBIDDEN');
assert.equal(residency.residency.noSleepAfterGreen,true);
assert.equal(residency.residency.noIdleAfterGreen,true);
assert.equal(residency.residency.noFreeze,true);
assert.equal(residency.residency.noWithdrawal,true);
assert.equal(residency.residency.postGreenState,'READY_RESIDENT');
assert.equal(residency.residency.sleepAdmissionMode,'DENY_ALL_STATES');

const gate=runGate(process.cwd());
assert.equal(gate.errors.length,0,gate.errors.join('\n'));
for(const file of [
  '.github/workflows/auto-repair.yml',
  'scripts/ci/action-three-bot-collaboration.mjs',
  'scripts/ci/action-repair-dual-control.mjs',
  'scripts/ci/action-repair-engineering.mjs'
]) assert.equal(fs.existsSync(file),true,file);

console.log(JSON.stringify({
  status:'PASS',
  authority:'ACTION_VAULT_TRUST_GRADUATION_CONTRACT_TEST',
  assertions:24
},null,2));
