import assert from 'node:assert/strict';
import {
  evaluateAdminExecution,
  isWriteExecutionClass,
} from '../api/admin/execution-policy.ts';

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

console.log('Admin execution policy contract: PASS');
