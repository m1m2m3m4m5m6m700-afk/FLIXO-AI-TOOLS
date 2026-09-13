import assert from 'node:assert/strict';
import {
  evaluateAdminExecution,
  isWriteExecutionClass,
} from '../api/admin/execution-policy.ts';
import { createAdminExecutionPlan } from '../api/admin/execution-plan.ts';

const base = {
  subject: 'operator-1',
  capability: 'production.write',
  executionClass: 'LOW_RISK_WRITE',
  command: 'rotate-test-secret',
  target: 'sandbox/resource-1',
  preview: true,
};

assert.equal(isWriteExecutionClass('LOW_RISK_WRITE'), true);
assert.equal(isWriteExecutionClass('READ'), false);

assert.deepEqual(evaluateAdminExecution(base), {
  decision: 'ALLOW_PREVIEW',
  reason: 'preview_only',
  executionClass: 'LOW_RISK_WRITE',
});

assert.equal(
  evaluateAdminExecution({ ...base, preview: false }).decision,
  'DENY',
);
assert.equal(
  evaluateAdminExecution({ ...base, preview: false }).reason,
  'rollback_required',
);

assert.equal(
  evaluateAdminExecution({
    ...base,
    preview: false,
    rollbackPlan: 'restore previous secret version',
  }).reason,
  'execution_disabled',
);

assert.equal(
  evaluateAdminExecution({
    ...base,
    executionClass: 'PRODUCTION_CHANGE',
    preview: false,
    rollbackPlan: 'restore previous deployment',
  }).reason,
  'approval_required',
);

assert.equal(
  evaluateAdminExecution({
    ...base,
    subject: '',
  }).reason,
  'missing_subject',
);

const previewPlan = createAdminExecutionPlan(base);
assert.equal(previewPlan.execution.mode, 'PREVIEW_ONLY');
assert.equal(previewPlan.execution.enabled, false);
assert.equal(previewPlan.policy.decision, 'ALLOW_PREVIEW');
assert.equal(previewPlan.rollback.required, true);
assert.equal(previewPlan.rollback.supplied, false);
assert.equal(previewPlan.approval.required, false);
assert.equal(previewPlan.audit.required, true);
assert.equal(previewPlan.audit.eventType, 'ADMIN_EXECUTION_PREVIEW');
assert.equal(previewPlan.audit.target, base.target);

const highRiskPreview = createAdminExecutionPlan({
  ...base,
  executionClass: 'PRODUCTION_CHANGE',
  rollbackPlan: 'restore previous deployment',
  approvalId: 'approval-1',
});
assert.equal(highRiskPreview.approval.required, true);
assert.equal(highRiskPreview.approval.supplied, true);
assert.equal(highRiskPreview.execution.enabled, false);

console.log('Admin execution policy and deterministic preview plan contracts: PASS');
