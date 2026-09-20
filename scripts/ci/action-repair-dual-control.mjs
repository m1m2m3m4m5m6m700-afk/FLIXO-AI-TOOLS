#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const arg=(name,fallback='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):fallback};
const mode=arg('mode','');
const approvalPath=arg('approval','');
const heartbeatPath=arg('heartbeat','');
const targetSha=arg('target-sha','');
const fingerprint=arg('fingerprint','');
const approver=arg('approver','');
const assistant=arg('assistant','');
const out=arg('out','');
const fileSelectionPath=arg('file-selection','');
const programmerTwinParityPath=arg('programmer-twin-parity','');
const primaryProofPath=arg('primary-proof','');
const now=()=>new Date().toISOString();
const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const shaOk=x=>/^[a-f0-9]{40}$/u.test(String(x||''));
if(mode==='audit'){
 const memory=arg('memory');
 const proposal=arg('proposal');
 const evidence=arg('evidence');
 if(!shaOk(targetSha)||!fingerprint||!memory||!proposal||!evidence) throw new Error('ACTION_PAIR_AUDIT_INPUT_REQUIRED');
 if(!fileSelectionPath||!fs.existsSync(fileSelectionPath)) throw new Error('ACTION_PAIR_FILE_SELECTION_REQUIRED');
 if(!programmerTwinParityPath||!fs.existsSync(programmerTwinParityPath)) throw new Error('ACTION_PAIR_PROGRAMMER_TWIN_PARITY_REQUIRED');
 if(!primaryProofPath||!fs.existsSync(primaryProofPath)) throw new Error('ACTION_PAIR_PRIMARY_CORRECTNESS_PROOF_REQUIRED');
 const m=read(memory), p=read(evidence), s=read(arg('strategy')), fileSelection=read(fileSelectionPath), programmerTwinParity=read(programmerTwinParityPath), primaryProof=read(primaryProofPath);
 if(programmerTwinParity.status!=='EXACT_INTELLIGENCE_PARITY'||programmerTwinParity.intelligenceParity!=='EXACT'||programmerTwinParity.authorityParity!=='SEPARATED_BY_DESIGN'||programmerTwinParity.primaryAgent!=='ACTION-REPAIR'||programmerTwinParity.twinAgent!=='ACTION-REPAIR-2'||programmerTwinParity.targetSha!==targetSha||programmerTwinParity.failureFingerprint!==fingerprint) throw new Error('ACTION_PAIR_PROGRAMMER_TWIN_PARITY_INVALID');
 if(primaryProof.role!=='PRIMARY_CORRECTNESS_PROVER'||primaryProof.status!=='PRIMARY_CORRECTNESS_CLAIM'||primaryProof.proofObjective!=='PROVE_PRIMARY_REPAIR_CORRECT'||primaryProof.targetSha!==targetSha||primaryProof.failureFingerprint!==fingerprint||primaryProof.agentId!=='ACTION-REPAIR') throw new Error('ACTION_PAIR_PRIMARY_CORRECTNESS_PROOF_INVALID');
 if(!Array.isArray(primaryProof.obligationsForVerifier)||primaryProof.obligationsForVerifier.length<4) throw new Error('ACTION_PAIR_PRIMARY_PROOF_OBLIGATIONS_INCOMPLETE');
 if(fileSelection.agentId!=='ACTION-HISTORIAN-3'||fileSelection.protocol!=='ACTION-FILE-SELECTION-INTELLIGENCE-v1'||fileSelection.targetSha!==targetSha||fileSelection.failureFingerprint!==fingerprint||fileSelection.pathOnlyAnalysis!==true||fileSelection.codeContentRead!==false||fileSelection.sourceMutationAllowed!==false||fileSelection.decision!=='SELECTED'||!Array.isArray(fileSelection.selectedFiles)||fileSelection.selectedFiles.length<1) throw new Error('ACTION_PAIR_FILE_SELECTION_INVALID');
 const alternatives=(Array.isArray(p.hypotheses)?p.hypotheses:[])
   .filter((item)=>item?.id && item.id!==p.rootCause)
   .slice(0,3)
   .map((item)=>({id:item.id,score:Number(item.score??0),directMatches:Number(item.directMatches??0),specificity:Number(item.specificity??0),suppressedBy:item.suppressedBy??null}));
 const falsificationChecks=Array.isArray(p.falsificationChecks)?p.falsificationChecks:[];
 const evidenceProfile=p.evidenceProfile??null;
 const sourceMutationAllowed=p.sourceMutationAllowed===true;
 const secondHypothesis=p.secondHypothesis??alternatives[0]??null;
 const primaryScore=Number(p.hypothesisScore??p.score??1);
 const strongCounterexample=alternatives.some((item)=>Number(item.score??0)>=Math.max(0.9,primaryScore*0.95));
 const scopeCounterexample=!fileSelection.selectedFiles.some((item)=>item.path===primaryProof.evidenceAnchors?.failureLocation);
 const proofWeakness=Number(primaryProof.evidenceAnchors?.causalConfidence??0)<0.85 || primaryProof.evidenceAnchors?.directFailureSignal!==true;
 const counterexampleFound=strongCounterexample||scopeCounterexample||proofWeakness;
 const falsificationSearches=[
   {type:'ALTERNATIVE_ROOT_CAUSE',status:strongCounterexample?'COUNTEREXAMPLE_FOUND':'NO_VALID_COUNTEREXAMPLE',evidence:alternatives},
   {type:'SCOPE_VIOLATION',status:scopeCounterexample?'COUNTEREXAMPLE_FOUND':'NO_VALID_COUNTEREXAMPLE',evidence:{failureLocation:primaryProof.evidenceAnchors?.failureLocation,selectedFiles:fileSelection.selectedFiles}},
   {type:'PATCH_COUNTEREXAMPLE',status:proofWeakness?'COUNTEREXAMPLE_FOUND':'NO_VALID_COUNTEREXAMPLE',evidence:{causalConfidence:primaryProof.evidenceAnchors?.causalConfidence}},
   {type:'REGRESSION_COUNTEREXAMPLE',status:'REQUIRES_POST_REPAIR_CANONICAL_VERIFICATION',evidence:{remainingRisks:primaryProof.openRisks||[]}}
 ];
 if(!sourceMutationAllowed || falsificationChecks.length<1 || Number(evidenceProfile?.diversity??0)<2) throw new Error('ACTION_PAIR_ADVERSARIAL_CHALLENGE_FAILED');
 if(counterexampleFound) throw new Error('ACTION_PAIR_PRIMARY_PROOF_FALSIFIED');
 const record={
   schemaVersion:4,botId:'ACTION-REPAIR-2',role:'ADVERSARIAL_PROGRAMMER_FALSIFIER',verifierAgent:'actionRepairVerifier',
   status:'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE',challengeId:'ARP2-'+crypto.createHash('sha256').update(JSON.stringify({targetSha,fingerprint,p.rootCause,secondHypothesis})).digest('hex').slice(0,20),
   targetSha,failureFingerprint:fingerprint,fingerprint,runId:arg('run-id'),partner:'ACTION-REPAIR',observedAt:now(),redNotGreen:true,
   programmerTwinParity:{artifact:programmerTwinParityPath,status:programmerTwinParity.status,intelligenceParity:programmerTwinParity.intelligenceParity,authorityParity:programmerTwinParity.authorityParity},
   programmerTwinAnalysis:{required:true,independentReasoning:true,sameProgrammingIntelligence:true,mutationAuthority:false},
   primaryCorrectnessProof:{artifact:primaryProofPath,objective:primaryProof.proofObjective,status:primaryProof.status},
   falsificationObjective:'ATTEMPT_TO_PROVE_PRIMARY_REPAIR_WRONG',
   falsificationComplete:true,
   counterexampleFound:false,
   falsificationSearches,
   fileSelectionDecision:{artifact:fileSelectionPath,decision:fileSelection.decision,primaryFile:fileSelection.primaryFile,selectedFiles:fileSelection.selectedFiles,excludedFiles:fileSelection.excludedFiles,confidence:fileSelection.confidence},
   rootCause:p.rootCause||'unknown',strategy:s.strategyId||null,
   challengeMode:'FALSIFY_PRIMARY',
   alternativeHypotheses:alternatives,
   falsificationChecks,
   counterEvidence:{
     mutationGate:p.mutationGate??null,
     evidenceProfile,
     sourceMutationAllowed,
     hypothesisSeparation:p.separation??null,
     causalConfidence:p.causalConfidence??null
   },
   remainingRisks:Array.isArray(p.blastRadius)?p.blastRadius:[],
   mutationRecommendation:'ALLOW_AFTER_FALSIFICATION_NO_COUNTEREXAMPLE',
   proposal:{auditOnly:true,recommendedStrategy:s.strategyId||null,evidenceRefs:[evidence,memory],decision:p.decision??null},
   learn:{retainUntilGreen:true}
 };
 fs.writeFileSync(proposal,JSON.stringify(record,null,2)+'\n');
 const next={...m,lastAudit:record,records:[...(m.records||[]),record].slice(-5000)};
 fs.writeFileSync(memory,JSON.stringify(next,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',botId:'ACTION-REPAIR-2',mode,redRecorded:true,targetSha},null,2)); process.exit(0);
}
if(mode==='approve'){
 if(approver!=='ACTION-REPAIR'||assistant!=='ACTION-REPAIR-2'||!shaOk(targetSha)||!fingerprint) throw new Error('ACTION_PAIR_APPROVAL_IDENTITY_INVALID');
 const p=read(approvalPath.replace(/approval\.json$/u,'proposal.json'));
 if(p.status!=='FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE'||p.role!=='ADVERSARIAL_PROGRAMMER_FALSIFIER'||p.verifierAgent!=='actionRepairVerifier'||p.targetSha!==targetSha||p.failureFingerprint!==fingerprint||!Array.isArray(p.alternativeHypotheses)||p.alternativeHypotheses.length<1||!Array.isArray(p.falsificationChecks)||p.falsificationChecks.length<1||!p.fileSelectionDecision?.primaryFile||!Array.isArray(p.fileSelectionDecision?.selectedFiles)||p.fileSelectionDecision.selectedFiles.length<1||!p.primaryCorrectnessProof?.objective||p.primaryCorrectnessProof.objective!=='PROVE_PRIMARY_REPAIR_CORRECT'||p.falsificationComplete!==true||p.counterexampleFound!==false||!Array.isArray(p.falsificationSearches)||p.falsificationSearches.length<4||!p.programmerTwinParity?.intelligenceParity||p.programmerTwinParity.intelligenceParity!=='EXACT') throw new Error('ACTION_PAIR_APPROVAL_REQUIRES_VERIFIED_CHALLENGE');
 const approval={schemaVersion:4,programmerTwinParityRequired:true,adversarialFalsificationRequired:true,approvalId:'ARP2-'+crypto.createHash('sha256').update(JSON.stringify({targetSha,fingerprint,p})).digest('hex').slice(0,24),approver,approvedFor:assistant,targetSha,fingerprint,approvedAt:now(),decision:'APPROVED_FOR_ASSISTANT_EXECUTION',condition:'ERROR_ONLY_EXACT_SHA+ADVERSARIAL_FALSIFICATION_NO_COUNTEREXAMPLE'};
 fs.writeFileSync(approvalPath,JSON.stringify(approval,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',decision:approval.decision,approvalId:approval.approvalId},null,2)); process.exit(0);
}
if(mode==='heartbeat'){
 if(!shaOk(targetSha)||!out) throw new Error('ACTION_PAIR_HEARTBEAT_INPUT_REQUIRED');
 const hb={schemaVersion:1,primary:arg('primary'),assistant:arg('assistant'),targetSha,state:arg('state'),createdAt:now(),expiresAt:new Date(Date.now()+120000).toISOString()};
 fs.writeFileSync(out,JSON.stringify(hb,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',heartbeat:true,targetSha},null,2)); process.exit(0);
}
if(mode==='assert'){
 const a=read(approvalPath), h=read(heartbeatPath);
 if(a.decision!=='APPROVED_FOR_ASSISTANT_EXECUTION'||a.approver!=='ACTION-REPAIR'||a.approvedFor!=='ACTION-REPAIR-2'||a.targetSha!==targetSha) throw new Error('ACTION_PAIR_APPROVAL_REJECTED');
 if(h.primary!=='ACTION-REPAIR'||h.assistant!=='ACTION-REPAIR-2'||h.targetSha!==targetSha||h.state!=='READY_FOR_MUTATION') throw new Error('ACTION_PAIR_HEARTBEAT_REJECTED');
 if(Date.parse(h.expiresAt)<=Date.now()) throw new Error('ACTION_PAIR_HEARTBEAT_EXPIRED');
 console.log(JSON.stringify({status:'PASS',dualControl:true,targetSha},null,2)); process.exit(0);
}
throw new Error('ACTION_PAIR_MODE_INVALID');
