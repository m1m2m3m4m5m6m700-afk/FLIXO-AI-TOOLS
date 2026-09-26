import { getAgentProfile } from './agent-profile.ts';
import type { DecomposedTask, DecomposedTaskKind } from './task-decomposer.ts';
export const SPECIALIST_ORCHESTRATOR_VERSION=2 as const;
const MAX_SPECIALISTS=6;
export type SpecialistLens='browser-observation'|'react-performance'|'frontend-design';
export type SpecialistAssignment=Readonly<{id:string;taskId:string;profileId:string;responsibility:string;mode:'ADVISORY';mutationAuthority:false;certificationAuthority:false;}>;
export type SpecialistPlan=Readonly<{version:typeof SPECIALIST_ORCHESTRATOR_VERSION;specialists:readonly SpecialistAssignment[];lenses:readonly SpecialistLens[];}>;
const ROLE:Readonly<Record<DecomposedTaskKind,string>>=Object.freeze({UNDERSTAND:'analysis',PLAN:'ACTION-CODE-MENTOR',EXECUTE:'executionAgent',VERIFY:'testAgent',REVIEW:'reviewAgent'});
const normalizeLenses=(input:{taskInput:string;requiredLenses?:readonly string[]}):readonly SpecialistLens[]=>{
 const explicit=new Set(input.requiredLenses?.filter((value): value is SpecialistLens =>value==='browser-observation'||value==='react-performance'||value==='frontend-design')??[]);
 const text=input.taskInput;
 if(/(?:browser|runtime|console|network|devtools|playwright|متصفح|تشغيل|كونسول|شبكة)/iu.test(text))explicit.add('browser-observation');
 if(/(?:react|vite|render|rerender|bundle|performance|lcp|inp|cls|أداء|ريآكت|حزمة)/iu.test(text))explicit.add('react-performance');
 if(/(?:ui|ux|design|layout|visual|rtl|accessibility|واجهة|تصميم|مرئ|تجربة)/iu.test(text))explicit.add('frontend-design');
 return Object.freeze([...explicit]);
};
export function buildSpecialistPlan(input:{taskInput:string;tasks:readonly DecomposedTask[];requiredLenses?:readonly string[]}):SpecialistPlan{
 const a:SpecialistAssignment[]=[];const seen=new Set<string>();
 const lenses=normalizeLenses(input);
 const add=(taskId:string,profileId:string,responsibility:string)=>{if(a.length>=MAX_SPECIALISTS||seen.has(profileId))return;if(!getAgentProfile(profileId))throw new Error('SPECIALIST_PROFILE_MISSING:'+profileId);seen.add(profileId);a.push(Object.freeze({id:'specialist-'+(a.length+1),taskId,profileId,responsibility,mode:'ADVISORY',mutationAuthority:false,certificationAuthority:false}));};
 const responsibility=(task:DecomposedTask):string=>{
  if(task.kind==='VERIFY'&&lenses.includes('browser-observation'))return'browser observation, runtime evidence, and exact-SHA verification';
  if(task.kind==='PLAN'&&lenses.includes('react-performance'))return'React/Vite performance review using measured proof';
  if(task.kind==='REVIEW'&&lenses.includes('frontend-design'))return'frontend design, accessibility, responsive, and RTL review';
  return task.kind.toLowerCase()+' specialist';
 };
 for(const t of input.tasks)add(t.id,ROLE[t.kind],responsibility(t));
 if(lenses.includes('browser-observation')&&!seen.has('testAgent'))add(input.tasks[0]?.id??'task-1','testAgent','browser observation and runtime evidence');
 if(lenses.includes('react-performance')&&!seen.has('ACTION-CODE-MENTOR'))add(input.tasks[0]?.id??'task-1','ACTION-CODE-MENTOR','React/Vite performance guidance');
 if(lenses.includes('frontend-design')&&!seen.has('reviewAgent'))add(input.tasks[0]?.id??'task-1','reviewAgent','frontend design and accessibility review');
 if(/(?:mcp|remote|external|provider|api|network|cloud|خارجي|مزود|شبكة|سحابي)/iu.test(input.taskInput))add(input.tasks[0]?.id??'task-1','securityAgent','external trust-boundary review');
 if(/(?:secret|token|credential|permission|security|privacy|سر|صلاحية|أمان|خصوصية)/iu.test(input.taskInput))add(input.tasks[0]?.id??'task-1','securityAgent','security and permission review');
 if(input.tasks.length>4)add(input.tasks[0]?.id??'task-1','reviewAgent','independent adversarial review');
 if(input.tasks.length>1)add(input.tasks[0]?.id??'task-1','testAgent','cross-step regression design');
 return Object.freeze({version:SPECIALIST_ORCHESTRATOR_VERSION,specialists:Object.freeze(a),lenses});
}
export function assertSpecialistPlanSafety(plan:SpecialistPlan):void{
 if(plan.specialists.length>MAX_SPECIALISTS)throw new Error('SPECIALIST_PLAN_BOUNDEDNESS_VIOLATION');
 for(const s of plan.specialists){
  if(s.mode!=='ADVISORY'||s.mutationAuthority||s.certificationAuthority)throw new Error('SPECIALIST_AUTHORITY_ESCALATION');
  if(!getAgentProfile(s.profileId))throw new Error('SPECIALIST_PROFILE_MISSING:'+s.profileId);
 }
}
