import { createHash } from 'node:crypto';

export const MEMORY_LAYERS = Object.freeze({ L0:'WORKING', L1:'SESSION', L2:'PERSONAL', L3:'EPISODIC', L4:'SEMANTIC', L5:'CANONICAL' });
export type MemoryLayer=keyof typeof MEMORY_LAYERS;
export type Difficulty='D1'|'D2'|'D3'|'D4'|'D5';
export type Polarity='SUPPORTS'|'REFUTES'|'UNKNOWN';

const SHA40=/^[a-f0-9]{40}$/u;
const SHA256=/^[a-f0-9]{64}$/u;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v),'utf8').digest('hex');
const normalize=(v:string)=>String(v??'').toLocaleLowerCase().replace(/\\s+/gu,' ').replace(/[^\\p{L}\\p{N}_:./ -]/gu,'').trim();

export type SwarmKnowledge=Readonly<{
  id:string; scope:string; content:string; source:string; sourceType:'FLIXO_DOC'|'REPOSITORY'|'TEST'|'INTERNAL_EVIDENCE'|'TRUSTED_EXTERNAL'|'WEB'|'GENERATED';
  version:string; layer:MemoryLayer; status:'VERIFIED'|'PROBABLE'|'INFERRED'|'UNKNOWN'|'CONFLICTED'; validity:'CURRENT'|'STALE'|'REVOKED';
  confidence:number; authority:number; provenance:readonly string[]; exactSha:string|null; exactShaVerified:boolean; evidenceCount:number; polarity:Polarity;
  canonicalKey:string; createdAt:string; lastVerifiedAt:string|null; expiresAt:string|null;
}>;

export const canonicalKey=(scope:string,content:string)=>hash({scope:normalize(scope),content:normalize(content)});

export function makeKnowledge(input:Omit<SwarmKnowledge,'canonicalKey'|'id'> & {id?:string}):SwarmKnowledge{
  const id=input.id??'SK-'+canonicalKey(input.scope,input.content).slice(0,24);
  if(input.exactSha!==null&&!SHA40.test(input.exactSha))throw new Error('SWARM_EXACT_SHA_INVALID');
  if(input.provenance.length<1)throw new Error('SWARM_PROVENANCE_REQUIRED');
  if(input.confidence<0||input.confidence>1)throw new Error('SWARM_CONFIDENCE_INVALID');
  return Object.freeze({...input,id,canonicalKey:canonicalKey(input.scope,input.content)});
}

const rank=(r:SwarmKnowledge)=>(r.exactShaVerified?.25:0)+(r.status==='VERIFIED'?.35:r.status==='PROBABLE'?.18:0)+r.confidence*.25+r.authority*.1+Math.min(.05,r.evidenceCount/40);

export function mergeCanonical(records:readonly SwarmKnowledge[]){
  const groups=new Map<string,SwarmKnowledge[]>();
  for(const r of records)groups.set(r.canonicalKey,[...(groups.get(r.canonicalKey)??[]),r]);
  const canonical:SwarmKnowledge[]=[]; const duplicates:{key:string;ids:string[]}[]=[]; const contradictions:{scope:string;key:string;ids:string[]}[]=[];
  for(const [key,group] of groups){
    canonical.push([...group].sort((a,b)=>rank(b)-rank(a)||a.id.localeCompare(b.id))[0]);
    if(group.length>1)duplicates.push({key,ids:group.map(r=>r.id).sort()});
    const polarities=new Set(group.map(r=>r.polarity));
    if(polarities.has('SUPPORTS')&&polarities.has('REFUTES'))contradictions.push({scope:group[0].scope,key,ids:group.map(r=>r.id).sort()});
  }
  return {canonical,duplicates,contradictions};
}

export function decayKnowledge(r:SwarmKnowledge,now=Date.now(),halfLifeDays=30):SwarmKnowledge{
  const anchor=r.lastVerifiedAt??r.createdAt; const age=Math.max(0,(now-new Date(anchor).getTime())/86400000); const c=Number((r.confidence*2**(-age/halfLifeDays)).toFixed(6));
  const stale=r.expiresAt?new Date(r.expiresAt).getTime()<=now:age>=30;
  return Object.freeze({...r,confidence:c,status:stale&&r.status==='VERIFIED'?'PROBABLE':r.status,validity:stale&&r.validity==='CURRENT'?'STALE':r.validity});
}

