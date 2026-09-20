import type { RawCellBotId } from './council-account-registry.ts';

export const CELL_HEADQUARTERS_ID = 'CELL-HQ' as const;
export const CELL_CONTROL_SEAT_ID = 'CELL-CONTROL-SEAT' as const;
export const CELL_PRIMARY_RUNTIME_ID = 'CHIEF' as const;
export const CELL_CHAIR = 'assistantController' as const;

export const CELL_COMMUNICATION_CHANNELS = Object.freeze(['CONTROL','PRESENCE','RCA','TASK','VERIFY','KNOWLEDGE'] as const);
export const CELL_RESPONSIBLE_AGENTS = Object.freeze([
  'assistantController','taskAgent','errorAgent','repairAgent','codeScout','reviewAgent',
  'testAgent','securityAgent','performanceAgent','certificationAuthority'
] as const);

export type CellCommunicationChannel = typeof CELL_COMMUNICATION_CHANNELS[number];
export type CellResponsibleAgent = typeof CELL_RESPONSIBLE_AGENTS[number];

export const CELL_CONTROL_SEAT = Object.freeze({
  seatId: CELL_CONTROL_SEAT_ID,
  headquartersId: CELL_HEADQUARTERS_ID,
  chair: CELL_CHAIR,
  runtimeAccountId: CELL_PRIMARY_RUNTIME_ID,
  mutationAuthority: false,
  certificationAuthority: false,
} as const);

export type CellPlan = {
  planId: string; version: number; entrySha: string; planHash: string;
  objective: string; issuedBy: typeof CELL_CHAIR; status: 'ACTIVE'|'SUPERSEDED'|'BLOCKED';
};
export type CellAssignment = {
  botId: RawCellBotId; taskId: string; scope: string; planId: string;
  planVersion: number; entrySha: string; expectedOutput: string[];
};
export type CellPresenceRequest = {
  requestId: string; messageId: string; botId: RawCellBotId; taskId: string;
  channel: 'PRESENCE'; priority: 'P0'|'P1'|'P2'|'P3'; reason: string;
  exactSha: string; evidence: string[]; requestedAction: string; blocking: boolean;
  target: typeof CELL_CHAIR;
};
export type CellKnowledgeReturn = {
  knowledgeId: string; botId: RawCellBotId; taskId: string; planId: string; planVersion: number;
  exactSha: string; statement: string; evidence: string[]; validation: string;
  reusableLesson: string; controllerAction: 'REUSE'|'TEACH'|'SPECIALIZE'|'RECYCLE'|'ESCALATE';
};
const required = (v: string, n: string) => { if (!v.trim()) throw new Error('CELL_REQUIRED_' + n.toUpperCase()); };
const sha = (v: string) => { if (!/^[0-9a-f]{40}$/u.test(v)) throw new Error('CELL_EXACT_SHA_INVALID'); };

export function assertCellPlan(plan: CellPlan, observedSha: string): void {
  required(plan.planId,'plan_id'); required(plan.planHash,'plan_hash'); required(plan.objective,'objective');
  if (!Number.isInteger(plan.version) || plan.version < 1) throw new Error('CELL_PLAN_VERSION_INVALID');
  sha(plan.entrySha);
  if (plan.issuedBy !== CELL_CHAIR || plan.status !== 'ACTIVE') throw new Error('CELL_PLAN_NOT_ACTIVE');
  if (plan.entrySha !== observedSha) throw new Error('CELL_PLAN_STALE_ENTRY_SHA');
}
export function assertCellAssignment(a: CellAssignment, plan: CellPlan, observedSha: string): void {
  assertCellPlan(plan, observedSha);
  if (a.planId !== plan.planId || a.planVersion !== plan.version) throw new Error('CELL_ASSIGNMENT_PLAN_MISMATCH');
  if (a.entrySha !== observedSha) throw new Error('CELL_ASSIGNMENT_STALE_ENTRY_SHA');
  required(a.taskId,'task_id'); required(a.scope,'scope');
  if (!Array.isArray(a.expectedOutput) || !a.expectedOutput.length) throw new Error('CELL_ASSIGNMENT_EXPECTED_OUTPUT_REQUIRED');
}
export function createPresenceRequest(input: Omit<CellPresenceRequest,'channel'|'target'>): CellPresenceRequest {
  required(input.requestId,'presence_request_id'); required(input.messageId,'message_id');
  required(input.taskId,'task_id'); required(input.reason,'reason'); required(input.requestedAction,'requested_action'); sha(input.exactSha);
  if (!Array.isArray(input.evidence) || !input.evidence.length) throw new Error('CELL_PRESENCE_EVIDENCE_REQUIRED');
  return Object.freeze({...input,channel:'PRESENCE' as const,target:CELL_CHAIR});
}
export function assertKnowledgeReturn(r: CellKnowledgeReturn): void {
  for (const [v,n] of [[r.knowledgeId,'knowledge_id'],[r.botId,'bot_id'],[r.taskId,'task_id'],[r.planId,'plan_id'],
    [r.statement,'statement'],[r.validation,'validation'],[r.reusableLesson,'reusable_lesson']] as const) required(v,n);
  if (!Number.isInteger(r.planVersion) || r.planVersion < 1) throw new Error('CELL_KNOWLEDGE_PLAN_VERSION_INVALID');
  sha(r.exactSha);
  if (!Array.isArray(r.evidence) || !r.evidence.length) throw new Error('CELL_KNOWLEDGE_EVIDENCE_REQUIRED');
}
export const channelIsAllowed = (channel: string): channel is CellCommunicationChannel =>
  CELL_COMMUNICATION_CHANNELS.includes(channel as CellCommunicationChannel);
