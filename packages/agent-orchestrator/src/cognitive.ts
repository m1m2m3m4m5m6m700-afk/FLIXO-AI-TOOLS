import type { AgentCognitiveStateContract, AgentDecisionContract, CognitiveVerificationState } from "@flixo/contracts";
import type { EvaluationEvidence } from "./evaluation.ts";
export type VerificationState = CognitiveVerificationState;
export type AgentCognitiveState = AgentCognitiveStateContract;
export type DecisionRecord = AgentDecisionContract;
export type CognitiveTraceEvent = Readonly<{ sequence:number; type:"state"|"decision"|"verification"|"observation"; commandId:string; stepId:string; agentId:string; timestamp:string; data:Readonly<Record<string,unknown>>; }>;
export type AgentCognitiveSnapshot = Readonly<{ states:readonly AgentCognitiveState[]; decisions:readonly DecisionRecord[]; events:readonly CognitiveTraceEvent[]; }>;
const bounded=(v:number)=>Math.min(1,Math.max(0,v));
const clean=(v:readonly string[]|undefined):readonly string[]=>Object.freeze((v??[]).map(x=>x.trim()).filter(Boolean));
export class AgentCognitiveLedger {
 private sequence=0; private readonly states=new Map<string,AgentCognitiveState>(); private readonly decisions:DecisionRecord[]=[]; private readonly events:CognitiveTraceEvent[]=[];
 upsertState(input:Omit<AgentCognitiveState,"confidence"|"updatedAt">&{confidence:number}):AgentCognitiveState {
  if(!input.commandId.trim()||!input.stepId.trim()||!input.agentId.trim()) throw new Error("COGNITIVE_IDENTITY_REQUIRED");
  if(!input.goal.trim()) throw new Error("COGNITIVE_GOAL_REQUIRED");
  const state:AgentCognitiveState=Object.freeze({...input,hypotheses:clean(input.hypotheses),assumptions:clean(input.assumptions),plannedActions:clean(input.plannedActions),observations:clean(input.observations),evidence:clean(input.evidence),uncertainties:clean(input.uncertainties),detectedRisks:clean(input.detectedRisks),rejectedApproaches:clean(input.rejectedApproaches),confidence:bounded(input.confidence),updatedAt:new Date().toISOString()});
  this.states.set(input.commandId+":"+input.stepId,state); this.emit("state",state.commandId,state.stepId,state.agentId,state); return state;
 }
 recordDecision(input:Omit<DecisionRecord,"id"|"timestamp">&{id?:string}):DecisionRecord {
  if(!input.decision.trim()) throw new Error("DECISION_REQUIRED");
  const record:DecisionRecord=Object.freeze({...input,id:input.id?.trim()||("decision-"+(this.decisions.length+1)),alternatives:clean(input.alternatives),evidence:clean(input.evidence),confidence:bounded(input.confidence),timestamp:new Date().toISOString()});
  this.decisions.push(record); this.emit("decision",record.commandId,record.stepId,record.agentId,record); return record;
 }
 verifyDecision(id:string,state:VerificationState,outcome?:string,reward?:number):DecisionRecord {
  const i=this.decisions.findIndex(x=>x.id===id); if(i<0) throw new Error("DECISION_NOT_FOUND:"+id);
  if(reward!==undefined&&!Number.isFinite(reward)) throw new Error("INVALID_DECISION_REWARD");
  const updated:DecisionRecord=Object.freeze({...this.decisions[i],verificationState:state,outcome,reward}); this.decisions[i]=updated; this.emit("verification",updated.commandId,updated.stepId,updated.agentId,updated); return updated;
 }
 observe(commandId:string,stepId:string,agentId:string,observation:string):void { if(!observation.trim()) throw new Error("OBSERVATION_REQUIRED"); this.emit("observation",commandId,stepId,agentId,{observation:observation.trim()}); }
 snapshot():AgentCognitiveSnapshot { return Object.freeze({states:Object.freeze([...this.states.values()]),decisions:Object.freeze([...this.decisions]),events:Object.freeze([...this.events])}); }
 private emit(type:CognitiveTraceEvent["type"],commandId:string,stepId:string,agentId:string,data:Readonly<Record<string,unknown>>):void { this.events.push(Object.freeze({sequence:++this.sequence,type,commandId,stepId,agentId,timestamp:new Date().toISOString(),data})); }
}
export type ConfidenceCalibrationSample=Readonly<{confidence:number;verified:boolean}>;
export type AgentCalibration=Readonly<{sampleCount:number;averageConfidence:number;empiricalAccuracy:number;absoluteCalibrationError:number}>;
export class ConfidenceCalibrator {
 private readonly samples=new Map<string,ConfidenceCalibrationSample[]>();
 record(agentId:string,confidence:number,verified:boolean):void { if(!agentId.trim()) throw new Error("AGENT_ID_REQUIRED"); if(confidence<0||confidence>1) throw new Error("INVALID_CONFIDENCE"); const s=this.samples.get(agentId)??[]; s.push(Object.freeze({confidence,verified})); this.samples.set(agentId,s); }
 summarize(agentId:string):AgentCalibration { const s=this.samples.get(agentId)??[]; if(!s.length)return Object.freeze({sampleCount:0,averageConfidence:0,empiricalAccuracy:0,absoluteCalibrationError:0}); const avg=s.reduce((a,x)=>a+x.confidence,0)/s.length; const acc=s.filter(x=>x.verified).length/s.length; return Object.freeze({sampleCount:s.length,averageConfidence:avg,empiricalAccuracy:acc,absoluteCalibrationError:Math.abs(avg-acc)}); }
}
export class CognitiveTraceObserver {
  constructor(private readonly ledger: AgentCognitiveLedger) {}

