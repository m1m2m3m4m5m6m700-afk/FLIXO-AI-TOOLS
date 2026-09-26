import { getAgentProfile } from './agent-profile.ts';
import type { DecomposedTask, DecomposedTaskKind } from './task-decomposer.ts';
export const SPECIALIST_ORCHESTRATOR_VERSION=1 as const;
const MAX_SPECIALISTS=6;
export type SpecialistAssignment=Readonly<{id:string;taskId:string;profileId:string;responsibility:string;mode:'ADVISORY';mutationAuthority:false;certificationAuthority:false;}>;
export type SpecialistPlan=Readonly<{version:typeof SPECIALIST_ORCHESTRATOR_VERSION;specialists:readonly SpecialistAssignment[];}>;
const ROLE:Readonly<Record<DecomposedTaskKind,string>>=Object.freeze({UNDERSTAND:'analysis',PLAN:'ACTION-CODE-MENTOR',EXECUTE:'executionAgent',VERIFY:'testAgent',REVIEW:'reviewAgent'});
export function buildSpecialistPlan(input:{taskInput:string;tasks:readonly DecomposedTask[];requiredLenses?:readonly string[]}):SpecialistPlan{
 const a:SpecialistAssignment[]=[];const seen=new Set<string>();
 const add=(taskId:string,profileId:string,responsibility:string)=>{if(a.length>=MAX_SPECIALISTS||seen.has(profileId))return;if(!getAgentProfile(profileId))throw new Error('SPECIALIST_PROFILE_MISSING:'+profileId);seen.add(profileId);a.push(Object.freeze({id:'specialist-'+(a.length+1),taskId,profileId,responsibility,mode:'ADVISORY',mutationAuthority:false,certificationAuthority:false}));};
 for(const t of input.tasks)add(t.id,ROLE[t.kind],t.kind.toLowerCase()+' specialist');
 if(/(?:mcp|remote|external|provider|api|network|cloud|خارجي|مزود|شبكة|سحابي)/iu.test(input.taskInput))add(input.tasks[0]?.id??'task-1','securityAgent','external trust-boundary review');
 if(/(?:secret|token|credential|permission|security|privacy|سر|صلاحية|أمان|خصوصية)/iu.test(input.taskInput))add(input.tasks[0]?.id??'task-1','securityAgent','security and permission review');
 if(input.tasks.length>4)add(input.tasks[0]?.id??'task-1','reviewAgent','independent adversarial review');
 if(input.tasks.length>1)add(input.tasks[0]?.id??'task-1','testAgent','cross-step regression design');
 return Object.freeze({version:SPECIALIST_ORCHESTRATOR_VERSION,specialists:Object.freeze(a)});
}
export function assertSpecialistPlanSafety(plan:SpecialistPlan):void{if(plan.specialists.length>MAX_SPECIALISTS)throw new Error('SPECIALIST_PLAN_BOUNDEDNESS_VIOLATION');for(const s of plan.specialists){if(s.mode!=='ADVISORY'||s.mutationAuthority||s.certificationAuthority)throw new Error('SPECIALIST_AUTHORITY_ESCALATION');if(!getAgentProfile(s.profileId))throw new Error('SPECIALIST_PROFILE_MISSING:'+s.profileId);}}
