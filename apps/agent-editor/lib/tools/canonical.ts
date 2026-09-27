import { zodToJsonSchema } from "zod-to-json-schema";
import { MVP_EXECUTABLE_TOOL_IDS, TOOL_DEFINITIONS, type ToolDefinition } from "../../../../src/config/canonical-tool-definition";

export type CanonicalAgentTool = Readonly<{
  id:string;
  name:string;
  description:string;
  category:string;
  jsonSchemaInput:Record<string,unknown>;
  parameterSchema:ToolDefinition["parameterSchema"];
  executionMode:ToolDefinition["executionMode"];
  executorId:string;
  maxPixels:number;
  maxFileSizeBytes:number;
  outputContractId:string;
}>;

const EXECUTABLE_IDS=new Set<string>(MVP_EXECUTABLE_TOOL_IDS);

function toJsonSchema(schema:ToolDefinition["parameterSchema"]):Record<string,unknown>{
  const value=zodToJsonSchema(schema,{$refStrategy:"none",target:"jsonSchema7"}) as Record<string,unknown>;
  delete value.$schema;
  return value;
}

export const CANONICAL_AGENT_TOOLS:readonly CanonicalAgentTool[]=Object.freeze(
  TOOL_DEFINITIONS
    .filter((tool)=>EXECUTABLE_IDS.has(tool.id)&&tool.capability.state==="EXECUTABLE")
    .map((tool)=>{
      if(!tool.operational.executorId||!tool.operational.outputContractId) throw new Error(`Canonical executable tool is missing an execution binding: ${tool.id}`);
      return Object.freeze({
        id:tool.id,name:tool.id,description:tool.description,category:tool.category,
        jsonSchemaInput:toJsonSchema(tool.parameterSchema),parameterSchema:tool.parameterSchema,
        executionMode:tool.executionMode,executorId:tool.operational.executorId,
        maxPixels:tool.safetyLimits.maxPixels,maxFileSizeBytes:tool.safetyLimits.maxFileSizeBytes,
        outputContractId:tool.operational.outputContractId,
      });
    }),
);

if(CANONICAL_AGENT_TOOLS.length!==MVP_EXECUTABLE_TOOL_IDS.length) throw new Error(`Canonical Agent Tool projection mismatch: expected ${MVP_EXECUTABLE_TOOL_IDS.length}, got ${CANONICAL_AGENT_TOOLS.length}.`);

export function getCanonicalAgentTool(id:string):CanonicalAgentTool|undefined{
  return CANONICAL_AGENT_TOOLS.find((tool)=>tool.id===id);
}

export function validateCanonicalAgentParameters(toolName:string,parameters:unknown):Record<string,string|number|boolean>{
  const tool=getCanonicalAgentTool(toolName);
  if(!tool) throw new Error(`CANONICAL_TOOL_NOT_EXECUTABLE:${toolName}`);
  const parsed=tool.parameterSchema.safeParse(parameters);
  if(!parsed.success||parsed.data===null||typeof parsed.data!=="object"||Array.isArray(parsed.data)) throw new Error(`CANONICAL_TOOL_PARAMETER_SCHEMA_INVALID:${toolName}`);
  const value=parsed.data as Record<string,string|number|boolean>;
  if(parameters!==null&&typeof parameters==="object"&&!Array.isArray(parameters)){
    const accepted=new Set(Object.keys(value));
    const unknown=Object.keys(parameters as Record<string,unknown>).filter((key)=>!accepted.has(key));
    if(unknown.length>0) throw new Error(`CANONICAL_TOOL_UNSUPPORTED_PARAMETERS:${toolName}`);
  }
  return value;
}
