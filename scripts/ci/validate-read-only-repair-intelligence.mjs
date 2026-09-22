#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const target=path.resolve(root,'scripts/ci/read-only-repair-intelligence.mjs');
const test=path.resolve(root,'scripts/ci/test-read-only-repair-intelligence.mjs');
const failures=[];
const source=fs.readFileSync(target,'utf8');
const testSource=fs.readFileSync(test,'utf8');

for(const marker of [
 "protocol:'FLIXO-READ-ONLY-REPAIR-INTELLIGENCE-v1'",
 "mutationPolicy:'NO_SOURCE_MUTATION'",
 "buildCausalDiscriminator",
 "buildMetaCausalModel",
 "planRepair",
 "buildErrorOnlyRepairModel",
 "confidenceGate",
 "critiqueRepair",
 "buildRepairKnowledgeGraph",
 "buildMentorPacket",
 "buildActionVaultPrediction",
 "PREDICTIVE_REPAIR_PACKET_V1",
 "ADVERSARIAL_PROGRAMMER_FALSIFIER",
 "NO_MUTATION_AUTHORITY",
 "action-repair-programmer-twin.mjs",
 "READ_ONLY_REPAIR_INTELLIGENCE"
]) if(!source.includes(marker)) failures.push('MISSING_MARKER='+marker);

if(/git\s+(add|commit|push|reset|checkout)|update_file|create_file|delete_file|mergePullRequest|create_pull_request/u.test(source)) failures.push('MUTATION_API_OR_GIT_WRITE_DETECTED');
if(/fs\.writeFileSync\((?!logPath|selectionPath|diagnosisPath|outputPath|path\.dirname\(path\.resolve\(output\)\))/u.test(source)) failures.push('UNEXPECTED_WRITE_SURFACE');
if(!source.includes("authorityParity:'NO_MUTATION_AUTHORITY'")) failures.push('ADVERSARIAL_AUTHORITY_SEPARATION_MISSING');
if(!source.includes("actionVaultPrediction")) failures.push('ACTION_VAULT_PREDICTION_BINDING_MISSING');
if(!source.includes("OWNER_REVIEW_REQUIRED")) failures.push('ACTION_VAULT_OWNER_REVIEW_BOUNDARY_MISSING');
if(/mutationAuthority\s*[:=]\s*['\"](?:ACTION-REPAIR|AUTO|GRANTED)/u.test(source)) failures.push('ACTION_VAULT_MUTATION_AUTHORITY_LEAK');
if(!source.includes("mutationWouldBeAllowedByRepairStack")) failures.push('REPAIR_STACK_SIMULATION_MISSING');
if(!testSource.includes('SKIPPED_IN_UNIT_TEST')) failures.push('UNIT_BOUNDARY_MISSING');
if(!testSource.includes('actionVaultPrediction')) failures.push('ACTION_VAULT_UNIT_ASSERTION_MISSING');

const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const result={schemaVersion:1,authority:'READ_ONLY_REPAIR_INTELLIGENCE_CONTRACT',status:failures.length?'FAIL':'PASS',checkedSha:sha,failures};
fs.mkdirSync(path.resolve(root,'diagnostics/investigation'),{recursive:true});
fs.writeFileSync(path.resolve(root,'diagnostics/investigation/repair-intelligence-contract.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(failures.length) process.exit(1);
