#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const shaOk=(v)=>/^[a-f0-9]{40}$/.test(String(v??''));
const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));

export function buildRootCauseProof({targetSha=null,failureFingerprint=null,failedRunId=null,diagnosis=null,strategy=null,fileSelection=null,failureLog=''}={}){
 const failures=[];
 if(!shaOk(targetSha)) failures.push('RCA_SHA_INVALID');
 if(!failureFingerprint||!failedRunId) failures.push('RCA_IDENTITY_MISSING');
 if(!diagnosis||typeof diagnosis!=='object') failures.push('RCA_DIAGNOSIS_REQUIRED');
 if(!strategy||typeof strategy!=='object') failures.push('RCA_STRATEGY_REQUIRED');
 if(!fileSelection||fileSelection.targetSha!==targetSha||fileSelection.failureFingerprint!==failureFingerprint||fileSelection.decision!=='SELECTED') failures.push('RCA_FILE_SELECTION_INVALID');
 const root=String(diagnosis?.rootCause??'').trim();
 const location=diagnosis?.location?.file??null;
 const directFailureSignal=diagnosis?.directFailureSignal===true;
 const confidence=Number(diagnosis?.causalConfidence??0);
 const ambiguity=diagnosis?.ambiguity===true;
 const hypotheses=Array.isArray(diagnosis?.hypotheses)?diagnosis.hypotheses:[];
 const selectedHypothesis=hypotheses.find(h=>h?.id===root)??null;
 const alternatives=hypotheses.filter(h=>h?.id!==root).map(h=>({id:h.id??'UNKNOWN',score:Number(h.score??0),suppressedBy:h.suppressedBy??null,evidenceLines:Array.isArray(h.evidenceLines)?h.evidenceLines:[]}));
 const strongerAlternatives=alternatives.filter(h=>h.suppressedBy==null&&h.score>Number(selectedHypothesis?.score??0));
 if(!root) failures.push('RCA_ROOT_CAUSE_MISSING');
 if(!location) failures.push('RCA_LOCATION_MISSING');
 if(!directFailureSignal) failures.push('RCA_DIRECT_FAILURE_SIGNAL_MISSING');
 if(confidence<0.75) failures.push('RCA_CONFIDENCE_BELOW_THRESHOLD');
 if(ambiguity) failures.push('RCA_UNRESOLVED_AMBIGUITY');
 if(!selectedHypothesis||!Array.isArray(selectedHypothesis.evidenceLines)||selectedHypothesis.evidenceLines.length===0) failures.push('RCA_ROOT_EVIDENCE_MISSING');
 if(strongerAlternatives.length) failures.push('RCA_STRONGER_ALTERNATIVE_UNFALSIFIED');
 const graph=diagnosis?.causalGraph??{};
 const propagationPath=Array.isArray(graph.propagationPath)?graph.propagationPath.filter(Boolean):[];
 if(propagationPath.length<3) failures.push('RCA_PROPAGATION_PATH_INCOMPLETE');
 if(graph.responsibleSource!==location) failures.push('RCA_SOURCE_NOT_LINKED');
 if(!graph.violatedInvariant) failures.push('RCA_VIOLATED_INVARIANT_MISSING');
 const trigger=graph.trigger??diagnosis?.trigger??null;
 const mechanism={hypothesisId:selectedHypothesis?.id??root,evidenceLines:selectedHypothesis?.evidenceLines??[],sourceLocation:location,errorCodes:diagnosis?.errorCodes??[],verificationStrategy:diagnosis?.verificationStrategy??null};
 const contributingFactors=[...(Array.isArray(diagnosis?.features)?diagnosis.features:[]),...(Array.isArray(diagnosis?.reusableKnowledge?.lessons)?diagnosis.reusableKnowledge.lessons.slice(0,5):[])];
 const boundaryConditions=[{name:'exactSha',value:targetSha},{name:'failureFingerprint',value:failureFingerprint},{name:'ambiguity',value:ambiguity},{name:'selectedFiles',value:(fileSelection.selectedFiles??[]).map(x=>x.path)}];
 const expectedState={contract:'CURRENT_CANONICAL_STATE_WITH_ZERO_TARGET_FAILURE',invariant:graph.violatedInvariant??null,observableSignal:String(failureLog).slice(0,1000)};
 const proposedState={strategyId:strategy.strategyId??strategy.selected?.id??null,targetFile:location,mutationPending:true};
 const nodes=[
  {id:'SYMPTOM',kind:'SYMPTOM',value:String(graph.observableSymptom??failureLog.slice(0,1000)),evidence:['failureLog',...(selectedHypothesis?.evidenceLines??[]).slice(0,3)]},
  {id:'TRIGGER',kind:'TRIGGER',value:trigger,evidence:trigger?['trigger:'+String(trigger)]:[]},
  {id:'MECHANISM',kind:'MECHANISM',value:mechanism,evidence:mechanism.evidenceLines},
  {id:'ROOT_CAUSE',kind:'ROOT_CAUSE',value:root,evidence:mechanism.evidenceLines},
  {id:'SOURCE',kind:'CAUSAL_SOURCE',value:location,evidence:['location:'+String(location)]},
  {id:'INVARIANT',kind:'VIOLATED_INVARIANT',value:graph.violatedInvariant,evidence:['invariant:'+String(graph.violatedInvariant)]},
  {id:'EXPECTED_STATE',kind:'EXPECTED_STATE',value:expectedState,evidence:['current-canonical-contract']},
  {id:'PROPOSED_STATE',kind:'PROPOSED_STATE',value:proposedState,evidence:['selected-strategy']},
 ];
 const edges=[['SYMPTOM','TRIGGER'],['TRIGGER','MECHANISM'],['MECHANISM','ROOT_CAUSE'],['ROOT_CAUSE','SOURCE'],['ROOT_CAUSE','INVARIANT'],['INVARIANT','EXPECTED_STATE'],['SOURCE','PROPOSED_STATE']];
 const status=failures.length?'BLOCK':'PROVEN';
 return Object.freeze({schemaVersion:1,protocol:'CAUSAL-EVIDENCE-GRAPH-v1',status,targetSha,failureFingerprint,failedRunId,chain:{symptom:nodes.find(n=>n.id==='SYMPTOM').value,trigger,mechanism,rootCause:root,contributingFactors,boundaryConditions,expectedState,proposedState},graph:{nodes,edges,propagationPath,violatedInvariant:graph.violatedInvariant,responsibleSource:location},alternatives:{all:alternatives,strongerUnfalsified:strongerAlternatives,count:alternatives.length},evidence:{exactSha:true,failureFingerprintBound:true,directFailureSignal,diagnosisQuality:diagnosis?.diagnosisQuality??null,causalConfidence:confidence,rootHypothesisEvidence:mechanism.evidenceLines},proofClaims:{ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL:directFailureSignal&&mechanism.evidenceLines.length>0,LOCATION_LINKED_TO_CAUSE:graph.responsibleSource===location&&Boolean(location),MECHANISM_EXPLAINED:mechanism.evidenceLines.length>0,ALTERNATIVES_CHALLENGED:strongerAlternatives.length===0,EVIDENCE_CURRENT_SHA:shaOk(targetSha)},failures,sourceMutationAllowed:false,digest:crypto.createHash('sha256').update(JSON.stringify({targetSha,failureFingerprint,root,location,mechanism,edges})).digest('hex'),generatedAt:new Date().toISOString()});
}

if(process.argv[1]?.endsWith('action-root-cause-proof.mjs')){
 const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):fallback;};
 const diagnosis=read(arg('diagnosis'));const strategy=read(arg('strategy'));const selection=read(arg('file-selection'));
 const proof=buildRootCauseProof({targetSha:arg('sha'),failureFingerprint:arg('fingerprint'),failedRunId:arg('run-id'),diagnosis,strategy,fileSelection:selection,failureLog:fs.readFileSync(arg('log'),'utf8')});
 const out=arg('output','/tmp/action-root-cause-proof.json');fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({status:proof.status,targetSha:proof.targetSha,failureFingerprint:proof.failureFingerprint,digest:proof.digest,failures:proof.failures},null,2));
 if(proof.status!=='PROVEN')process.exitCode=1;
}