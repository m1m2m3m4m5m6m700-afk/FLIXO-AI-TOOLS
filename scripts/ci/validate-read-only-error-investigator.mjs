#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const target=path.resolve(root,'scripts/ci/read-only-error-investigator.mjs');
const test=path.resolve(root,'scripts/ci/test-read-only-error-investigator.mjs');
const workflow=path.resolve(root,'.github/workflows/read-only-error-investigator.yml');
const failures=[];
const source=fs.readFileSync(target,'utf8');
const testSource=fs.readFileSync(test,'utf8');
const workflowSource=fs.readFileSync(workflow,'utf8');
const deepReasoning=path.resolve(root,'scripts/ci/read-only-deep-reasoning.mjs');
const deepTest=path.resolve(root,'scripts/ci/test-read-only-deep-reasoning.mjs');
const deepContract=path.resolve(root,'scripts/ci/validate-read-only-deep-reasoning.mjs');
const repairIntelligence=path.resolve(root,'scripts/ci/read-only-repair-intelligence.mjs');

const required=[
 "authority: 'READ_ONLY_ERROR_INVESTIGATOR'",
 "mode: 'READ_ONLY_ERROR_INTELLIGENCE'",
 "mutationPolicy: 'NO_SOURCE_MUTATION'",
 "decisionPolicy: 'Evidence-backed analysis only.",
 "exactShaVerified",
 "recurringPatterns",
 "rootCauseCandidates",
 "downstreamFailures",
 "staleEvidence",
 "securitySignals",
 "historicalSignals",
 "deepInference: buildDeepInference",
];

for(const marker of required) if(!source.includes(marker)) failures.push('MISSING_MARKER='+marker);

if(/git\s+(add|commit|push|reset|checkout)|update_file|create_file|delete_file|mergePullRequest|create_pull_request/u.test(source)) failures.push('FORBIDDEN_MUTATION_API_OR_GIT_OPERATION');
if(/fs\.writeFileSync\((?!output)/u.test(source)) failures.push('UNEXPECTED_FILE_WRITE_SURFACE');
if(!/gh['"],\s*\[\s*['"]run['"],\s*['"]list['"]/u.test(source)) failures.push('READ_ONLY_GH_RUN_LIST_MISSING');
if(!/['"]--log-failed['"]/u.test(source)) failures.push('READ_ONLY_FAILURE_LOG_CAPTURE_MISSING');
if(!/run\?\.headSha !== executionSha/u.test(source)) failures.push('EXACT_SHA_FILTER_MISSING');
if(!workflowSource.includes('contents: read') || !workflowSource.includes('actions: read')) failures.push('READ_ONLY_WORKFLOW_PERMISSIONS_MISSING');
if(workflowSource.includes('contents: write') || workflowSource.includes('actions: write')) failures.push('WRITE_PERMISSION_PRESENT');
if(!workflowSource.includes('ref: execution')) failures.push('EXECUTION_REF_NOT_PINNED');
if(!testSource.includes('CAPIError') || !testSource.includes('CI contract failed')) failures.push('ROOT_CAUSE_FIXTURES_MISSING');
if(!fs.existsSync(deepReasoning) || !fs.existsSync(deepTest) || !fs.existsSync(deepContract) || !fs.existsSync(repairIntelligence)) failures.push('DEEP_REASONING_SURFACE_MISSING');
if(!source.includes('buildDeepInference')) failures.push('DEEP_REASONING_INTEGRATION_MARKER_MISSING');

const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const result={schemaVersion:1,authority:'READ_ONLY_ERROR_INVESTIGATOR_CONTRACT',status:failures.length?'FAIL':'PASS',checkedSha:sha,failures};
fs.mkdirSync(path.resolve(root,'diagnostics/investigation'),{recursive:true});
fs.writeFileSync(path.resolve(root,'diagnostics/investigation/error-investigator-contract.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(failures.length) process.exit(1);
