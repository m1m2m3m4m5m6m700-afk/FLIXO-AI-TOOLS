#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildSharedLearningContext } from './shared-operational-memory.mjs';

const ROOT=process.cwd();
export const FLIXO_BOT_REGISTRY_PATH=path.resolve(ROOT,process.env.FLIXO_BOT_REGISTRY??'docs/agents/FLIXO-BOT.json');
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const sha256=value=>createHash('sha256').update(String(value),'utf8').digest('hex');

export function loadFlixoBotRegistry(){
  const registry=readJson(FLIXO_BOT_REGISTRY_PATH,null);
  if(!registry||registry.id!=='FLIXO-BOT-SYSTEM-WIDE-INTELLIGENCE') throw new Error('FLIXO_BOT_REGISTRY_MISSING_OR_INVALID');
  const consumers=registry?.distribution?.learningConsumers;
  if(!Array.isArray(consumers)||consumers.length<7) throw new Error('FLIXO_BOT_GLOBAL_AUDIENCE_INVALID');
  if(new Set(consumers).size!==consumers.length) throw new Error('FLIXO_BOT_GLOBAL_AUDIENCE_DUPLICATE');
  return registry;
}

export function assertFlixoBotConsumer(botId){
  const registry=loadFlixoBotRegistry();
  const id=String(botId??'').trim();
  if(!registry.distribution.learningConsumers.includes(id)) throw new Error('FLIXO_BOT_CONSUMER_NOT_REGISTERED='+id);
  return Object.freeze({botId:id,intelligenceVersion:registry.intelligenceVersion,coreIntelligence:registry.architecture.mode,authorityUnchanged:true});
}

export function buildFlixoBotIntelligenceContext({botId=null,fingerprint=null,limit=48}={}){
  const registry=loadFlixoBotRegistry();
  if(botId!==null) assertFlixoBotConsumer(botId);
  const shared=buildSharedLearningContext({fingerprint,botId,limit});
  const intelligenceDigest=sha256(JSON.stringify({
    version:registry.intelligenceVersion,
    architecture:registry.architecture,
    knowledgeSources:registry.knowledgeSources,
    audience:registry.distribution.learningConsumers,
    shared:{recordCount:shared.recordCount,lessonIds:shared.lessons.map(x=>x.id),antiLessonIds:shared.antiLessons.map(x=>x.id)}
  }));
  return Object.freeze({
    brainId:registry.id,
    displayName:registry.displayName,
    intelligenceVersion:registry.intelligenceVersion,
    intelligenceDigest,
    activeConsumerCount:registry.distribution.targetCount,
    coreIntelligence:registry.mergedIntelligence,
    learning:registry.learning,
    distribution:registry.distribution,
    sharedMemory:shared,
    invariant:'SAME_CORE_INTELLIGENCE; ROLE_AND_AUTHORITY_REMAIN_SEPARATE'
  });
}

if(import.meta.url===new URL(process.argv[1]??'','file:').href){
  const op=process.argv[2]??'status';
  const botId=process.env.FLIXO_BOT_ID??null;
  if(op==='status'){
    const registry=loadFlixoBotRegistry();
    console.log(JSON.stringify({
      status:'PASS',
      brainId:registry.id,
      displayName:registry.displayName,
      intelligenceVersion:registry.intelligenceVersion,
      activeConsumers:registry.distribution.learningConsumers.length,
      roleAuthorityUnchanged:true
    },null,2));
  }else if(op==='context'){
    console.log(JSON.stringify(buildFlixoBotIntelligenceContext({botId,fingerprint:process.env.FLIXO_FAILURE_FINGERPRINT??null,limit:Number(process.env.FLIXO_INTELLIGENCE_LIMIT??48)}),null,2));
  }else if(op==='assert'){
    console.log(JSON.stringify(assertFlixoBotConsumer(botId),null,2));
  }else{
    throw new Error('FLIXO_BOT_INTELLIGENCE_UNKNOWN_OPERATION='+op);
  }
}
