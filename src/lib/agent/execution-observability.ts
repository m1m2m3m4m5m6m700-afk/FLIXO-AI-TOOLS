import type { ToolDefinition } from '@/config/canonical-tool-definition.ts';
import type { TaskContext } from './task-state.ts';

export type ExecutionPermission = 'READ' | 'WRITE' | 'EXECUTE';
export type ExecutionRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type ExecutionAuditStage = 'AUTHORIZATION' | 'EXECUTION' | 'VERIFICATION' | 'RECOVERY';
export type ExecutionAuditOutcome = 'ALLOW' | 'BLOCK' | 'SUCCESS' | 'FAILURE';
export type ToolSecurityProfile = Readonly<{ permission: ExecutionPermission; risk: ExecutionRisk; network: boolean; externalProcessing: boolean; browserLocal: boolean; privacyBoundary: 'LOCAL_ONLY' | 'EXTERNAL_ENDPOINT' }>;
export type RecoveryMetadata = Readonly<{ maxAttempts: number; replanOnFailure: boolean; retryAllowed: boolean; recoveryMode: 'RETRY_OR_REPLAN' | 'RETRY_ONLY' | 'FAIL_CLOSED' }>;
export type ExecutionAuditEvent = Readonly<{
  schemaVersion: 1; eventId: string; timestamp: string; traceId: string; taskId: string; capabilityId: string;
  stage: ExecutionAuditStage; outcome: ExecutionAuditOutcome; executionMode: ToolDefinition['executionMode'];
  permission: ExecutionPermission; risk: ExecutionRisk; network: boolean; message?: string;
  errorClass?: 'VALIDATION' | 'EXECUTION' | 'OUTPUT' | 'INFRASTRUCTURE' | 'USER_INPUT';
}>;
const digest=async(value:unknown):Promise<string>=>{const bytes=new TextEncoder().encode(JSON.stringify(value));const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),(byte)=>byte.toString(16).padStart(2,'0')).join('');};
export function deriveToolSecurityProfile(tool:ToolDefinition):ToolSecurityProfile{
  const externalProcessing=tool.executionMode==='CLOUD'||tool.requirements.network;
  const risk:ExecutionRisk=tool.executionMode==='CLOUD'?'HIGH':tool.requirements.network?'MEDIUM':'LOW';
  return Object.freeze({permission:tool.capability.state==='EXECUTABLE'?'EXECUTE':'READ',risk,network:tool.requirements.network,externalProcessing,browserLocal:tool.executionMode!=='CLOUD'&&!tool.requirements.network,privacyBoundary:externalProcessing?'EXTERNAL_ENDPOINT':'LOCAL_ONLY'});
}
export function deriveRecoveryMetadata(tool:ToolDefinition):RecoveryMetadata{
  const maxAttempts=Math.max(0,Number(tool.recovery.maxAttempts)||0);
  const retryAllowed=maxAttempts>0;
  return Object.freeze({maxAttempts,replanOnFailure:tool.recovery.replanOnFailure,retryAllowed,recoveryMode:tool.recovery.replanOnFailure?'RETRY_OR_REPLAN':retryAllowed?'RETRY_ONLY':'FAIL_CLOSED'});
}
function sanitizeMessage(message:unknown):string|undefined{
  if(message==null)return undefined;
  return String(message).replace(/(?:Bearer|Token|Api-Key)\s+[^\s]+/gi,'$1 [REDACTED]').replace(/https?:\/\/[^\s]+/gi,'[URL]').slice(0,500);
}
export function classifyExecutionFailure(error:unknown):ExecutionAuditEvent['errorClass']{
  const text=String(error instanceof Error?error.message:error??'');
  if(/validation|invalid|schema|parameter|unknown capability/i.test(text))return 'VALIDATION';
  if(/output|artifact|verif|signature|integrity/i.test(text))return 'OUTPUT';
  if(/network|fetch|timeout|rate.?limit|provider|remote/i.test(text))return 'INFRASTRUCTURE';
  if(/input|file|required|missing/i.test(text))return 'USER_INPUT';
  return 'EXECUTION';
}
export async function createExecutionAuditEvent({task,capabilityId,tool,stage,outcome,message,errorClass,timestamp=new Date().toISOString()}:{
  task:TaskContext; capabilityId:string; tool:ToolDefinition; stage:ExecutionAuditStage; outcome:ExecutionAuditOutcome;
  message?:string; errorClass?:ExecutionAuditEvent['errorClass']; timestamp?:string;
}):ExecutionAuditEvent{
  const security=deriveToolSecurityProfile(tool);
  const base={schemaVersion:1 as const,timestamp,traceId:task.traceId,taskId:task.taskId,capabilityId,stage,outcome,executionMode:tool.executionMode,permission:security.permission,risk:security.risk,network:security.network,message:sanitizeMessage(message),errorClass};
  return Object.freeze({...base,eventId:await digest(base)});
}
export function buildExecutionAuditTrail(events:readonly ExecutionAuditEvent[]):readonly ExecutionAuditEvent[]{
  return Object.freeze([...events].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.eventId.localeCompare(b.eventId)));
}
