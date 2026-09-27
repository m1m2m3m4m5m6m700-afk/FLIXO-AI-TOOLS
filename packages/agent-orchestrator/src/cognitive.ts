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
export type FailureSeverity = "low" | "medium" | "high" | "critical";
export type FailurePattern =
  | "verification-test-failure"
  | "verification-evidence-missing"
  | "verification-evidence-rejected"
  | "artifact-missing"
  | "quality-review-findings"
  | "security-findings-present"
  | "performance-regression"
  | "policy-boundary-violation"
  | "unknown-failure";

export type FailureTaxonomyEntry = Readonly<{
  pattern: FailurePattern;
  category: FailureCategory;
  severity: FailureSeverity;
  correctiveAction: string;
}>;

export const FAILURE_TAXONOMY: Readonly<Record<FailurePattern, FailureTaxonomyEntry>> = Object.freeze({
  "verification-test-failure": { pattern: "verification-test-failure", category: "correctness", severity: "high", correctiveAction: "repair failing behavior and rerun verification tests" },
  "verification-evidence-missing": { pattern: "verification-evidence-missing", category: "verification", severity: "medium", correctiveAction: "produce independently verifiable evidence before promotion" },
  "verification-evidence-rejected": { pattern: "verification-evidence-rejected", category: "evidence", severity: "medium", correctiveAction: "replace unsupported evidence with independently verifiable evidence" },
  "artifact-missing": { pattern: "artifact-missing", category: "correctness", severity: "medium", correctiveAction: "complete missing required artifacts and verify them" },
  "quality-review-findings": { pattern: "quality-review-findings", category: "quality", severity: "medium", correctiveAction: "resolve review findings and rerun quality checks" },
  "security-findings-present": { pattern: "security-findings-present", category: "security", severity: "high", correctiveAction: "resolve security findings before promotion" },
  "performance-regression": { pattern: "performance-regression", category: "performance", severity: "medium", correctiveAction: "profile the regression, repair it, and verify performance" },
  "policy-boundary-violation": { pattern: "policy-boundary-violation", category: "policy", severity: "critical", correctiveAction: "enforce command scope and delegation boundaries" },
  "unknown-failure": { pattern: "unknown-failure", category: "unknown", severity: "low", correctiveAction: "collect structured evidence and classify the failure" },
});

export type FailureRecord = Readonly<{
  id:string;
  commandId:string;
  stepId:string;
  agentId:string;
  category:FailureCategory;
  severity:FailureSeverity;
  pattern:FailurePattern;
  evidence:readonly string[];
  correctiveAction:string;
  timestamp:string;
}>;

export type FailureAggregate = Readonly<{
  pattern: FailurePattern;
  category: FailureCategory;
  occurrences: number;
  agents: number;
  maxSeverity: FailureSeverity;
  lastSeen: string;
}>;

const SEVERITY_RANK: Readonly<Record<FailureSeverity, number>> = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });

export class FailureIntelligence {
  private readonly failures: FailureRecord[]=[];

  classify(commandId:string,stepId:string,agentId:string,evidence:EvaluationEvidence): FailureRecord[] {
    const patterns = new Set<FailurePattern>();
    if ((evidence.testsFailed??0)>0) patterns.add("verification-test-failure");
    if (evidence.evidenceVerified === undefined) patterns.add("verification-evidence-missing");
    else if (evidence.evidenceVerified === false) patterns.add("verification-evidence-rejected");

    const required = evidence.requiredArtifacts ?? [];
    const completed = new Set(evidence.completedArtifacts ?? []);
    if (required.some((artifact) => !completed.has(artifact))) patterns.add("artifact-missing");
    if ((evidence.reviewFindings??0)>0) patterns.add("quality-review-findings");
    if ((evidence.securityFindings??0)>0) patterns.add("security-findings-present");
    if ((evidence.performanceRegressions??0)>0) patterns.add("performance-regression");
    if ((evidence.outOfScopeActions??0)>0 || (evidence.delegatedTasks??0)>0) patterns.add("policy-boundary-violation");

    return [...patterns].map((pattern,index)=>{
      const entry=FAILURE_TAXONOMY[pattern];
      const record:FailureRecord=Object.freeze({
        id:`${commandId}:${stepId}:failure-${index+1}`,
        commandId,stepId,agentId,
        category:entry.category,
        severity:entry.severity,
        pattern,
        evidence:Object.freeze([
          evidence.notes ? evidence.notes : "",
          `testsFailed=${evidence.testsFailed??0}`,
          `reviewFindings=${evidence.reviewFindings??0}`,
          `securityFindings=${evidence.securityFindings??0}`,
          `performanceRegressions=${evidence.performanceRegressions??0}`,
        ].filter(Boolean)),
        correctiveAction:entry.correctiveAction,
        timestamp:new Date().toISOString()
      });
      this.failures.push(record);
      return record;
    });
  }

  list(agentId?:string):readonly FailureRecord[] {
    return Object.freeze(this.failures.filter(f=>!agentId||f.agentId===agentId));
  }

  patterns(agentId:string):readonly FailurePattern[] {
    return Object.freeze([...new Set(this.list(agentId).map(f=>f.pattern))]);
  }

  aggregates(agentId?:string):readonly FailureAggregate[] {
    const groups=new Map<FailurePattern,FailureRecord[]>();
    for(const failure of this.list(agentId)){
      const bucket=groups.get(failure.pattern)??[];
      bucket.push(failure);
      groups.set(failure.pattern,bucket);
    }
    return Object.freeze([...groups.entries()].map(([pattern,items])=>{
      const maxSeverity=items.reduce<FailureSeverity>((max,item)=>SEVERITY_RANK[item.severity]>SEVERITY_RANK[max]?item.severity:max,"low");
      return Object.freeze({
        pattern,
        category:FAILURE_TAXONOMY[pattern].category,
        occurrences:items.length,
        agents:new Set(items.map(item=>item.agentId)).size,
        maxSeverity,
        lastSeen:items.at(-1)?.timestamp??new Date(0).toISOString(),
      });
    }).sort((a,b)=>b.occurrences-a.occurrences||SEVERITY_RANK[b.maxSeverity]-SEVERITY_RANK[a.maxSeverity]||a.pattern.localeCompare(b.pattern)));
  }
}
