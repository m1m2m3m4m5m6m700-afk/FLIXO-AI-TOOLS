#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const source=fs.readFileSync('scripts/ci/shared-operational-memory.mjs','utf8');
const test=fs.readFileSync('scripts/ci/test-shared-operational-memory-contract.mjs','utf8');
const failures=[];
for(const marker of [
 'FLIXO-SHARED-OPERATIONAL-MEMORY-v1','SHARED_BOTS','ACTION-REPAIR','ACTION-REPAIR-2',
 'READ-INVESTIGATOR','READ-ADVERSARY','executionAgent','reviewAgent',
 'ERROR','OPERATION','ADVICE','OBLIGATION','LESSON','ANTI_LESSON','COUNTEREXAMPLE','VERIFICATION',
 'exactShaBound:true','mutationAuthority:false','certificationAuthority:false',
 'publishSharedMemory','buildSharedLearningContext'
]) if(!source.includes(marker)) failures.push('MISSING_MARKER='+marker);
if(/git\s+(add|commit|push|reset|checkout)|mergePullRequest|create_pull_request/u.test(source)) failures.push('GIT_MUTATION_FORBIDDEN');
if(!test.includes('SHARED_OPERATIONAL_MEMORY_CONTRACT_TEST=PASS')) failures.push('TEST_MARKER_MISSING');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const result={schemaVersion:1,authority:'SHARED_OPERATIONAL_MEMORY_CONTRACT',status:failures.length?'FAIL':'PASS',checkedSha:sha,targetBotCount:6,failures};
console.log(JSON.stringify(result,null,2));
if(failures.length) process.exit(1);