  onDispatch(instruction: Readonly<{ stepId:string; commandId:string; role:string; objective:string; constraints:readonly string[]; context:Readonly<Record<string,unknown>> }>): void {
    this.ledger.upsertState({
      commandId: instruction.commandId,
      stepId: instruction.stepId,
      agentId: instruction.role,
      goal: instruction.objective,
      hypotheses: [],
      assumptions: instruction.constraints,
      plannedActions: [],
      observations: [],
      evidence: [],
      uncertainties: [],
      detectedRisks: [],
      rejectedApproaches: [],
      confidence: 0.5,
      verificationState: "pending",
    });
  }

  onReport(report: Readonly<{ stepId:string; commandId:string; status:"completed"|"failed"|"blocked"; summary:string; evidence?:Readonly<Record<string,unknown>> }>): void {
    const evidence = report.evidence ?? {};
    const agentId = typeof evidence.agentId === "string" ? evidence.agentId : "unknown";
    this.ledger.observe(report.commandId, report.stepId, agentId, report.summary);
  }
}

export type FailureCategory = "correctness" | "verification" | "quality" | "security" | "performance" | "policy" | "evidence" | "unknown";
export type FailureRecord = Readonly<{ id:string; commandId:string; stepId:string; agentId:string; category:FailureCategory; severity:"low"|"medium"|"high"|"critical"; pattern:string; evidence:readonly string[]; correctiveAction:string; timestamp:string; }>;
export class FailureIntelligence {
  private readonly failures: FailureRecord[]=[];
  classify(commandId:string,stepId:string,agentId:string,evidence:EvaluationEvidence): FailureRecord[] {
    const findings: Array<{category:FailureCategory;severity:FailureRecord["severity"];pattern:string;correctiveAction:string}> = [];
    if ((evidence.testsFailed??0)>0) findings.push({category:"correctness",severity:"high",pattern:"verification-test-failure",correctiveAction:"repair failing behavior and rerun the verification suite"});
    if (evidence.evidenceVerified===false) findings.push({category:"evidence",severity:"medium",pattern:"evidence-not-verified",correctiveAction:"provide independently verifiable evidence"});
    if ((evidence.securityFindings??0)>0) findings.push({category:"security",severity:"high",pattern:"security-findings-present",correctiveAction:"resolve security findings before promotion"});
    if ((evidence.performanceRegressions??0)>0) findings.push({category:"performance",severity:"medium",pattern:"performance-regression",correctiveAction:"profile the regression and verify the fix"});
    if ((evidence.outOfScopeActions??0)>0 || (evidence.delegatedTasks??0)>0) findings.push({category:"policy",severity:"critical",pattern:"policy-boundary-violation",correctiveAction:"enforce command scope and delegation policy"});
    return findings.map((f,i)=>{const record:FailureRecord=Object.freeze({id:`${commandId}:${stepId}:failure-${i+1}`,commandId,stepId,agentId,...f,evidence:Object.freeze([evidence.notes??""]),timestamp:new Date().toISOString()}); this.failures.push(record); return record;});
  }
  list(agentId?:string):readonly FailureRecord[] { return Object.freeze(this.failures.filter(f=>!agentId||f.agentId===agentId)); }
  patterns(agentId:string):readonly string[] { return Object.freeze([...new Set(this.list(agentId).map(f=>f.pattern))]); }
}
