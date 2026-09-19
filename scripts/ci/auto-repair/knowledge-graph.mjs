import { createHash } from 'node:crypto';
const idFor=(kind,value)=>createHash('sha256').update(kind+':'+String(value??'unknown'),'utf8').digest('hex').slice(0,16);
export function buildRepairKnowledgeGraph({fingerprint,targetSha,diagnosis=null,plan=null,simulation=null,selfCritic=null,causalProof=null}={}){
  const nodes=[
    {id:idFor('failure',fingerprint),kind:'failure',value:fingerprint??null},
    {id:idFor('sha',targetSha),kind:'target-sha',value:targetSha??null},
    {id:idFor('root-cause',diagnosis?.rootCause),kind:'root-cause',value:diagnosis?.rootCause??null},
    {id:idFor('rule',plan?.id),kind:'repair-rule',value:plan?.id??null},
    {id:idFor('file',plan?.file),kind:'source-file',value:plan?.file??null},
    {id:idFor('simulation',fingerprint),kind:'simulation',value:simulation?.reason??null},
    {id:idFor('critic',fingerprint),kind:'self-critic',value:selfCritic?.verdict??null},
    {id:idFor('proof',fingerprint),kind:'causal-proof',value:causalProof?.ok===true},
  ];
  const edges=[['failure','sha'],['failure','root-cause'],['root-cause','rule'],['rule','file'],['rule','simulation'],['rule','self-critic'],['rule','causal-proof']]
    .map(([fromKind,toKind])=>({from:nodes.find(n=>n.kind===fromKind)?.id??null,to:nodes.find(n=>n.kind===toKind)?.id??null}));
  return Object.freeze({schemaVersion:1,protocol:'FLIXO-REPAIR-KNOWLEDGE-GRAPH-v1',fingerprint:fingerprint??null,targetSha:targetSha??null,nodes,edges,valid:edges.every(edge=>edge.from&&edge.to)});
}