export function poisoningSafe(r:SwarmKnowledge,currentSha:string,conflictCount=0){
  return SHA40.test(currentSha)&&conflictCount===0&&r.validity==='CURRENT'&&r.status==='VERIFIED'&&r.confidence>=.9&&r.exactShaVerified&&r.exactSha===currentSha&&r.evidenceCount>=2&&r.provenance.length>0&&!['GENERATED','WEB'].includes(r.sourceType);
}

export function compactMemory(records:readonly SwarmKnowledge[],caps:Partial<Record<MemoryLayer,number>>={}){
  const merged=mergeCanonical(records).canonical.map(r=>decayKnowledge(r));
  const keep:SwarmKnowledge[]=[]; const archived:SwarmKnowledge[]=[]; const used=new Map<MemoryLayer,number>();
  const capacity=(l:MemoryLayer)=>caps[l]??({L0:64,L1:256,L2:500,L3:2000,L4:5000,L5:10000}[l]);
  for(const r of merged.sort((a,b)=>Number(b.layer.slice(1))-Number(a.layer.slice(1))||rank(b)-rank(a))){
    const preserve=r.layer==='L5'&&r.status==='VERIFIED'&&r.validity==='CURRENT'&&r.exactShaVerified;
    const n=used.get(r.layer)??0; if(preserve||n<capacity(r.layer)){keep.push(r);used.set(r.layer,n+1);}else archived.push(r);
  }
  return {active:keep,archived,droppedDuplicates:records.length-mergeCanonical(records).canonical.length,rebuildDigest:hash(keep)};
}

export function rebuildMemory(records:readonly SwarmKnowledge[],manifest:{recordCount:number;digest:string;exactSha:string}){
  if(!SHA40.test(manifest.exactSha)||records.length!==manifest.recordCount)throw new Error('SWARM_REBUILD_IDENTITY_INVALID');
  const digest=hash([...records].sort((a,b)=>a.id.localeCompare(b.id))); if(digest!==manifest.digest)throw new Error('SWARM_REBUILD_DIGEST_MISMATCH');
  return Object.freeze([...records].sort((a,b)=>a.id.localeCompare(b.id)));
}

export function classifyDifficulty(input:{ambiguity:number;novelty:number;dependencyCount:number;risk:number;uncertainty:number;capabilityCount:number}):Difficulty{
  const s=input.ambiguity*.2+input.novelty*.2+Math.min(1,input.dependencyCount/8)*.15+input.risk*.2+input.uncertainty*.15+Math.min(1,input.capabilityCount/6)*.1;
  return s<.2?'D1':s<.4?'D2':s<.6?'D3':s<.8?'D4':'D5';
}

export type SkillObservation=Readonly<{botId:string;skill:string;capability:string;outcome:'SUCCESS'|'FAILURE'|'BLOCKED_EXTERNAL'|'SHADOW';contextKey:string;verified:boolean;timestamp:string}>;
export function skillReputation(observations:readonly SkillObservation[],now=Date.now(),halfLifeDays=45){
  const map=new Map<string,SkillObservation[]>(); for(const o of observations){const k=[o.botId,o.skill,o.capability].join('|');map.set(k,[...(map.get(k)??[]),o]);}
  return [...map.values()].map(group=>{const ok=group.filter(o=>o.outcome==='SUCCESS'&&o.verified).length;const bad=group.filter(o=>o.outcome==='FAILURE').length;const attempts=ok+bad;
    const score=group.reduce((s,o)=>{const age=Math.max(0,(now-new Date(o.timestamp).getTime())/86400000);const w=2**(-age/halfLifeDays);return s+(o.outcome==='SUCCESS'&&o.verified?w:o.outcome==='FAILURE'?0:w*.25);},0);
    const weight=group.reduce((s,o)=>{const age=Math.max(0,(now-new Date(o.timestamp).getTime())/86400000);return s+2**(-age/halfLifeDays);},0);
    return {botId:group[0].botId,skill:group[0].skill,capability:group[0].capability,attempts,successes:ok,failures:bad,successRate:attempts?ok/attempts:0,decayedScore:weight?score/weight:0,distinctContexts:new Set(group.map(o=>o.contextKey)).size};
  }).sort((a,b)=>b.decayedScore-a.decayedScore||b.successRate-a.successRate||a.botId.localeCompare(b.botId));
}

