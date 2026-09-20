import type { ToolDefinition } from '@/config/canonical-tool-definition.ts';
import type { TaskContext } from './task-state.ts';

export type ExecutionPermission = 'READ' | 'WRITE' | 'EXECUTE';
export type ExecutionRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type ExecutionAuditStage = 'AUTHORIZATION' | 'EXECUTION' | 'VERIFICATION' | 'RECOVERY';
export type ExecutionAuditOutcome = 'ALLOW' | 'BLOCK' | 'SUCCESS' | 'FAILURE';
export type ExecutionLogLevel = 'INFO' | 'WARN' | 'ERROR';
export type ToolSecurityProfile = Readonly<{ permission: ExecutionPermission; risk: ExecutionRisk; network: boolean; externalProcessing: boolean; browserLocal: boolean; privacyBoundary: 'LOCAL_ONLY' | 'EXTERNAL_ENDPOINT' }>;
export type RecoveryMetadata = Readonly<{ maxAttempts: number; replanOnFailure: boolean; retryAllowed: boolean; recoveryMode: 'RETRY_OR_REPLAN' | 'RETRY_ONLY' | 'FAIL_CLOSED' }>;
export type ExecutionAuditEvent = Readonly<{
  schemaVersion: 1; eventId: string; timestamp: string; traceId: string; taskId: string; capabilityId: string;
  stage: ExecutionAuditStage; outcome: ExecutionAuditOutcome; executionMode: ToolDefinition['executionMode'];
  permission: ExecutionPermission; risk: ExecutionRisk; network: boolean;
  security: ToolSecurityProfile; recovery: RecoveryMetadata; message?: string;
  errorClass?: 'VALIDATION' | 'EXECUTION' | 'OUTPUT' | 'INFRASTRUCTURE' | 'USER_INPUT' | 'SECURITY' | 'UNKNOWN';
}>;
const digest=async(value:unknown):Promise<string>=>{const bytes=new TextEncoder().encode(JSON.stringify(value));const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),(byte)=>byte.toString(16).padStart(2,'0')).join('');};
export function deriveToolSecurityProfile(tool:ToolDefinition):ToolSecurityProfile{
  const externalProcessing=tool.executionMode==='CLOUD'||tool.requirements.network;
  const risk:ExecutionRisk=tool.executionMode==='CLOUD'?'HIGH':tool.requirements.network?'MEDIUM':'LOW';
  return Object.freeze({permission:tool.capability.state==='EXECUTABLE'?'EXECUTE':'READ',risk,network:tool.requirements.network,externalProcessing,browserLocal:tool.executionMode!=='CLOUD'&&!tool.requirements.network,privacyBoundary:externalProcessing?'EXTERNAL_ENDPOINT':'LOCAL_ONLY'});
}
export function deriveRecoveryMetadata(tool:ToolDefinition):RecoveryMetadata{
  const rawAttempts=Number(tool.recovery.maxAttempts);
  const maxAttempts=Number.isFinite(rawAttempts)?Math.max(0,Math.min(8,Math.floor(rawAttempts))):0;
  const retryAllowed=maxAttempts>0;
  return Object.freeze({maxAttempts,replanOnFailure:tool.recovery.replanOnFailure,retryAllowed,recoveryMode:tool.recovery.replanOnFailure?'RETRY_OR_REPLAN':retryAllowed?'RETRY_ONLY':'FAIL_CLOSED'});
}
function sanitizeMessage(message:unknown):string|undefined{
  if(message==null)return undefined;
  return String(message)
    .replace(/(Bearer|Token|Api-Key|Authorization|Cookie|Set-Cookie)\s*[:=]?\s*[^\s;]+/gi,'$1 [REDACTED]')
    .replace(/https?:\/\/[^\s]+/gi,'[URL]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[IP]')
    .replace(/[\r\n\t]+/g,' ')
    .slice(0,500);
}
export function classifyExecutionFailure(error:unknown):ExecutionAuditEvent['errorClass']{
  const text=String(error instanceof Error?error.message:error??'');
  if(/security|permission|authorization|forbidden|csrf|trust boundary|unauthenticated/i.test(text))return 'SECURITY';
  if(/validation|invalid|schema|parameter|unknown capability/i.test(text))return 'VALIDATION';
  if(/output|artifact|verif|signature|integrity/i.test(text))return 'OUTPUT';
  if(/network|fetch|timeout|rate.?limit|provider|remote/i.test(text))return 'INFRASTRUCTURE';
  if(/input|file|required|missing/i.test(text))return 'USER_INPUT';
  return 'EXECUTION';
}
export function assertExecutionSecurityBoundary(tool:ToolDefinition): void {
  const security = deriveToolSecurityProfile(tool);
  if (tool.executionMode === 'CLOUD' && !tool.requirements.network) throw new Error(`Security boundary violation: CLOUD capability '${tool.id}' requires network permission.`);
  if (tool.executionMode === 'LOCAL' && tool.requirements.network) throw new Error(`Security boundary violation: LOCAL capability '${tool.id}' cannot require network access.`);
  if (security.externalProcessing && security.privacyBoundary !== 'EXTERNAL_ENDPOINT') throw new Error(`Security boundary violation: external capability '${tool.id}' is not marked external.`);
  if (!security.externalProcessing && security.privacyBoundary !== 'LOCAL_ONLY') throw new Error(`Security boundary violation: local capability '${tool.id}' is not marked local-only.`);
  if (tool.capability.state === 'EXECUTABLE' && !tool.isReady) throw new Error(`Security boundary violation: unready capability '${tool.id}' cannot be executable.`);
  if (!Number.isInteger(tool.safetyLimits.maxFileSizeBytes) || tool.safetyLimits.maxFileSizeBytes <= 0) throw new Error(`Security boundary violation: invalid file-size limit for '${tool.id}'.`);
  if (!Number.isInteger(tool.safetyLimits.maxPixels) || tool.safetyLimits.maxPixels <= 0) throw new Error(`Security boundary violation: invalid pixel limit for '${tool.id}'.`);
  if (!Number.isInteger(tool.safetyLimits.timeoutMs) || tool.safetyLimits.timeoutMs <= 0) throw new Error(`Security boundary violation: invalid timeout for '${tool.id}'.`);
}

