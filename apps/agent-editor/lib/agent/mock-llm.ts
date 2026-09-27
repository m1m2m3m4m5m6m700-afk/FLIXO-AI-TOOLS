import { MockLLMResultSchema,ToolCallRequestSchema,type MockLLMResult,type ToolCallRequest } from "../schemas/agent";

function stableToken(input:string):string{
  let hash=2166136261;
  for(let index=0;index<input.length;index+=1){hash^=input.charCodeAt(index);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,"0");
}

export function simulateLLMReasoning(prompt:string,callIndex=1):MockLLMResult{
  const normalized=prompt.trim().toLowerCase();
  if(callIndex>1) return MockLLMResultSchema.parse({content:"The canonical local execution plan is ready.",toolCalls:[]});
  const callId=`mock_call_${stableToken(`${normalized}:${callIndex}`)}`;
  const result:{content:string;toolCalls:ToolCallRequest[]}=
    normalized.includes("remove background")||normalized.includes("background")||normalized.includes("إزالة الخلفية")
    ?{content:"I prepared a canonical local background-removal operation.",toolCalls:[{callId,toolName:"background-remover",parameters:{tolerance:42}}]}
    :normalized.includes("lut")||normalized.includes("color")||normalized.includes("filter")||normalized.includes("contrast")||normalized.includes("تباين")
    ?{content:"I prepared a canonical local image-effects operation.",toolCalls:[{callId,toolName:"image-effects",parameters:{contrast:110}}]}
    :normalized.includes("trim")||normalized.includes("cut")||normalized.includes("قص الفيديو")
    ?{content:"I prepared a canonical local video-trimming operation.",toolCalls:[{callId,toolName:"video-trimmer",parameters:{startSec:2,endSec:10}}]}
    :{content:"I can prepare deterministic plans for the canonical FLIXO image and video tools. Describe the edit you want to perform.",toolCalls:[]};
  return MockLLMResultSchema.parse({...result,toolCalls:result.toolCalls.map((call)=>ToolCallRequestSchema.parse(call))});
}
