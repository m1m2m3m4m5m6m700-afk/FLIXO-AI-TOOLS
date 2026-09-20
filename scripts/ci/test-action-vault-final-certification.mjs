#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-action-cert-'));
const write=(name,value)=>{const p=path.join(dir,name);fs.writeFileSync(p,JSON.stringify(value,null,2));return p;};
const sha='a'.repeat(40);
const fp='fp-cert';

const benchmark=write('benchmark.json',{protocol:'ACTION-VAULT-INTELLIGENCE-BENCHMARK-v1',score:100,cases:15,blockedCases:15,passed:true});
const promotion=write('promotion.json',{authority:'FLIXO_EXACT_SHA_PROMOTION_EVIDENCE',state:'CERTIFIABLE',exactSha:sha,failures:[]});
const green=write('green.json',{recordId:'GREEN-1',source:'DAILY_FLIXO_GREEN_GATE',conclusion:'success',zeroRed:true,exactShaVerified:true,targetSha:sha,fingerprint:fp});
const out=path.join(dir,'certification.json');

execFileSync(process.execPath,['scripts/ci/action-vault-final-certification.mjs','--sha='+sha,'--fingerprint='+fp,'--benchmark='+benchmark,'--promotion='+promotion,'--green='+green,'--output='+out],{stdio:'pipe'});
const result=JSON.parse(fs.readFileSync(out,'utf8'));
assert.equal(result.certificationStatus,'100/100 VERIFIED');
assert.equal(result.score,100);

const badGreen=write('bad-green.json',{...JSON.parse(fs.readFileSync(green,'utf8')),zeroRed:false});
assert.throws(()=>execFileSync(process.execPath,['scripts/ci/action-vault-final-certification.mjs','--sha='+sha,'--fingerprint='+fp,'--benchmark='+benchmark,'--promotion='+promotion,'--green='+badGreen,'--output='+path.join(dir,'bad.json')],{stdio:'pipe'}));
console.log('ACTION_VAULT_FINAL_CERTIFICATION=PASS');
