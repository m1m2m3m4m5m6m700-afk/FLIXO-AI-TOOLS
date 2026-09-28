import { getCapability, validateCapabilityParameters } from './capability-registry.ts';
import type { ExecutionPlanContract } from '../contracts/ai-plan.ts';

export type ToolPlanValidation = Readonly<{
  valid: boolean;
  structural: boolean;
  values: boolean;
  semantic: boolean;
  errors: readonly string[];
}>;

function tokens(input: string): readonly string[] {
  return input.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
}

function semanticMatch(input: string, toolId: string): boolean {
  const capability = getCapability(toolId);
  if (!capability) return false;
  const normalized = input.toLocaleLowerCase();
  return capability.intents.some((intent) => {
    const candidate = intent.toLocaleLowerCase();
    return normalized.includes(candidate) || tokens(candidate).filter((token) => token.length >= 3).some((token) => normalized.includes(token));
  });
}

export function validateToolPlan(input: string, plan: ExecutionPlanContract | null): ToolPlanValidation {
  if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    return Object.freeze({ valid: false, structural: false, values: false, semantic: false, errors: ['PLAN_STRUCTURAL_INVALID'] });
  }

  const errors: string[] = [];
  let values = true;
  let semantic = true;

  for (const step of plan.steps) {
    const capability = getCapability(step.toolId);
    if (!capability || capability.state !== 'EXECUTABLE') {
      errors.push('NON_EXECUTABLE_CAPABILITY:' + step.toolId);
      values = false;
      semantic = false;
      continue;
    }
    try {
      validateCapabilityParameters(step.toolId, step.params ?? {});
    } catch {
      errors.push('INVALID_PARAMETERS:' + step.toolId);
      values = false;
    }
    if (!semanticMatch(input, step.toolId)) {
      errors.push('SEMANTIC_INTENT_MISMATCH:' + step.toolId);
      semantic = false;
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    structural: true,
    values,
    semantic,
    errors: Object.freeze(errors),
  });
}

export function assertToolPlanValid(input: string, plan: ExecutionPlanContract | null): ExecutionPlanContract {
  const result = validateToolPlan(input, plan);
  if (!result.valid) throw new Error('TOOL_PLAN_REJECTED:' + result.errors.join(','));
  return plan as ExecutionPlanContract;
}
