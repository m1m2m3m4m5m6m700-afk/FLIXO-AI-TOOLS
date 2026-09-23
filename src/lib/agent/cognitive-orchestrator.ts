import { buildIntentPlan, toExecutionPlan, type IntentPlan } from '@/lib/agent/intent/intent-plan';
import type { ExecutionPlan } from '@/lib/ai/planner';
import { getCapability } from '@/lib/agent/capability-registry';
import { getToolDefinition } from '@/config/canonical-tool-definition';
import { deriveRecoveryMetadata, type RecoveryMetadata } from '@/lib/agent/execution-observability';

export type CognitiveDecision = 'EXECUTE_READY' | 'NEEDS_INPUT' | 'UNSUPPORTED' | 'UNSAFE';

export type SemanticPlanCheck = Readonly<{
  ok: boolean;
  reasons: readonly string[];
  coveredIntent: boolean;
  coveredVerificationCriteria: boolean;
  localFirstSatisfied: boolean;
}>;

export type CognitiveAssessment = Readonly<{
  decision: CognitiveDecision;
  intentPlan: IntentPlan;
  executionPlan: ExecutionPlan | null;
  semantic: SemanticPlanCheck;
  clarificationQuestion: IntentPlan['clarificationQuestion'];
}>;

export type RecoveryDecision =
  | Readonly<{ action: 'RETRY_CANONICAL'; recovery: RecoveryMetadata; reason: string }>
  | Readonly<{ action: 'REPLAN'; recovery: RecoveryMetadata; reason: string }>
  | Readonly<{ action: 'FAIL_CLOSED'; recovery: RecoveryMetadata; reason: string }>;

const CLOUD_HINT = /(?:cloud|remote|external|api|provider|ai|generate|إنشاء|توليد|سحابي|مزود|خارجي)/iu;

function hasCriterionForIntent(plan: IntentPlan, executionPlan: ExecutionPlan): boolean {
  const worldModel = plan.worldModel;
  if (!worldModel) return true;

  const ids = new Set(executionPlan.steps.map((step) => step.toolId));
  const changeMap = worldModel.changeMap;

  if (changeMap.remove.includes('background') && !ids.has('background-remover')) return false;
  if (changeMap.transform.includes('crop') && !ids.has('image-cropper')) return false;
  if (changeMap.output.includes('requested output format or dimensions') && !ids.has('image-converter') && !ids.has('image-cropper') && !ids.has('image-upscaler') && !ids.has('image-compressor')) {
    return false;
  }

  return worldModel.verificationCriteria.includes('output artifact exists');
}

