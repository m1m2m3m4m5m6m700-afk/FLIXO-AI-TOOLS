#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const arg=(name,fallback='')=>{
  const p='--'+name+'=';
  const hit=process.argv.find(v=>v.startsWith(p));
  return hit ? hit.slice(p.length) : fallback;
};
const read=(file)=>{
  if(!file || !fs.existsSync(file)) throw new Error('CERTIFICATION_INPUT_MISSING='+file);
  return JSON.parse(fs.readFileSync(file,'utf8'));
};
const exactSha=(v)=>/^[a-f0-9]{40}$/u.test(String(v??''));

const targetSha=arg('sha');
const fingerprint=arg('fingerprint');
const benchmarkPath=arg('benchmark');
const promotionPath=arg('promotion');
const greenPath=arg('green');
const output=arg('output','/tmp/ACTION-VAULT-100-CERTIFICATION.json');

if(!exactSha(targetSha)) throw new Error('CERTIFICATION_SHA_INVALID');
if(!fingerprint) throw new Error('CERTIFICATION_FINGERPRINT_REQUIRED');

const benchmark=read(benchmarkPath);
const promotion=read(promotionPath);
const green=read(greenPath);

const failures=[];
if(benchmark.protocol!=='ACTION-VAULT-INTELLIGENCE-BENCHMARK-v1') failures.push('BENCHMARK_PROTOCOL_INVALID');
if(Number(benchmark.score)!==100 || benchmark.passed!==true) failures.push('BENCHMARK_NOT_100');
if(promotion.authority!=='FLIXO_EXACT_SHA_PROMOTION_EVIDENCE') failures.push('PROMOTION_AUTHORITY_INVALID');
if(promotion.state!=='CERTIFIABLE') failures.push('PROMOTION_NOT_CERTIFIABLE');
if(promotion.exactSha!==targetSha) failures.push('PROMOTION_SHA_MISMATCH');
if(Array.isArray(promotion.failures) && promotion.failures.length) failures.push(...promotion.failures.map(String));
if(green.source!=='DAILY_FLIXO_GREEN_GATE') failures.push('GREEN_SOURCE_INVALID');
if(green.conclusion!=='success') failures.push('CANONICAL_GREEN_NOT_SUCCESS');
if(green.zeroRed!==true) failures.push('CANONICAL_GREEN_ZERO_RED_INVALID');
if(green.exactShaVerified!==true) failures.push('CANONICAL_GREEN_EXACT_SHA_INVALID');
if(green.targetSha!==targetSha) failures.push('CANONICAL_GREEN_SHA_MISMATCH');
if(green.fingerprint!==fingerprint) failures.push('CANONICAL_GREEN_FINGERPRINT_MISMATCH');

const result={
  schemaVersion:1,
  protocol:'ACTION-VAULT-100-CERTIFICATION-v1',
  authority:'DAILY_FLIXO_GREEN_GATE',
  certificationStatus:failures.length ? 'BLOCKED' : '100/100 VERIFIED',
  score:failures.length ? Math.min(Number(benchmark.score)||0,99) : 100,
  targetSha,
  failureFingerprint:fingerprint,
  benchmark:{protocol:benchmark.protocol,score:benchmark.score,cases:benchmark.cases,blockedCases:benchmark.blockedCases,passed:benchmark.passed},
  promotion:{authority:promotion.authority,state:promotion.state,exactSha:promotion.exactSha,failures:promotion.failures??[]},
  canonicalGreen:{recordId:green.recordId??null,source:green.source,conclusion:green.conclusion,zeroRed:green.zeroRed,exactShaVerified:green.exactShaVerified,targetSha:green.targetSha},
  remainingRisks:failures,
  generatedAt:new Date().toISOString()
};

fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(failures.length) process.exit(1);
