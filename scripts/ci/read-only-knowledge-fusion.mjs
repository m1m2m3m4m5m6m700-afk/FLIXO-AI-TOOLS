#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const ROUTER_PATH=path.resolve(ROOT,'docs/agents/ERROR-TEACHING-ROUTER.json');
const INDEX_PATH=path.resolve(ROOT,'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json');
const MEMORY_PATH=path.resolve(ROOT,'diagnostics/auto-repair/memory.json');
const REPAIR_PROFILE_PATH=path.resolve(ROOT,'diagnostics/auto-repair/action-repair-bots/ACTION-REPAIR.json');
const VALID_SHA=/^[a-f0-9]{40}$/u;
const STOP=new Set(['the','and','for','with','from','this','that','error','failed','failure','workflow','run','current','must','should','before','after','into','then','only','case','repair']);

const readJson=(file,fallback={})=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const readLines=(file)=>{try{return fs.readFileSync(file,'utf8').split(/\r?\n/u);}catch{return[];}};
const normalize=(value)=>String(value??'').replace(/\s+/gu,' ').trim().toLowerCase();
const tokens=(value)=>[...new Set((normalize(value).match(/[a-z][a-z0-9_-]{2,}|\bts\d{3,5}\b|\b(?:t|hae)-?\d{3,8}\b/gu)??[]).filter(x=>!STOP.has(x)))];
const overlap=(query,candidate)=>{
  const q=new Set(query), c=new Set(tokens(candidate));
  let n=0; for(const token of q) if(c.has(token)) n++;
  return {count:n,ratio:n/Math.max(1,q.size)};
};
const exactSha=(value)=>VALID_SHA.test(String(value??''));

function routeKnowledge(query){
  const router=readJson(ROUTER_PATH,{});
  const q=normalize(query);
  const qt=tokens(query);
  const classes=[];
  const aliases=router.aliases??{};
  for(const token of qt){
    if(aliases[token]) classes.push(aliases[token]);
  }
  for(const group of router.groups??[]){
    const groupClasses=new Set((group.classes??[]).map(normalize));
    const groupPrefixes=(group.prefixes??[]).map(normalize);
    const exactClass=qt.some(token=>groupClasses.has(token));
    const prefixMatch=qt.some(token=>groupPrefixes.some(prefix=>token===prefix||token.startsWith(prefix+'-')));
    const textMatch=groupPrefixes.some(prefix=>q.includes(prefix));
    if(exactClass||prefixMatch||textMatch) classes.push(group.file);
  }
  const unique=[...new Set(classes)];
  const base=[router.corpus?.base,router.corpus?.additional].filter(Boolean);
  const expanded=unique.length?unique:((router.corpus?.expanded??[]).slice(0,2));
  return {router,selected:[...new Set([...base,...expanded])],routeKeys:unique,ruleCount:Number(router.corpus?.rules??0),queryTokens:qt.slice(0,40)};
}

function readAdviceFiles(files){
  const rows=[];
  for(const file of files){
    const absolute=path.resolve(ROOT,file);
    const lines=readLines(absolute);
    for(let i=0;i<lines.length;i++){
      const text=String(lines[i]??'').trim();
      if(!text) continue;
      const id=text.match(/\b(?:T|HAE-)\d{3,8}\b/iu)?.[0]??null;
      if(!id && text.length<20) continue;
      rows.push({id,source:file,line:i+1,text});
    }
  }
  return rows;
}


function evidenceClass(item){
  if(String(item?.kind)==='CANONICAL_INDEX') return 4;
  if(String(item?.kind)==='ANTI_LESSON') return 4;
  if(String(item?.kind)==='HISTORICAL_PREDICTION') return 3;
  if(String(item?.kind)==='PROVEN_RULE_HINT') return 3;
  return 2;
}

