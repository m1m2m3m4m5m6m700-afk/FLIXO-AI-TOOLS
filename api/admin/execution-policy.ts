export type AdminExecutionClass =
  | 'READ'
  | 'LOW_RISK_WRITE'
  | 'HIGH_RISK_WRITE'
  | 'DESTRUCTIVE'
  | 'PRODUCTION_CHANGE';

export type AdminExecutionRequest = {
  subject: string;
  capability: string;
  executionClass: AdminExecutionClass;
  command: string;
  target: string;
  preview: boolean;
  rollbackPlan?: string;
  approvalId?: string;
};

export type AdminExecutionDecision =
  | {
      decision: 'ALLOW_PREVIEW';
      reason: 'preview_only';
      executionClass: AdminExecutionClass;
    }
  | {
      decision: 'ALLOW_READ';
      reason: 'authenticated_read';
      executionClass: 'READ';
    }
  | {
      decision: 'DENY';
      reason:
        | 'missing_subject'
        | 'missing_capability'
        | 'missing_command'
        | 'missing_target'
        | 'rollback_required'
        | 'approval_required'
        | 'execution_disabled';
      executionClass: AdminExecutionClass;
    };

const WRITE_CLASSES: readonly AdminExecutionClass[] = [
  'LOW_RISK_WRITE',
  'HIGH_RISK_WRITE',
  'DESTRUCTIVE',
  'PRODUCTION_CHANGE',
] as const;

export const isWriteExecutionClass = (executionClass: AdminExecutionClass) =>
  WRITE_CLASSES.includes(executionClass);

export const evaluateAdminExecution = (
  request: AdminExecutionRequest,
): AdminExecutionDecision => {
  if (!request.subject.trim()) {
    return { decision: 'DENY', reason: 'missing_subject', executionClass: request.executionClass };
  }
  if (!request.capability.trim()) {
    return { decision: 'DENY', reason: 'missing_capability', executionClass: request.executionClass };
  }
  if (!request.command.trim()) {
    return { decision: 'DENY', reason: 'missing_command', executionClass: request.executionClass };
  }
  if (!request.target.trim()) {
    return { decision: 'DENY', reason: 'missing_target', executionClass: request.executionClass };
  }

  if (request.executionClass === 'READ') {
    return request.preview
      ? { decision: 'ALLOW_PREVIEW', reason: 'preview_only', executionClass: 'READ' }
      : { decision: 'ALLOW_READ', reason: 'authenticated_read', executionClass: 'READ' };
  }

  if (!request.preview && !request.rollbackPlan?.trim()) {
    return { decision: 'DENY', reason: 'rollback_required', executionClass: request.executionClass };
  }

  if (
    !request.preview &&
    (request.executionClass === 'HIGH_RISK_WRITE' ||
      request.executionClass === 'DESTRUCTIVE' ||
      request.executionClass === 'PRODUCTION_CHANGE') &&
    !request.approvalId?.trim()
  ) {
    return { decision: 'DENY', reason: 'approval_required', executionClass: request.executionClass };
  }

  if (!request.preview) {
    return { decision: 'DENY', reason: 'execution_disabled', executionClass: request.executionClass };
  }

  return { decision: 'ALLOW_PREVIEW', reason: 'preview_only', executionClass: request.executionClass };
};
