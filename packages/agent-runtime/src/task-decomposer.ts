export const TASK_DECOMPOSER_VERSION = 1 as const;
export type DecomposedTaskKind = 'UNDERSTAND' | 'PLAN' | 'EXECUTE' | 'VERIFY' | 'REVIEW';
export type DecomposedTask = Readonly<{ id: string; kind: DecomposedTaskKind; title: string; objective: string; dependencies: readonly string[]; successCriteria: readonly string[]; advisoryOnly: true; }>;
export type TaskDecomposition = Readonly<{ version: typeof TASK_DECOMPOSER_VERSION; inputFingerprint: string; complexity: number; shouldDecompose: boolean; tasks: readonly DecomposedTask[]; }>;
const MAX_TASKS=8;
const SPLIT=/(?:,|;|\n|\bthen\b|\band then\b|\bafter that\b|\bثم\b|\bوبعد(?:ها|ذلك)?\b)+/giu;
const norm=(s:string)=>s.trim().replace(/\s+/gu,' ');
function kind(s:string):DecomposedTaskKind{
  if(/(?:verify|check|validate|proof|evidence|تأكد|تحقق|فحص|إثبات|دليل)/iu.test(s))return'VERIFY';
  if(/(?:review|audit|inspect|compare|دقق|قارن|تدقيق)/iu.test(s))return'REVIEW';
  if(/(?:plan|steps|workflow|strategy|خطة|خطوات|مسار)/iu.test(s))return'PLAN';
  if(/(?:remove|compress|crop|resize|convert|blur|upscale|generate|edit|background|إزالة|ضغط|قص|تغيير|تحويل|رفع|إنشاء|تعديل|خلفية)/iu.test(s))return'EXECUTE';
  return'UNDERSTAND';
}
function fp(s:string){let h=2166136261;for(const c of norm(s)){h^=c.codePointAt(0)??0;h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function task(i:number,k:DecomposedTaskKind,o:string,d:readonly string[]):DecomposedTask{
  const criteria=k==='UNDERSTAND'?['goal and constraints are represented without invented facts']:k==='PLAN'?['registered capabilities only','dependencies explicit']:k==='EXECUTE'?['canonical capability authority performs execution']:k==='VERIFY'?['registered verifier and output contract pass']:['review remains advisory until current evidence resolves findings'];
  const title:{[K in DecomposedTaskKind]:string}={UNDERSTAND:'Understand',PLAN:'Plan',EXECUTE:'Execute',VERIFY:'Verify',REVIEW:'Review'};
  return Object.freeze({id:'task-'+(i+1),kind:k,title:title[k]+': '+o.slice(0,140),objective:o,dependencies:Object.freeze([...d]),successCriteria:Object.freeze(criteria),advisoryOnly:true});
}
export function decomposeTask(input:string,options:{force?:boolean}={}):TaskDecomposition{
  const n=norm(input);if(!n)throw new Error('Task input is required.');
  const clauses=n.split(SPLIT).map(norm).filter(Boolean).slice(0,MAX_TASKS-2);
  const complexity=Math.min(100,clauses.length*12+Math.min(30,new Set(clauses.map(kind)).size*10)+( /(?:and|then|ثم|وبعد|while|also|مع)/iu.test(n)?18:0)+Math.min(40,n.length/12));
  const should=Boolean(options.force)||clauses.length>1||complexity>=30;
  const out:DecomposedTask[]=[task(0,'UNDERSTAND',n,[])];let prev='task-1';
  if(should){for(const c of clauses){if(out.length>=MAX_TASKS-1)break;let k=kind(c);if(k==='UNDERSTAND'&&out.length>1)k='PLAN';const t=task(out.length,k,c,[prev]);out.push(t);prev=t.id;}}
  else{const p=task(1,'PLAN',n,['task-1']);const e=task(2,'EXECUTE',n,[p.id]);out.push(p,e);prev=e.id;}
  out.push(task(out.length,'VERIFY',n,[prev]));
  return Object.freeze({version:TASK_DECOMPOSER_VERSION,inputFingerprint:fp(n),complexity:Math.round(complexity*100)/100,shouldDecompose:should,tasks:Object.freeze(out)});
}
