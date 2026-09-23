#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const source=fs.readFileSync('scripts/ci/shared-operational-memory.mjs','utf8');
const test=fs.readFileSync('scripts/ci/test-shared-operational-memory-contract.mjs','utf8');
const contract=fs.readFileSync('docs/agents/SHARED-SIX-BOT-OPERATIONAL-MEMORY-CONTRACT.md','utf8');
const meshSync=fs.readFileSync('scripts/ci/sync-cognitive-learning-mesh.mjs','utf8');
const registry=JSON.parse(fs.readFileSync('docs/agents/FLIXO-BOT.json','utf8'));
const expectedBots=registry?.distribution?.learningConsumers??[];
const failures=[];
for(const marker of [
 'FLIXO-SHARED-OPERATIONAL-MEMORY-v1','SHARED_BOTS','ACTION-REPAIR','ACTION-REPAIR-2',
 'READ-INVESTIGATOR','READ-ADVERSARY','executionAgent','reviewAgent','execution-agent-clone-v1',
 'ERROR','OPERATION','ADVICE','OBLIGATION','LESSON','ANTI_LESSON','COUNTEREXAMPLE','VERIFICATION',
 'exactShaBound:true','mutationAuthority:false','certificationAuthority:false',
 'publishSharedMemory','buildSharedLearningContext','FLIXO_BOT_REGISTRY_PATH','docs/agents/FLIXO-BOT.json','SYSTEM_WIDE'
]) if(!source.includes(marker)) failures.push('MISSING_MARKER='+marker);
for(const marker of ['FLIXO-BIDIRECTIONAL-COGNITIVE-MESH-v1']) if(!contract.includes(marker)) failures.push('MISSING_CONTRACT_MARKER='+marker);
for(const marker of ['FLIXO-BIDIRECTIONAL-COGNITIVE-MESH-v1','flixo_agent_learning_events']) if(!meshSync.includes(marker)) failures.push('MISSING_SYNC_MARKER='+marker);
if(!fs.existsSync('scripts/ci/sync-cognitive-learning-mesh.mjs')) failures.push('SYNC_SCRIPT_MISSING');
if(/git\s+(add|commit|push|reset|checkout)|mergePullRequest|create_pull_request/u.test(source)) failures.push('GIT_MUTATION_FORBIDDEN');
if(!test.includes('SHARED_OPERATIONAL_MEMORY_CONTRACT_TEST=PASS')) failures.push('TEST_MARKER_MISSING');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(expectedBots.length<7) failures.push('GLOBAL_AUDIENCE_TOO_SMALL');
if(new Set(expectedBots).size!==expectedBots.length) failures.push('GLOBAL_AUDIENCE_DUPLICATE');
for(const id of ['ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3','assistantController','MASTER-1','MASTER-2','MASTER-3','executionAgent','reviewAgent','execution-agent-clone-v1','SECURITY-REDTEAM-3']) if(!expectedBots.includes(id)) failures.push('GLOBAL_AUDIENCE_MISSING='+id);
if(expectedBots.includes('ACTION-WAKE')||expectedBots.some(id=>/^CELL-\\d{3}$/u.test(id))) failures.push('RETIRED_ID_IN_GLOBAL_AUDIENCE');
const result={schemaVersion:2,authority:'FLIXO_BOT_SYSTEM_WIDE_SHARED_MEMORY_CONTRACT',status:failures.length?'FAIL':'PASS',checkedSha:sha,targetBotCount:expectedBots.length,failures};
console.log(JSON.stringify(result,null,2));
if(failures.length) process.exit(1);