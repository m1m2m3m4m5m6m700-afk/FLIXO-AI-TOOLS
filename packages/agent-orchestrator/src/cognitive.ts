export type VerificationState = "pending" | "verified" | "rejected" | "unresolved";
export type AgentCognitiveState = Readonly<{ commandId:string; stepId:string; agentId:string; goal:string; hypotheses:readonly string[]; assumptions:readonly string[]; plannedActions:readonly string[]; observations:readonly string[]; evidence:readonly string[]; uncertainties:readonly string[]; detectedRisks:readonly string[]; rejectedApproaches:readonly string[]; decision?:string; confidence:number; verificationState:VerificationState; updatedAt:string; }>;
export type DecisionRecord = Readonly<{ id:string; commandId:string; stepId:string; agentId:string; decision:string; alternatives:readonly string[]; evidence:readonly string[]; confidence:number; verificationState:VerificationState; outcome?:string; reward?:number; timestamp:string; }>;
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