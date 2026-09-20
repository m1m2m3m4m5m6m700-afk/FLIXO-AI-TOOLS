#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const file=path.resolve(ROOT,'diagnostics/auto-repair/action-vault/ACTION-VAULT-AUTONOMY-MODE.json');
const read=JSON.parse(fs.readFileSync(file,'utf8'));
const errors=[];
const eq=(name,a,b)=>{if(a!==b)errors.push(name+'='+String(a))};
eq('schemaVersion',read.schemaVersion,1);
eq('mode',read.mode,'BOT_FIRST_AUTONOMOUS');
eq('defaultExecutor',read.defaultExecutor,'ACTION-REPAIR');
eq('routineHumanApprovalRequired',read.routineHumanApprovalRequired,false);
eq('criticalHumanAuthorizationRequired',read.criticalHumanAuthorizationRequired,true);
eq('dispatchAuthority',read.dispatchAuthority,'DAILY_FLIXO_GREEN_GATE');
eq('certificationAuthority',read.certificationAuthority,'DAILY_FLIXO_GREEN_GATE');
eq('branch',read.executionContract?.branch,'execution');
eq('oneActiveMutationOwner',read.executionContract?.oneActiveMutationOwner,true);
eq('exactShaRequired',read.executionContract?.exactShaRequired,true);
eq('verifierRequiredBeforeMutation',read.executionContract?.verifierRequiredBeforeMutation,true);
eq('targetedRegressionRequired',read.executionContract?.targetedRegressionRequired,true);
eq('canonicalGreenRequiredForClosure',read.executionContract?.canonicalGreenRequiredForClosure,true);
eq('botMayOperateRoutinelyWithoutHuman',read.trustBoundary?.botMayOperateRoutinelyWithoutHuman,true);
eq('botMayCertify',read.trustBoundary?.botMayCertify,false);
eq('botMayGrantPermissions',read.trustBoundary?.botMayGrantPermissions,false);
eq('botMayWriteMain',read.trustBoundary?.botMayWriteMain,false);
eq('botMayModifyTests',read.trustBoundary?.botMayModifyTests,false);
if(JSON.stringify(read.requiredCollaborators)!==JSON.stringify(['ACTION-REPAIR-2','ACTION-HISTORIAN-3']))errors.push('requiredCollaborators');
if(!Array.isArray(read.autonomyScope?.allowed)||read.autonomyScope.allowed.length<5)errors.push('autonomyScope.allowed');
if(!Array.isArray(read.autonomyScope?.prohibited)||read.autonomyScope.prohibited.length<5)errors.push('autonomyScope.prohibited');
if(!Array.isArray(read.failureBehavior?.criticalPath)||read.failureBehavior.criticalPath!=='STOP_AND_REQUIRE_HUMAN_AUTHORIZATION'){}
if(read.failureBehavior?.criticalPath!=='STOP_AND_REQUIRE_HUMAN_AUTHORIZATION')errors.push('criticalPath');
if(read.failureBehavior?.staleSha!=='FAIL_CLOSED_AND_REQUALIFY')errors.push('staleSha');
if(read.failureBehavior?.externalFailure!=='CLASSIFY_EXTERNAL_NO_SOURCE_MUTATION')errors.push('externalFailure');

const workflow=fs.readFileSync(path.resolve(ROOT,'.github/workflows/auto-repair.yml'),'utf8');
if(!workflow.includes('FLIXO_REPAIR_OPERATING_MODE: BOT_FIRST_AUTONOMOUS'))errors.push('workflow_mode_missing');
if(!workflow.includes('FLIXO_ROUTINE_HUMAN_APPROVAL: \'false\''))errors.push('workflow_routine_approval_missing');
if(!workflow.includes('FLIXO_CRITICAL_HUMAN_AUTH_REQUIRED: \'true\''))errors.push('workflow_critical_auth_missing');
if(!workflow.includes('ACTION-VAULT-AUTONOMY-MODE'))errors.push('workflow_policy_reference_missing');

if(errors.length){
 console.error(JSON.stringify({status:'FAIL',errors},null,2));
 process.exit(1);
}
console.log(JSON.stringify({status:'PASS',mode:read.mode,defaultExecutor:read.defaultExecutor,routineHumanApprovalRequired:read.routineHumanApprovalRequired,criticalHumanAuthorizationRequired:read.criticalHumanAuthorizationRequired},null,2));
