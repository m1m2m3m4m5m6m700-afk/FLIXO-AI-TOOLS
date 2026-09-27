"use client";
import { executeCanonicalLocalTool } from "../../../../src/lib/workflows/canonical-local-execution";
import type { LocalExecutionPlan,ToolCallRequest } from "../schemas/agent";
import { ProjectStateSchema,type ProjectState } from "../schemas/project";

function assertLocalMediaUrl(url:string):void{
  if(!url.startsWith("blob:")&&!url.startsWith("data:")) throw new Error("AGENT_LOCAL_MEDIA_SOURCE_REQUIRED");
}
function pickTargetLayer(state:ProjectState,toolName:string){
  const preferredType=toolName.startsWith("video-")?"video":"image";
  return state.layers.find((layer)=>layer.visible&&layer.type===preferredType&&Boolean(layer.url))
    ??state.layers.find((layer)=>layer.visible&&(layer.type==="image"||layer.type==="video")&&Boolean(layer.url));
}
export async function executeAgentToolLocally(state:ProjectState,call:ToolCallRequest,plan:LocalExecutionPlan):Promise<ProjectState>{
  if(plan.callId!==call.callId||plan.toolName!==call.toolName) throw new Error("AGENT_EXECUTION_PLAN_MISMATCH");
  const parsedState=ProjectStateSchema.parse(state);
  const target=pickTargetLayer(parsedState,call.toolName);
  if(!target?.url) throw new Error(`AGENT_TARGET_LAYER_NOT_FOUND:${call.toolName}`);
  assertLocalMediaUrl(target.url);
  const response=await fetch(target.url);
  if(!response.ok) throw new Error(`AGENT_LOCAL_MEDIA_READ_FAILED:${call.toolName}`);
  const inputBlob=await response.blob();
  const result=await executeCanonicalLocalTool({
    toolId:plan.toolName,executorId:plan.executorId,maxPixels:plan.maxPixels,
    maxFileSizeBytes:plan.maxFileSizeBytes,outputContractId:plan.outputContractId,
  },inputBlob,call.parameters);
  const outputUrl=URL.createObjectURL(result.blob);
  if(target.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
  return ProjectStateSchema.parse({
    ...parsedState,
    layers:parsedState.layers.map((layer)=>layer.id===target.id?{
      ...layer,url:outputUrl,
      metadata:{...layer.metadata,lastAgentTool:call.toolName,lastAgentExecution:"canonical-local"},
    }:layer),
    updatedAt:new Date().toISOString(),
    version:parsedState.version+1,
  });
}
