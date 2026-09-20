#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const argAll=name=>process.argv.filter(v=>v.startsWith('--'+name+'=')).map(v=>v.slice(name.length+3));
const arg=(name,fallback='')=>argAll(name)[0] ?? fallback;
const OUT=arg('output',process.env.FLIXO_ACTION_REPAIR_MISSION_MEMORY||'/tmp/flixo-action-repair-bots/current-mission.json');
const TARGET_SHA=arg('target-sha',process.env.FLIXO_EXPECTED_TARGET_SHA||'');
const RUN_ID=arg('run-id',process.env.TARGET_RUN_ID||'');
const FINGERPRINT=arg('fingerprint',process.env.FLIXO_FAILURE_FINGERPRINT||'');
const BOT_ID=arg('bot-id',process.env.FLIXO_ACTION_REPAIR_BOT_ID||'ACTION-REPAIR');
const INSTRUCTION_FILES=argAll('instruction-file');
const CONTEXT_FILES=argAll('context-file');
const RESULT_FILES=argAll('result-file');

if(!/^[a-f0-9]{40}$/iu.test(TARGET_SHA)) throw new Error('ACTION_MISSION_MEMORY_TARGET_SHA_REQUIRED');
if(!RUN_ID) throw new Error('ACTION_MISSION_MEMORY_RUN_ID_REQUIRED');

const readText=file=>{try{return fs.readFileSync(path.resolve(ROOT,file),'utf8')}catch{return ''}};
const readJson=file=>{const text=readText(file);if(!text)return null;try{return JSON.parse(text)}catch{return {raw:text}}};
const sha256=value=>crypto.createHash('sha256').update(String(value),'utf8').digest('hex');
const normalize=value=>String(value??'').replace(/\s+/gu,' ').trim();
const unique=values=>[...new Set(values.map(normalize).filter(Boolean))];

const instructionTexts=[
 ...argAll('instruction'),
 ...INSTRUCTION_FILES.map(readText),
 ...CONTEXT_FILES.map(file=>JSON.stringify(readJson(file)??readText(file))),
];
const resultPayloads=RESULT_FILES.map(file=>readJson(file)).filter(Boolean);
const prior=fs.existsSync(OUT)?readJson(OUT):null;

const instructions=unique([
 ...(prior?.instructions??[]),
 ...instructionTexts.flatMap(text=>String(text).split(/\r?\n/gu).map(normalize)),
]);
const context={
 targetSha:TARGET_SHA,runId:String(RUN_ID),fingerprint:FINGERPRINT||null,
 sourceFiles:unique([...(prior?.context?.sourceFiles??[]),...CONTEXT_FILES]),
 instructionFiles:unique([...(prior?.context?.instructionFiles??[]),...INSTRUCTION_FILES]),
 resultFiles:unique([...(prior?.context?.resultFiles??[]),...RESULT_FILES]),
 resultDigests:resultPayloads.map(payload=>sha256(JSON.stringify(payload))),
};

const mergedInstruction=[
 'Execute only the active repair mission identified by this exact target SHA and run.',
 'Treat current evidence as authoritative over historical memory.',
 'Use historical knowledge only as an advisory candidate source until current reproduction succeeds.',
 'Keep mutation bounded to the diagnosed error scope on execution; never mutate main or test files.',
 ...instructions,
].filter(Boolean);

const memory={
 schemaVersion:1,
 layer:'L4_CURRENT_MISSION_MEMORY',
 authority:'ACTION_REPAIR_MISSION_CONTEXT',
 botId:BOT_ID,
 mode:'TEMPORARY_INTERNAL',
 persistent:false,
 exactShaRequired:true,
 targetSha:TARGET_SHA,
 runId:String(RUN_ID),
 fingerprint:FINGERPRINT||null,
 createdAt:prior?.createdAt??new Date().toISOString(),
 refreshedAt:new Date().toISOString(),
 instructions,
 mergedInstruction:unique(mergedInstruction),
 instructionDigest:sha256(mergedInstruction.join('\n')),
 context,
 pendingResults:resultPayloads,
 resultDigest:sha256(JSON.stringify(resultPayloads)),
 lifecycle:{
   status:'OPEN',
   promotion:'BLOCKED_UNTIL_CANONICAL_GREEN',
   discardOnNonGreen:true,
   noAuthorityEscalation:true,
 },
 barriers:{
   currentShaMustMatch:true,
   staleMissionRejected:true,
   historicalMemoryCannotOverrideCurrentEvidence:true,
   missionMemoryCannotAuthorizeMutationByItself:true,
   canonicalGreenRequiredForPromotion:true,
 },
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(memory,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',layer:memory.layer,botId:BOT_ID,targetSha:TARGET_SHA,runId:String(RUN_ID),instructionCount:instructions.length,resultCount:resultPayloads.length,output:OUT},null,2));
