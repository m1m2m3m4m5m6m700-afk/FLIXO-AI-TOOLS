import type { EvaluationEvidence } from "./evaluation.ts";
import type { ObjectiveVerificationContract } from "@flixo/contracts";

export type ObjectiveVerificationInput = Readonly<{ id:string; commandId:string; stepId:string; agentId:string; evidence:EvaluationEvidence; requireTests?:boolean; requireEvidence?:boolean; requiredArtifacts?:readonly string[]; }>;

export class ObjectiveVerifier {
  verify(input: ObjectiveVerificationInput): ObjectiveVerificationContract {
    if (!input.id.trim() || !input.commandId.trim() || !input.stepId.trim() || !input.agentId.trim()) throw new Error("VERIFICATION_IDENTITY_REQUIRED");
    const checks:Array<{id:string;passed:boolean;description:string;evidence:readonly string[]}> = [];
    const testsTotal=(input.evidence.testsPassed??0)+(input.evidence.testsFailed??0);
    if (input.requireTests ?? true) checks.push({id:"tests",passed:testsTotal>0&&(input.evidence.testsFailed??0)===0,description:"Required verification tests pass without recorded failures.",evidence:Object.freeze(["passed="+(input.evidence.testsPassed??0),"failed="+(input.evidence.testsFailed??0)])});
    if (input.requireEvidence ?? true) checks.push({id:"evidence",passed:input.evidence.evidenceVerified===true,description:"Execution evidence is independently marked as verified.",evidence:Object.freeze(["evidenceVerified="+String(input.evidence.evidenceVerified??false)])});
    const required=input.requiredArtifacts??input.evidence.requiredArtifacts??[];
    if(required.length){const completed=new Set(input.evidence.completedArtifacts??[]);const missing=required.filter(x=>!completed.has(x));checks.push({id:"artifacts",passed:missing.length===0,description:"All required artifacts are present.",evidence:Object.freeze(["required="+required.length,"completed="+(required.length-missing.length),...missing.map(x=>"missing="+x)])});}
    const policyClean=(input.evidence.outOfScopeActions??0)===0&&(input.evidence.delegatedTasks??0)===0;
    checks.push({id:"policy",passed:policyClean,description:"No out-of-scope action or unauthorized delegation is recorded.",evidence:Object.freeze(["outOfScope="+(input.evidence.outOfScopeActions??0),"delegated="+(input.evidence.delegatedTasks??0)])});
    const passed=checks.every(x=>x.passed);
    const hasInsufficientEvidence = ((input.requireTests ?? true) && testsTotal === 0) || ((input.requireEvidence ?? true) && input.evidence.evidenceVerified === undefined);
    const status=passed?"verified":hasInsufficientEvidence?"unresolved":"rejected";
    const reason=passed?"All objective verification checks passed.":status==="unresolved"?"Objective evidence is insufficient for a definitive verification decision.":checks.filter(x=>!x.passed).map(x=>x.id).join(",");
    return Object.freeze({id:input.id,commandId:input.commandId,stepId:input.stepId,agentId:input.agentId,status,checks:Object.freeze(checks.map(x=>Object.freeze(x))),evidence:Object.freeze(checks.flatMap(x=>x.evidence)),reason,verifiedAt:new Date().toISOString()});
  }
}
