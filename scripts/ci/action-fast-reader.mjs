#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
const arg=(n,f='')=>{const p='--'+n+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):f};
const input=arg('input'); const output=arg('output');
if(!input||!output) throw new Error('ACTION_FAST_READER_INPUT_REQUIRED');
const text=fs.readFileSync(input,'utf8');
const lines=text.split(/\r?\n/u);
const errorRx=/(?:ERROR|ERR_|FAIL|FAILED|FATAL|exception|throw |timed out|timeout|exit code|cannot|unable|denied|rejected|not found|assert)/iu;
const ignoredRx=/(?:warning|notice|info|debug|deprecated)/iu;
const hits=[]; const counts=new Map();
for(let i=0;i<lines.length;i++){const line=lines[i].trim(); if(!line||ignoredRx.test(line)||!errorRx.test(line)) continue; const normalized=line.replace(/\b\d{4}-\d\d-\d\dT[^ ]+\b/gu,'<TIME>').replace(/\b[0-9a-f]{7,40}\b/giu,'<SHA>').replace(/\d+/gu,'<N>').slice(0,500); counts.set(normalized,(counts.get(normalized)||0)+1); hits.push({line:i+1,text:line.slice(0,1200)});}
const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,50).map(([signature,count])=>({signature,count}));
const top=ranked.slice(0,20);
const causal=hits.slice(0,100);
const result={schemaVersion:1,reader:'ACTION-FAST-READER',algorithm:'SINGLE_PASS_ERROR_FINGERPRINT_SCAN',inputBytes:Buffer.byteLength(text),lines:lines.length,errorHits:hits.length,topSignatures:top,causalEvidence:causal,contentDigest:crypto.createHash('sha256').update(text).digest('hex'),createdAt:new Date().toISOString(),latencyClass:'FAST_LOCAL',source:input};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify({status:'PASS',reader:result.reader,inputBytes:result.inputBytes,lines:result.lines,errorHits:result.errorHits,topSignatures:result.topSignatures.length},null,2));