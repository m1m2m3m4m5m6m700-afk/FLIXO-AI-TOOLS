import type {KnowledgeRecord} from './types';
export type EvidenceAnswer={answer:string,evidence:KnowledgeRecord[],status:'VERIFIED'|'PROBABLE'|'UNKNOWN'|'CONFLICTED'};
export function answerFromEvidence(question:string,records:readonly KnowledgeRecord[]):EvidenceAnswer{
 const usable=records.filter(r=>r.validity==='CURRENT'&&r.status!=='INFERRED'&&r.confidence>=.7);
 if(!usable.length)return {answer:'Unknown: no sufficiently verified current evidence.',evidence:[],status:'UNKNOWN'};
 const conflicted=new Set(usable.map(r=>r.scope)).size<usable.length&&new Set(usable.map(r=>r.content.trim())).size>1;
 return {answer:usable[0].content,evidence:[usable[0]],status:conflicted?'CONFLICTED':usable[0].confidence>=.9?'VERIFIED':'PROBABLE'};
}