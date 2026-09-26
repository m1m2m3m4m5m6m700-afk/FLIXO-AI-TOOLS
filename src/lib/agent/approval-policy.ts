import type { ExecutionPlanContract } from '@/lib/contracts/ai-plan';
import { getCapability } from './capability-registry';
import { getToolById } from '@/config/registry';

export type ApprovalLevel = 'AUTO' | 'CONFIRM' | 'BLOCK';

export type ApprovalDecision = Readonly<{
  level: ApprovalLevel;
  reasons: readonly string[];
}>;

const CLOUD_CONFIRM = new Set(['ai-image-generator', 'photo-colorizer']);
const BLOCKED_SIDE_EFFECT_PATTERNS = [
  /^send[-_:]/i,
  /^publish[-_:]/i,
  /^delete[-_:]/i,
  /^external[-_:]/i,
];

export function evaluateCapabilityApproval(toolId: string): ApprovalDecision {
  const capability = getCapability(toolId);
  const tool = getToolById(toolId);
  if (!capability || !tool || capability.state !== 'EXECUTABLE') {
    return { level: 'BLOCK', reasons: ['CAPABILITY_NOT_EXECUTABLE'] };
  }
  if (BLOCKED_SIDE_EFFECT_PATTERNS.some((pattern) => pattern.test(toolId))) {
    return { level: 'BLOCK', reasons: ['EXTERNAL_SIDE_EFFECT_NOT_ALLOWED'] };
  }
  if (tool.executionMode === 'CLOUD' || CLOUD_CONFIRM.has(toolId)) {
    return { level: 'CONFIRM', reasons: ['CLOUD_EXECUTION'] };
  }
  return { level: 'AUTO', reasons: ['LOCAL_EXECUTION'] };
}

export function evaluatePlanApproval(plan: ExecutionPlanContract): ApprovalDecision {
  let level: ApprovalLevel = 'AUTO';
  const reasons: string[] = [];
  for (const step of plan.steps) {
    const decision = evaluateCapabilityApproval(step.toolId);
    reasons.push(...decision.reasons.map((reason) => step.toolId + ':' + reason));
    if (decision.level === 'BLOCK') return { level: 'BLOCK', reasons };
    if (decision.level === 'CONFIRM') level = 'CONFIRM';
  }
  return { level, reasons };
}
