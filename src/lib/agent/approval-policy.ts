import type { ExecutionPlanContract } from '../contracts/ai-plan.ts';
import { getCapability } from './capability-registry.ts';
import { getToolById } from '../../config/registry.ts';

export type ApprovalLevel = 'AUTO' | 'CONFIRM' | 'BLOCK';

export type ApprovalDecision = Readonly<{
  level: ApprovalLevel;
  reasons: readonly string[];
}>;

export function evaluateCapabilityApproval(toolId: string): ApprovalDecision {
  const capability = getCapability(toolId);
  const tool = getToolById(toolId);

  if (!capability || !tool || capability.state !== 'EXECUTABLE') {
    return Object.freeze({ level: 'BLOCK', reasons: ['CAPABILITY_NOT_EXECUTABLE'] });
  }

  if (tool.executionMode === 'CLOUD' || tool.requirements.network) {
    return Object.freeze({ level: 'CONFIRM', reasons: ['EXTERNAL_PROCESSING_OR_NETWORK'] });
  }

  return Object.freeze({ level: 'AUTO', reasons: ['LOCAL_EXECUTION'] });
}

export function evaluatePlanApproval(plan: ExecutionPlanContract): ApprovalDecision {
  let level: ApprovalLevel = 'AUTO';
  const reasons: string[] = [];

  for (const step of plan.steps) {
    const decision = evaluateCapabilityApproval(step.toolId);
    reasons.push(...decision.reasons.map((reason) => step.toolId + ':' + reason));
    if (decision.level === 'BLOCK') {
      return Object.freeze({ level: 'BLOCK', reasons: Object.freeze(reasons) });
    }
    if (decision.level === 'CONFIRM') level = 'CONFIRM';
  }

  return Object.freeze({ level, reasons: Object.freeze(reasons) });
}