function hasContradictoryPreservation(plan: IntentPlan, executionPlan: ExecutionPlan): boolean {
  const worldModel = plan.worldModel;
  if (!worldModel) return false;
  const ids = new Set(executionPlan.steps.map((step) => step.toolId));
  const preserved = worldModel.negativeRequirements.join(' ').toLocaleLowerCase();

  if (ids.has('background-remover') && /(?:keep|preserve|do not remove|لا\s*(?:تزيل|تحذف)|بدون\s*إزالة).*background|background.*(?:keep|preserve)/iu.test(preserved)) return true;
  if (ids.has('image-cropper') && /(?:don't crop|do not crop|لا\s*(?:تقص|تقطع))/iu.test(preserved)) return true;
  if (ids.has('image-compressor') && /(?:don't compress|do not compress|لا\s*(?:تضغط|تصغر))/iu.test(preserved)) return true;
  return false;
}

export function verifyExecutionPlanSemantics(intentPlan: IntentPlan, executionPlan: ExecutionPlan): SemanticPlanCheck {
  const reasons: string[] = [];
  const ids = new Set(executionPlan.steps.map((step) => step.toolId));

  if (executionPlan.catalogFingerprint.length !== 64) reasons.push('CATALOG_FINGERPRINT_INVALID');
  if (executionPlan.steps.length < 1 || executionPlan.steps.length > 4) reasons.push('PLAN_STEP_COUNT_INVALID');

  const coveredIntent = !intentPlan.intent.id || ids.has(intentPlan.intent.id);
  if (!coveredIntent) reasons.push('INTENT_CAPABILITY_MISMATCH');

  const coveredVerificationCriteria = hasCriterionForIntent(intentPlan, executionPlan);
  if (!coveredVerificationCriteria) reasons.push('VERIFICATION_CRITERIA_NOT_COVERED');

  if (hasContradictoryPreservation(intentPlan, executionPlan)) reasons.push('NEGATIVE_REQUIREMENT_CONFLICT');

  const usesCloud = executionPlan.steps.some((step) => getCapability(step.toolId)?.executionMode === 'CLOUD');
  const localFirstSatisfied = !usesCloud || CLOUD_HINT.test(intentPlan.input) || intentPlan.intent.id === 'ai-image-generator';
  if (!localFirstSatisfied) reasons.push('LOCAL_FIRST_VIOLATION');

  for (const step of executionPlan.steps) {
    const capability = getCapability(step.toolId);
    const tool = getToolDefinition(step.toolId);
    if (!capability || capability.state !== 'EXECUTABLE') reasons.push('CAPABILITY_NOT_EXECUTABLE:' + step.toolId);
    if (!tool?.verifier) reasons.push('VERIFIER_MISSING:' + step.toolId);
  }

  return Object.freeze({
    ok: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
    coveredIntent,
    coveredVerificationCriteria,
    localFirstSatisfied,
  });
}

export function assessCognitiveRequest(
  input: string,
  identity?: { taskId?: string | null; traceId?: string | null },
): CognitiveAssessment {
  const intentPlan = buildIntentPlan(input, identity);

  if (intentPlan.status !== 'READY') {
    const decision: CognitiveDecision =
      intentPlan.status === 'NEEDS_INPUT' ? 'NEEDS_INPUT' :
      intentPlan.status === 'UNSUPPORTED' ? 'UNSUPPORTED' :
      'UNSAFE';
    return Object.freeze({
      decision,
      intentPlan,
      executionPlan: null,
      semantic: Object.freeze({
        ok: false,
        reasons: Object.freeze([intentPlan.status]),
        coveredIntent: false,
        coveredVerificationCriteria: false,
        localFirstSatisfied: true,
      }),
      clarificationQuestion: intentPlan.clarificationQuestion ?? null,
    });
  }

  const executionPlan = toExecutionPlan(intentPlan);
  if (!executionPlan) {
    return Object.freeze({
      decision: 'UNSAFE',
      intentPlan,
      executionPlan: null,
      semantic: Object.freeze({
        ok: false,
        reasons: Object.freeze(['EXECUTION_PLAN_CONVERSION_FAILED']),
        coveredIntent: false,
        coveredVerificationCriteria: false,
        localFirstSatisfied: true,
      }),
      clarificationQuestion: intentPlan.clarificationQuestion ?? null,
    });
  }

  const semantic = verifyExecutionPlanSemantics(intentPlan, executionPlan);
  return Object.freeze({
    decision: semantic.ok ? 'EXECUTE_READY' : 'UNSAFE',
    intentPlan,
    executionPlan: semantic.ok ? executionPlan : null,
    semantic,
    clarificationQuestion: intentPlan.clarificationQuestion ?? null,
  });
}

export function decideRecovery(
  capabilityId: string,
  errorClass: string,
  attemptsUsed: number,
): RecoveryDecision {
  const tool = getToolDefinition(capabilityId);
  if (!tool) {
    return Object.freeze({
      action: 'FAIL_CLOSED',
      recovery: Object.freeze({ maxAttempts: 0, replanOnFailure: false, retryAllowed: false, recoveryMode: 'FAIL_CLOSED' }),
      reason: 'UNKNOWN_CAPABILITY',
    });
  }

  const recovery = deriveRecoveryMetadata(tool);
  if (errorClass === 'SECURITY' || errorClass === 'USER_INPUT') {
    return Object.freeze({ action: 'FAIL_CLOSED', recovery, reason: 'FAIL_CLOSED_FOR_SECURITY_OR_USER_INPUT' });
  }

  if (attemptsUsed < recovery.maxAttempts && recovery.retryAllowed) {
    return Object.freeze({ action: 'RETRY_CANONICAL', recovery, reason: 'CANONICAL_RECOVERY_RETRY_AVAILABLE' });
  }

  if (recovery.replanOnFailure && attemptsUsed === 0) {
    return Object.freeze({ action: 'REPLAN', recovery, reason: 'CANONICAL_POLICY_ALLOWS_ONE_REPLAN' });
  }

  return Object.freeze({ action: 'FAIL_CLOSED', recovery, reason: 'RECOVERY_BUDGET_EXHAUSTED_OR_REPLAN_DISABLED' });
}

export function proposeBoundedReplan(
  originalInput: string,
  failedPlan: ExecutionPlan,
): ExecutionPlan | null {
  const candidate = assessCognitiveRequest(originalInput);
  if (candidate.decision !== 'EXECUTE_READY' || !candidate.executionPlan) return null;

  const same = JSON.stringify(candidate.executionPlan.steps) === JSON.stringify(failedPlan.steps)
    && candidate.executionPlan.catalogFingerprint === failedPlan.catalogFingerprint;
  return same ? null : candidate.executionPlan;
}