export function adaptiveSwarmSize(d:Difficulty,capabilityCount:number,novelty:number,risk:number){
  const base={D1:3,D2:4,D3:6,D4:10,D5:15}[d]; return Math.min(50,Math.max(3,base+Math.ceil(Math.max(0,capabilityCount-2)*1.5)+Math.ceil(novelty*10)+Math.ceil(risk*8)));
}

export function promotionTrial(x:{attempts:number;successes:number;distinctContexts:number;independentChallenges:number;contradictions:number}){
  const reasons:string[]=[];const rate=x.attempts?x.successes/x.attempts:0;
  if(x.attempts<3)reasons.push('MIN_TRIALS'); if(rate<.8)reasons.push('SUCCESS_RATE'); if(x.distinctContexts<2)reasons.push('CONTEXT_DIVERSITY'); if(x.independentChallenges<1)reasons.push('INDEPENDENT_CHALLENGE'); if(x.contradictions>0)reasons.push('CONTRADICTION');
  return {eligible:reasons.length===0,reasons};
}

export function canaryDecision(x:{baselineFailureRate:number;canaryFailureRate:number;allowedRegression:number;trials:number}){
  if(x.trials<3)return 'HOLD' as const; if(x.canaryFailureRate>x.baselineFailureRate+x.allowedRegression)return 'ROLLBACK' as const; if(x.canaryFailureRate<=x.baselineFailureRate)return 'PROMOTE' as const; return 'HOLD' as const;
}

export function compareReplay(x:{historicalOracle:'PASS'|'FAIL'|'UNKNOWN';currentOracle:'PASS'|'FAIL'|'UNKNOWN';historicalOutputHash:string;currentOutputHash:string}){
  if(!SHA256.test(x.historicalOutputHash)||!SHA256.test(x.currentOutputHash))throw new Error('REPLAY_OUTPUT_HASH_INVALID');
  if(x.historicalOracle==='FAIL'&&x.currentOracle==='PASS')return {changed:true,signal:'IMPROVED' as const};
  if(x.historicalOracle==='PASS'&&x.currentOracle==='FAIL')return {changed:true,signal:'REGRESSED' as const};
  if(x.historicalOracle==='UNKNOWN'||x.currentOracle==='UNKNOWN')return {changed:x.historicalOutputHash!==x.currentOutputHash,signal:'UNMEASURABLE' as const};
  return {changed:x.historicalOutputHash!==x.currentOutputHash,signal:'NO_CHANGE' as const};
}

export const FAILURE_INJECTION_CATALOG=Object.freeze(['STALE_SHA','DUPLICATE_KNOWLEDGE','CONTRADICTORY_KNOWLEDGE','POISONED_PROVENANCE','EXPIRED_SKILL','LOW_CONFIDENCE_PROMOTION','MISSING_REPLAY_INPUT','EXTERNAL_ORACLE_UNKNOWN','PRODUCT_AGENT_HANDOFF_MISMATCH','FILTER_MASK_RUNTIME_DEPENDENCY_MISSING','CAMERA_RECORDER_EVIDENCE_GAP']);

export function validateHandoff(input:{missionId:string;exactSha:string;capabilityId:string;evidenceRefs:readonly string[]}){if(!input.missionId||!SHA40.test(input.exactSha)||!input.capabilityId||input.evidenceRefs.length===0)throw new Error('PRODUCT_AGENT_HANDOFF_INVALID');}

export function rootCauseMemoryLink(input:{productFailureId:string;rootCause:string;exactSha:string;failureFingerprint:string;evidenceRefs:readonly string[]}){if(!input.productFailureId||!input.rootCause||!SHA40.test(input.exactSha)||!SHA256.test(input.failureFingerprint)||input.evidenceRefs.length===0)throw new Error('ROOT_CAUSE_MEMORY_LINK_INVALID');return Object.freeze({id:'RC-'+hash(input).slice(0,24),layer:'L3',status:'OBSERVED'});}
