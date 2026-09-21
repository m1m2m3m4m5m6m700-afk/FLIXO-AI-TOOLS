#!/usr/bin/env node
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir=mkdtempSync(path.join(tmpdir(),'flixo-primary-proof-'));
const write=(name,value)=>{const file=path.join(dir,name);writeFileSync(file,JSON.stringify(value,null,2));return file;};
const sha='a'.repeat(40);
const diagnosis=write('diagnosis.json',{
  diagnosisQuality:'strong',causalConfidence:0.94,ambiguity:false,directFailureSignal:true,
  rootCause:'eslint-unused',location:{file:'src/example.ts'}
});
const strategy=write('strategy.json',{strategyId:'eslint-unused'});
const fileSelection=write('selection.json',{
  protocol:'ACTION-FILE-SELECTION-INTELLIGENCE-v1',agentId:'ACTION-HISTORIAN-3',
  decision:'SELECTED',targetSha:sha,failureFingerprint:'fp',
  selectedFiles:[{path:'src/example.ts'}],excludedFiles:[]
});
const rootCauseProof=write('root-cause-proof.json',{
  protocol:'CAUSAL-EVIDENCE-GRAPH-v1',status:'PROVEN',targetSha:sha,failureFingerprint:'fp',sourceMutationAllowed:false,digest:'d'.repeat(64),
  chain:{rootCause:'eslint-unused'},graph:{responsibleSource:'src/example.ts'},proofClaims:{ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL:true,LOCATION_LINKED_TO_CAUSE:true,MECHANISM_EXPLAINED:true,ALTERNATIVES_CHALLENGED:true}
});
const awareness=write('awareness.json',{
  protocol:'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1',
  targetSha:sha,
  failureFingerprint:'fp',
  exactShaBound:true,
  awarenessCompleteness:{requiredDomains:['TASK_SEMANTICS','REPOSITORY_CONTEXT','CAUSAL_CONTEXT','HISTORICAL_CONTEXT','SAFETY_GOVERNANCE','ADVERSARIAL_CONTEXT','OPERATIONAL_CONTEXT','TEMPORAL_CONTEXT','SYSTEMIC_IMPACT'],complete:true}
});
const out=path.join(dir,'proof.json');
execFileSync(process.execPath,['scripts/ci/action-primary-correctness-proof.mjs','--task=task','--run-id=1','--sha='+sha,'--fingerprint=fp','--diagnosis='+diagnosis,'--strategy='+strategy,'--file-selection='+fileSelection,'--root-cause='+rootCauseProof,'--awareness='+awareness,'--output='+out],{stdio:'pipe'});
const proof=JSON.parse((await import('node:fs')).readFileSync(out,'utf8'));
assert.equal(proof.role,'PRIMARY_CORRECTNESS_PROVER');
assert.equal(proof.status,'PRIMARY_CORRECTNESS_PROVEN');
assert.equal(proof.proofObjective,'PROVE_PRIMARY_REPAIR_CORRECT');
assert.equal(proof.sourceMutationAllowed,false);
assert.equal(proof.proofBasis.diagnosisCurrentSha,true);
assert.ok(Array.isArray(proof.remainingRisks));
assert.equal(proof.causalEvidenceGraph.protocol,'CAUSAL-EVIDENCE-GRAPH-v1');
assert.equal(proof.obligationsForVerifier.length,4);
console.log('ACTION_PRIMARY_CORRECTNESS_PROOF=PASS');
