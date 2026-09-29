import { classifyModelTask, type ModelTaskKind } from './model-router.ts';

export type PublicAgentId = 'FLIXO_AGENT';
export type InternalSpecialistId =
  | 'analysis'
  | 'codeScout'
  | 'errorAgent'
  | 'repairAgent'
  | 'executionAgent'
  | 'reviewAgent'
  | 'testAgent'
  | 'securityAgent'
  | 'performanceAgent'
  | 'certificationAuthority'
  | 'actionHistorian'
  | 'actionRepairBot'
  | 'actionRepairVerifier';

export type AgentRoutingDecision = Readonly<{
  publicAgent: PublicAgentId;
  specialist: InternalSpecialistId | null;
  task: ModelTaskKind;
  directSpecialistAccess: false;
  reason: string;
}>;

const SPECIALIST_RULES: readonly Readonly<{
  specialist: InternalSpecialistId;
  task: ModelTaskKind;
  patterns: RegExp;
  reason: string;
}>[] = Object.freeze([
  { specialist: 'reviewAgent', task: 'REVIEW', patterns: /review|audit|security|red.?team|راجع|دقق|أمان|خصوصية/iu, reason: 'adversarial or security review requested' },
  { specialist: 'testAgent', task: 'VERIFY', patterns: /test|verify|validate|proof|تحقق|اختبر|تأكد|دليل/iu, reason: 'verification requested' },
  { specialist: 'executionAgent', task: 'EXECUTION_PLANNING', patterns: /edit|remove|compress|crop|resize|convert|background|تعديل|إزالة|ضغط|قص|تحويل|خلفية/iu, reason: 'FLIXO editing execution requested' },
  { specialist: 'codeScout', task: 'UNDERSTAND', patterns: /repository|dependency|codebase|repo|مستودع|اعتماد|كود/iu, reason: 'repository understanding requested' },
  { specialist: 'analysis', task: 'UNDERSTAND', patterns: /analy[sz]|explain|اشرح|حلل|تحليل/iu, reason: 'analysis requested' },
]);

export function routeThroughFlixoAgent(userInput: string): AgentRoutingDecision {
  const input = String(userInput ?? '').trim();
  const task = classifyModelTask(input);
  const matched = SPECIALIST_RULES.find((rule) => rule.task === task && rule.patterns.test(input));
  return Object.freeze({
    publicAgent: 'FLIXO_AGENT',
    specialist: matched?.specialist ?? null,
    task,
    directSpecialistAccess: false,
    reason: matched?.reason ?? 'FLIXO Agent handles the request directly.',
  });
}

export function assertPublicAgentBoundary(agentId: string): void {
  if (agentId !== 'FLIXO_AGENT') {
    throw new Error('DIRECT_SPECIALIST_ACCESS_DENIED');
  }
}
