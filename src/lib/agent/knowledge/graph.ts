import { z } from 'zod';
import type { KnowledgeRecord } from './types';

export const KnowledgeEntitySchema=z.object({id:z.string().min(1).max(256),type:z.string().min(1).max(128),label:z.string().min(1).max(512)}).strict();
export const KnowledgeRelationSchema=z.object({id:z.string().min(1).max(256),from:z.string().min(1),to:z.string().min(1),type:z.string().min(1).max(128),evidence:z.array(z.string().min(1)).min(1)}).strict();
export type KnowledgeEntity=z.infer<typeof KnowledgeEntitySchema>;
export type KnowledgeRelation=z.infer<typeof KnowledgeRelationSchema>;

export function validateKnowledgeGraph(entities:readonly unknown[],relations:readonly unknown[],records:readonly KnowledgeRecord[]) {
 const es=entities.map(x=>KnowledgeEntitySchema.parse(x)); const ids=new Set(es.map(e=>e.id)); const rs=relations.map(x=>KnowledgeRelationSchema.parse(x));
 const fingerprints=new Set(records.map(r=>r.fingerprint));
 for(const r of rs){if(!ids.has(r.from)||!ids.has(r.to)) throw new Error(`Unknown graph endpoint in relation ${r.id}`); if(!r.evidence.every(e=>fingerprints.has(e))) throw new Error(`Relation ${r.id} has unsupported evidence`);}
 return Object.freeze({entities:es,relations:rs});
}