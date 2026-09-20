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
const out=path.join(dir,'proof.json');
execFileSync(process.execPath,['scripts/ci/action-primary-correctness-proof.mjs','--task=task','--run-id=1','--sha='+sha,'--fingerprint=fp','--diagnosis='+diagnosis,'--strategy='+strategy,'--file-selection='+fileSelection,'--output='+out],{stdio:'pipe'});
const proof=JSON.parse((await import('node:fs')).readFileSync(out,'utf8'));
assert.equal(proof.role,'PRIMARY_CORRECTNESS_PROVER');
assert.equal(proof.status,'PRIMARY_CORRECTNESS_PROVEN');
assert.equal(proof.proofObjective,'PROVE_PRIMARY_REPAIR_CORRECT');
assert.equal(proof.sourceMutationAllowed,false);
assert.equal(proof.proofBasis.diagnosisCurrentSha,true);
assert.ok(Array.isArray(proof.remainingRisks));
assert.equal(proof.obligationsForVerifier.length,4);
console.log('ACTION_PRIMARY_CORRECTNESS_PROOF=PASS');
