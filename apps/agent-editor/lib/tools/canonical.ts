import { zodToJsonSchema } from "zod-to-json-schema";
import { CAPABILITY_REGISTRY, getCapability, validateCapabilityParameters } from "../../../../src/lib/agent/capability-registry";

export type CanonicalAgentTool = Readonly<{
  id:string; name:string; description:string; category:"Images"|"Video";
  jsonSchemaInput:Record<string,unknown>;
  parameterSchema:typeof CAPABILITY_REGISTRY[number]["parameterSchema"];
  executionMode:typeof CAPABILITY_REGISTRY[number]["executionMode"];
  executorId:string; maxPixels:number; maxFileSizeBytes:number; outputContractId:string;
}>;

const toJsonSchema=(schema:typeof CAPABILITY_REGISTRY[number]["parameterSchema"]):Record<string,unknown>=>{
  const value=zodToJsonSchema(schema,{$refStrategy:"none",target:"jsonSchema7"}) as Record<string,unknown>;
  delete value.$schema; return value;
};
export const CANONICAL_AGENT_TOOLS:readonly CanonicalAgentTool[]=Object.freeze(
  CAPABILITY_REGISTRY
    .filter((tool)=>tool.state==="EXECUTABLE")
    .map((tool)=>Object.freeze({
    id:tool.id,name:tool.id,description:tool.description,category:tool.category,
    jsonSchemaInput:toJsonSchema(tool.parameterSchema),parameterSchema:tool.parameterSchema,
    executionMode:tool.executionMode,executorId:tool.operational.executorId,
    maxPixels:tool.safetyLimits.maxPixels,maxFileSizeBytes:tool.safetyLimits.maxFileSizeBytes,
    outputContractId:tool.operational.outputContractId,
  })),
);
export function getCanonicalAgentTool(id:string):CanonicalAgentTool|undefined{return CANONICAL_AGENT_TOOLS.find((tool)=>tool.id===id);}
export function validateCanonicalAgentParameters(toolName:string,parameters:unknown){if(!getCapability(toolName)) throw new Error(`CANONICAL_TOOL_NOT_EXECUTABLE:${toolName}`);return validateCapabilityParameters(toolName,parameters);}
