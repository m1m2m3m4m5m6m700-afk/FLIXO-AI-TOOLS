import {
  CAPABILITY_DEFINITIONS,
  getCanonicalCapabilityDefinition,
  MVP_EXECUTABLE_TOOL_IDS,
  type CanonicalCapabilityDefinition,
  type CanonicalCapabilityLimits,
  type CanonicalCapabilityParameters,
  type CanonicalCapabilityState,
  type CanonicalCapabilityVerifier,
  type CanonicalExecutionMode,
} from "./canonical-capability-definition";
import type { ZodType } from "zod";

export type CapabilityState = CanonicalCapabilityState;
export type ExecutionMode = CanonicalExecutionMode;
export type CapabilityParameters = CanonicalCapabilityParameters;
export type CapabilityVerifier = CanonicalCapabilityVerifier;
export type CapabilityLimits = CanonicalCapabilityLimits;

export type CapabilityContract = Readonly<{
  id:string; title:string; description:string; category:"Images"|"Video"; family:"image"|"video";
  state:CapabilityState; executionMode:ExecutionMode; execution:"browser-local"|"browser-worker";
  intents:readonly string[]; parameterSchema:ZodType; safetyLimits:CapabilityLimits; verifier:CapabilityVerifier;
  requirements:Readonly<{browser:true;network:false}>;
  recovery:Readonly<{maxAttempts:3;replanOnFailure:false}>;
  operational:CanonicalCapabilityDefinition["operational"];
}>;

export const CAPABILITY_REGISTRY:readonly CapabilityContract[]=Object.freeze(CAPABILITY_DEFINITIONS.map((d)=>Object.freeze({...d})));
const byId=new Map(CAPABILITY_REGISTRY.map((c)=>[c.id,c]));
export function getCapability(id:string):CapabilityContract|undefined{return byId.get(id);}
export function getCapabilitiesByState(state:CapabilityState):readonly CapabilityContract[]{return CAPABILITY_REGISTRY.filter((c)=>c.state===state);}
export function getExecutableCapabilityIds():readonly string[]{return [...MVP_EXECUTABLE_TOOL_IDS];}
export function validateCapabilityParameters(id:string,parameters:unknown={}):CapabilityParameters{
  const capability=getCapability(id);
  if(!capability) throw new Error(`Unknown capability: ${id}`);
  if(capability.state!=="EXECUTABLE") throw new Error(`Capability '${id}' is not executable.`);
  const parsed=capability.parameterSchema.safeParse(parameters);
  if(!parsed.success) throw new Error(`Capability '${id}' parameters failed canonical schema validation.`);
  if(parameters!==null&&typeof parameters==="object"&&!Array.isArray(parameters)&&parsed.data!==null&&typeof parsed.data==="object"&&!Array.isArray(parsed.data)){
    const accepted=new Set(Object.keys(parsed.data as Record<string,unknown>));
    const unknown=Object.keys(parameters as Record<string,unknown>).filter((key)=>!accepted.has(key));
    if(unknown.length) throw new Error(`Capability '${id}' received unsupported parameters.`);
  }
  return parsed.data as CapabilityParameters;
}
export function assertExecutionResourceBudget(id:string,inputBlob:Blob,requestedPixels?:number):void{
  const capability=getCapability(id);
  if(!capability) throw new Error(`Unknown capability: ${id}`);
  if(capability.state!=="EXECUTABLE") throw new Error(`Capability '${id}' is not executable.`);
  if(inputBlob.size>capability.safetyLimits.maxFileSizeBytes) throw new Error(`Capability '${id}' input exceeds the safe file-size limit.`);
  if(requestedPixels!==undefined&&requestedPixels>capability.safetyLimits.maxPixels) throw new Error(`Capability '${id}' request exceeds the safe pixel limit.`);
}
export { getCanonicalCapabilityDefinition };