function adviceConflict(a,b){
  const ta=normalize(a?.text), tb=normalize(b?.text);
  if(!ta||!tb) return false;
  const oppositeA=/(never|must not|do not|reject|block|forbidden|unsafe|avoid)/u.test(ta);
  const oppositeB=/(allow|enable|use|accept|proceed|force|retry)/u.test(tb);
  const oppositeC=/(never|must not|do not|reject|block|forbidden|unsafe|avoid)/u.test(tb);
  const oppositeD=/(allow|enable|use|accept|proceed|force|retry)/u.test(ta);
  return (oppositeA&&oppositeB)||(oppositeC&&oppositeD);
}

function arbitrateKnowledge({selectedAdvice=[],antiLessons=[],provenRuleHints=[],predictionConfidence=0,targetSha='',routeConfidence=0}={}){
  if(!exactSha(targetSha)) throw new Error('KNOWLEDGE_ARBITRATION_EXACT_SHA_REQUIRED');
  const candidates=selectedAdvice.slice(0,8);
  const conflicts=[];
  for(let i=0;i<candidates.length;i++){
    for(let j=i+1;j<candidates.length;j++){
      if(adviceConflict(candidates[i],candidates[j])) conflicts.push({a:candidates[i],b:candidates[j],type:'OPPOSING_ACTION_SIGNAL'});
    }
  }
  const antiRisk=antiLessons[0]?.score??0;
  const top=candidates[0]??null;
  const second=candidates[1]??null;
  const margin=Number(((top?.score??0)-(second?.score??0)).toFixed(4));
  const provenanceScore=top?Math.min(1,evidenceClass(top)/4):0;
  const predictionSupport=Math.min(1,Number(predictionConfidence)||0);
  const contradictionPenalty=conflicts.length?Math.min(0.35,0.12*conflicts.length):0;
  const antiPenalty=antiRisk>=0.82?0.35:antiRisk>=0.68?0.18:antiRisk>0.5?0.08:0;
  const confidence=Number(Math.max(0,Math.min(0.97,
    (top?.score??0)*0.35+
    Math.min(1,Math.max(0,routeConfidence))*0.15+
    provenanceScore*0.15+
    predictionSupport*0.10+
    Math.min(1,Math.max(0,margin))*0.15+
    0.10-
    contradictionPenalty-
    antiPenalty
  )).toFixed(3));
  const decisionState =
    !top ? {decision:'ESCALATE',reason:'NO_CANDIDATE_ADVICE'} :
    conflicts.length>0 && margin<0.18 ? {decision:'REJECT_ALL',reason:'UNRESOLVED_CONFLICT_WITHOUT_EVIDENCE_MARGIN'} :
    antiRisk>=0.82 && margin<0.25 ? {decision:'REJECT_ALL',reason:'HIGH_RISK_ANTILESSON_CONFLICT'} :
    conflicts.length>0 ? {decision:'ESCALATE',reason:'CONFLICT_REQUIRES_CURRENT_EVIDENCE'} :
    confidence>=0.70 && antiRisk<0.68 ? {decision:'SELECT_WITH_EVIDENCE',reason:'SINGLE_COHERENT_EVIDENCE_PATH'} :
    {decision:'ESCALATE',reason:'EVIDENCE_MARGIN_TOO_LOW'};
  const {decision,reason}=decisionState;
  return {
    protocol:'FLIXO-KNOWLEDGE-ARBITRATION-v1',
    authority:'ADVISORY_ONLY',
    mutationAuthority:false,
    exactShaBound:true,
    targetSha,
    provenRuleHintCount:provenRuleHints.length,
    decision,
    reason,
    selectedAdviceId:decision==='SELECT_WITH_EVIDENCE'?top?.id??null:null,
    candidateCount:candidates.length,
    conflictCount:conflicts.length,
    conflicts:conflicts.slice(0,12),
    antiRisk:Number(antiRisk.toFixed(4)),
    evidenceMargin:margin,
    provenanceStrength:Number(provenanceScore.toFixed(4)),
    predictionSupport:Number(predictionSupport.toFixed(4)),
    confidence,
    requiresCurrentExactShaEvidence:true,
    blocksMutation:decision!=='SELECT_WITH_EVIDENCE',
    rule:'Knowledge arbitration never proves a repair; current exact-SHA reproduction and canonical CI remain authoritative.'
  };
}

