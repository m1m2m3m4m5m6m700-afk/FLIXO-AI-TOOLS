import { useMemo, useState } from 'react';
import { askConversationalAgent } from '@/lib/agent/conversational-agent';
import type { ExecutionPlan } from '@/lib/ai/planner';

type ChatRow={id:number;role:'user'|'assistant';content:string};

const STORAGE='flixo-master-repair-chat-v1';
const MAX=120;
const starter:ChatRow={id:1,role:'assistant',content:'أنا FLIXO BOT. أستطيع مناقشة المشكلة معك، الاحتفاظ بسياق الجلسة، وتحويل ما نتفق عليه إلى خطة إصلاح مقيدة.'};

function load():ChatRow[]{
  if(typeof window==='undefined')return [starter];
  try{const raw=window.localStorage.getItem(STORAGE);if(!raw)return [starter];const rows=JSON.parse(raw) as ChatRow[];return Array.isArray(rows)&&rows.length?rows.slice(-MAX):[starter];}catch{return [starter];}
}
function persist(rows:ChatRow[]){try{window.localStorage.setItem(STORAGE,JSON.stringify(rows.slice(-MAX)));}catch{/* chat must remain usable */}}

export function MasterRepairChat(){
  const [rows,setRows]=useState<ChatRow[]>(load);
  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [plan,setPlan]=useState<ExecutionPlan|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [provider,setProvider]=useState<string|null>(null);
  const visible=useMemo(()=>rows.slice(-80),[rows]);
  const send=async()=>{
    const text=input.trim(); if(!text||busy)return;
    const next=[...rows,{id:Date.now(),role:'user' as const,content:text}];
    setRows(next);persist(next);setInput('');setBusy(true);setError(null);
    try{
      const decision=await askConversationalAgent({locale:'ar',messages:next.slice(-80).map(m=>({role:m.role,content:m.content})),activePlan:plan,activeCommand:text});
      setProvider(decision.provider??null);
      const answer=decision.mode==='clarify'&&decision.question?decision.reply+'\n'+decision.question:decision.reply;
      const reply=[...next,{id:Date.now()+1,role:'assistant' as const,content:answer}];
      setRows(reply);persist(reply);
      if(decision.mode==='plan'&&decision.plan)setPlan(decision.plan as ExecutionPlan);
      else if(decision.mode!=='plan')setPlan(null);
    }catch(cause){
      const message=cause instanceof Error?cause.message:'تعذر الوصول إلى محرك المحادثة.';
      setError(message);
      const reply=[...next,{id:Date.now()+1,role:'assistant' as const,content:'توقفت عند حدود محرك المحادثة. لم أنفذ أي تغيير برمجي. '+message}];
      setRows(reply);persist(reply);
    }finally{setBusy(false);}
  };
  const clear=()=>{setRows([starter]);setPlan(null);setError(null);setProvider(null);try{window.localStorage.removeItem(STORAGE);}catch{void 0;}};
  return <section className='mr-chat-card' aria-labelledby='mr-chat-title'>
    <div className='mr-chat-head'><div><span className='mr-chat-eyebrow'>MASTER REPAIR</span><h2 id='mr-chat-title'>محادثة كاملة مع البوت</h2><p>سياق مستمر · فهم المتابعة · خطة إصلاح قبل التنفيذ</p></div><div className='mr-chat-head-actions'><span className='mr-chat-status'>{busy?'يفكر…':'جاهز'}</span><button type='button' onClick={clear}>محادثة جديدة</button></div></div>
    <div className='mr-chat-body' aria-live='polite'>{visible.map(row=><div key={row.id} className={'mr-chat-row '+row.role}><div className='mr-chat-avatar'>{row.role==='assistant'?'FB':'أنت'}</div><div className='mr-chat-bubble'>{row.content}</div></div>)}{busy&&<div className='mr-chat-typing'><span/> <span/> <span/></div>}</div>
    <div className='mr-chat-context'><span>السياق: {rows.length-1} رسالة</span><span>{provider?`المحرك: ${provider}`:'المحرك: تلقائي'}</span><span>{plan?`خطة: ${plan.steps.length} خطوات`:'لا توجد خطة معلقة'}</span></div>
    {plan&&<div className='mr-chat-plan'><strong>خطة مقترحة</strong>{plan.steps.map((step,index)=><div key={`${step.toolId}-${index}`}><b>{index+1}.</b> {step.toolId}</div>)}</div>}
    {error&&<div className='mr-chat-error'>{error}</div>}
    <div className='mr-chat-input'><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder='تحدث مع FLIXO BOT…' rows={2} disabled={busy}/><button type='button' onClick={()=>void send()} disabled={!input.trim()||busy}>{busy?'…':'إرسال'}</button></div>
  </section>;
}

export default MasterRepairChat;