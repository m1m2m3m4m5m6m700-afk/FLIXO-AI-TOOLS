import {
  evaluateAdminExecution,
  isWriteExecutionClass,
  type AdminExecutionRequest,
} from './execution-policy.ts';

export type AdminExecutionPlan = {
  execution: {
    mode: 'PREVIEW_ONLY';
    enabled: false;
    command: string;
    target: string;
    executionClass: AdminExecutionRequest['executionClass'];
  };
  policy: ReturnType<typeof evaluateAdminExecution>;
  rollback: {
    required: boolean;
    supplied: boolean;
    proofRequired: boolean;
  };
  approval: {
    required: boolean;
    supplied: boolean;
  };
  verification: {
    required: true;
  };
  evidence: {
    required: true;
  };
  audit: {
    required: true;
    eventType: 'ADMIN_EXECUTION_PREVIEW';
    subject: string;
    capability: string;
    target: string;
  };
};

export const createAdminExecutionPlan = (
  request: AdminExecutionRequest,
): AdminExecutionPlan => {
  const policy = evaluateAdminExecution({ ...request, preview: true });
  const write = isWriteExecutionClass(request.executionClass);
  const approvalRequired =
    write &&
    (request.executionClass === 'HIGH_RISK_WRITE' ||
      request.executionClass === 'DESTRUCTIVE' ||
      request.executionClass === 'PRODUCTION_CHANGE');

  return {
    execution: {
      mode: 'PREVIEW_ONLY',
      enabled: false,
      command: request.command,
      target: request.target,
      executionClass: request.executionClass,
    },
    policy,
    rollback: {
      required: write,
      supplied: Boolean(request.rollbackPlan?.trim()),
      proofRequired: write,
    },
    approval: {
      required: approvalRequired,
      supplied: Boolean(request.approvalId?.trim()),
    },
    verification: {
      required: true,
    },
    evidence: {
      required: true,
    },
    audit: {
      required: true,
      eventType: 'ADMIN_EXECUTION_PREVIEW',
      subject: request.subject,
      capability: request.capability,
      target: request.target,
    },
  };
};