export function assertExecutionPermission(tool:ToolDefinition, requested:ExecutionPermission): void {
  const granted = deriveToolSecurityProfile(tool).permission;
  if (requested === 'EXECUTE' && granted !== 'EXECUTE') throw new Error(`Execution permission denied for capability '${tool.id}'.`);
  if (requested === 'WRITE' && granted !== 'WRITE') throw new Error(`Write permission denied for capability '${tool.id}'.`);
}

export type StructuredExecutionLog = Readonly<{
  logType: 'flixo.execution.audit';
  level: ExecutionLogLevel;
  event: ExecutionAuditEvent;
}>;

export function toStructuredExecutionLog(event:ExecutionAuditEvent):StructuredExecutionLog {
  const level:ExecutionLogLevel = event.outcome === 'FAILURE' ? 'ERROR' : event.outcome === 'BLOCK' ? 'WARN' : 'INFO';
  return Object.freeze({ logType:'flixo.execution.audit', level, event });
}

function assertExecutionIdentity(value: string, label: string): void {
  if (!value.trim() || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`Execution ${label} is invalid.`);
}

export async function createExecutionAuditEvent({task,capabilityId,tool,stage,outcome,message,errorClass,timestamp=new Date().toISOString()}:{
  task:TaskContext; capabilityId:string; tool:ToolDefinition; stage:ExecutionAuditStage; outcome:ExecutionAuditOutcome;
  message?:string; errorClass?:ExecutionAuditEvent['errorClass']; timestamp?:string;
}):Promise<ExecutionAuditEvent>{
  assertExecutionIdentity(task.taskId,'taskId');
  assertExecutionIdentity(task.traceId,'traceId');
  assertExecutionIdentity(capabilityId,'capabilityId');
  assertExecutionSecurityBoundary(tool);
  const security=deriveToolSecurityProfile(tool);
  const recovery=deriveRecoveryMetadata(tool);
  const base={schemaVersion:1 as const,timestamp,traceId:task.traceId,taskId:task.taskId,capabilityId,stage,outcome,executionMode:tool.executionMode,permission:security.permission,risk:security.risk,network:security.network,security,recovery,message:sanitizeMessage(message),errorClass};
  return Object.freeze({...base,eventId:await digest(base)});
}
export function buildExecutionAuditTrail(events:readonly ExecutionAuditEvent[]):readonly ExecutionAuditEvent[]{
  return Object.freeze([...events].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.eventId.localeCompare(b.eventId)));
}
