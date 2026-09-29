import type { KnowledgeRecord } from './types';
export type EvidenceAnswer={answer:string,evidence:KnowledgeRecord[],status:'VERIFIED'|'PROBABLE'|'UNKNOWN'|'CONFLICTED'};
export function answerFromEvidence(question:string,records:readonly KnowledgeRecord[]):EvidenceAnswer{
 const usable=records.filter(r=>r.validity==='CURRENT'&&r.status!=='INFERRED'&&r.confidence>=.7);
 if(!usable.length)return {answer:'Unknown: no sufficiently verified current evidence.',evidence:[],status:'UNKNOWN'};
 const scopes=new Map<string,Set<string>>();
 for(const r of usable){const values=scopes.get(r.scope)??new Set<string>();values.add(r.content.trim());scopes.set(r.scope,values);}
 const conflicted=[...scopes.values()].some(values=>values.size>1);
 const best=[...usable].sort((a,b)=>b.confidence-a.confidence||a.fingerprint.localeCompare(b.fingerprint))[0];
 return {answer:best.content,evidence:[best],status:conflicted?'CONFLICTED':best.confidence>=.9?'VERIFIED':'PROBABLE'};
}