function buildFusion({failureLog='',diagnosis={},targetSha='',failedRunId='READ_ONLY',prediction=null}={}){
  if(!exactSha(targetSha)) throw new Error('READ_ONLY_KNOWLEDGE_FUSION_EXACT_SHA_REQUIRED');
  const query=[failureLog,diagnosis?.rootCause,diagnosis?.errorClass,diagnosis?.errorType,diagnosis?.stage,diagnosis?.mechanism,diagnosis?.invariant,diagnosis?.explanation,diagnosis?.reason,diagnosis?.location?.file,diagnosis?.location?.symbol].filter(Boolean).join(' ');
  const route=routeKnowledge(query);
  const queryTerms=route.queryTokens;
  const canonical=readJson(INDEX_PATH,{});
  const memory=readJson(MEMORY_PATH,{cases:[],lessons:[],antiLessons:[]});
  const profile=readJson(REPAIR_PROFILE_PATH,{valuableKnowledge:{}});
  const candidates=[];

  for(const row of readAdviceFiles(route.selected)){
    const hit=overlap(queryTerms,row.text);
    if(hit.count<1) continue;
    let score=hit.ratio*0.62+Math.min(0.18,hit.count*0.03);
    if(row.id) score+=0.04;
    candidates.push({kind:'TEACHING',id:row.id,source:row.source,line:row.line,text:row.text,score});
  }

  const indexRecords=Array.isArray(canonical.records)?canonical.records:[];
  for(const row of indexRecords){
    const text=JSON.stringify(row);
    const hit=overlap(queryTerms,text);
    if(hit.count<1) continue;
    const verified=String(row.knowledgeStatus??'').includes('GREEN')||String(row.status??'').toUpperCase()==='VERIFIED';
    candidates.push({kind:'CANONICAL_INDEX',id:row.id??null,source:'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json',line:null,text:String(row.teaching??row.action??row.trigger??text).slice(0,2400),score:0.72+hit.ratio*0.2+(verified?0.08:0)});
  }

  for(const item of prediction?.similarCases??[]){
    const text=[item.errorClass,item.rootCause,item.normalized,...(item.strategies??[])].join(' ');
    const hit=overlap(queryTerms,text);
    if(hit.count<1) continue;
    candidates.push({kind:'HISTORICAL_PREDICTION',id:item.id??null,source:'PREDICTIVE_REPAIR_PACKET_V1',line:null,text:String(item.historicalTeaching??item.normalized??text).slice(0,2400),score:Number(Math.min(0.93,(Number(item.score??0)*0.55)+(hit.ratio*0.35)))});
  }

  const antiLessons=[...(memory.antiLessons??[]),...(profile.valuableKnowledge?.antiLessons??[])];
  const anti=[];
  for(const item of antiLessons){
    const text=typeof item==='string'?item:JSON.stringify(item);
    const hit=overlap(queryTerms,text);
    if(hit.count>0) anti.push({kind:'ANTI_LESSON',source:'REPAIR_MEMORY',text:text.slice(0,2400),score:Number(Math.min(1,0.58+hit.ratio*0.42)),matchedTerms:hit.count});
  }

  const successfulStrategies=profile.valuableKnowledge?.provenRules??[];
  const strategyHints=[];
  for(const rule of successfulStrategies){
    const hit=overlap(queryTerms,String(rule));
    if(hit.count>0) strategyHints.push({kind:'PROVEN_RULE_HINT',source:'ACTION-REPAIR_PROFILE',text:String(rule),score:Number(Math.min(0.9,0.42+hit.ratio*0.45)),matchedTerms:hit.count});
  }

  candidates.sort((a,b)=>b.score-a.score);
  anti.sort((a,b)=>b.score-a.score);
  strategyHints.sort((a,b)=>b.score-a.score);
  const dedup=new Set();
  const selected=[];
  for(const item of candidates){
    const key=(item.id??item.text.slice(0,220)).toLowerCase();
    if(dedup.has(key)) continue;
    dedup.add(key);
    selected.push({...item,score:Number(item.score.toFixed(4))});
    if(selected.length>=20) break;
  }

  const conflicts=[];
  for(const item of selected){
    const text=normalize(item.text);
    const conflicting=anti.find(a=>text.includes(normalize(a.text))||normalize(a.text).includes(text));
    if(conflicting) conflicts.push({advice:item,antiLesson:conflicting,reason:'DIRECT_TEXT_CONFLICT'});
  }

  const independentSources=new Set(selected.map(x=>x.source)).size;
  const evidenceDiversity=independentSources;
  const strongest=selected[0]??null;
  const antiRisk=anti[0]?.score??0;
  const confidence=Number(Math.min(0.97,Math.max(0,(
    (strongest?.score??0)*0.52+
    Math.min(0.95,independentSources/4)*0.18+
    Math.min(0.95,(prediction?.proposedRepair?.confidence??0))*0.15+
    Math.min(0.95,queryTerms.length/12)*0.05+
    (conflicts.length?0:0.10)
  )-(antiRisk>0.82?0.22:antiRisk>0.68?0.10:0))).toFixed(3));

  const arbitration=arbitrateKnowledge({selectedAdvice:selected,antiLessons:anti,provenRuleHints:strategyHints,predictionConfidence:Number(prediction?.proposedRepair?.confidence??0),targetSha,routeConfidence:evidenceDiversity/4});
  const disposition=arbitration.decision==='REJECT_ALL'?'KNOWLEDGE_REJECTED':arbitration.decision==='ESCALATE'?'KNOWLEDGE_ESCALATION_REQUIRED':conflicts.length?'CHALLENGE_REQUIRED':strongest?(
    strongest.score>=0.72?'HIGH_VALUE_SUPPORTING_EVIDENCE':'RELATED_HISTORICAL_EVIDENCE'
  ):'NO_ACTIONABLE_KNOWLEDGE';

  return {
    protocol:'FLIXO-READ-ONLY-KNOWLEDGE-FUSION-v1',
    authority:'ADVISORY_ONLY',
    mutationAuthority:false,
    exactShaBound:true,
    targetSha,
    failedRunId:String(failedRunId),
    route:{selectedSources:route.selected,matchedGroups:route.routeKeys,routerRuleCount:route.ruleCount,queryTerms},
    corpus:{canonicalIndexRecordCount:indexRecords.length,memoryCases:(memory.cases??[]).length,memoryLessons:(memory.lessons??[]).length,antiLessonCount:antiLessons.length,predictionCases:(prediction?.similarCases??[]).length},
    selectedAdvice:selected,
    antiLessons:anti.slice(0,16),
    provenRuleHints:strategyHints.slice(0,16),
    conflicts,
    evidence:{diversity:evidenceDiversity,independentSources,evidenceMargin:Number(((strongest?.score??0)-(selected[1]?.score??0)).toFixed(4)),predictionConfidence:Number(prediction?.proposedRepair?.confidence??0)},
    synthesis:{disposition,confidence,strongestAdviceId:strongest?.id??null,antiRisk:Number(antiRisk.toFixed(4)),needsAdversarialReview:true,proofAuthority:'CURRENT_EXACT_SHA_CI_ONLY'},
    unknowns:[
      'Historical knowledge can be stale or context-specific.',
      'A text match cannot prove the active root cause.',
      'Anti-lessons remain blocking context until contradicted by fresh evidence.'
    ]
  };
}

export { buildFusion, arbitrateKnowledge };
