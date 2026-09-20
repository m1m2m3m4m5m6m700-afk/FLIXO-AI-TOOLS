import assert from 'node:assert/strict';
import { getToolDefinition } from '../src/config/canonical-tool-definition.ts';
import { createTaskContext } from '../src/lib/agent/task-state.ts';
import {
  assertExecutionPermission,
  assertExecutionSecurityBoundary,
  classifyExecutionFailure,
  createExecutionAuditEvent,
  deriveRecoveryMetadata,
  deriveToolSecurityProfile,
  toStructuredExecutionLog,
} from '../src/lib/agent/execution-observability.ts';

const local = getToolDefinition('image-compressor');
const cloud = getToolDefinition('ai-image-generator');
assert.ok(local);
assert.ok(cloud);

assert.doesNotThrow(() => assertExecutionSecurityBoundary(local));
assert.doesNotThrow(() => assertExecutionPermission(local, 'EXECUTE'));
assert.equal(deriveToolSecurityProfile(local).privacyBoundary, 'LOCAL_ONLY');
assert.equal(deriveToolSecurityProfile(cloud).privacyBoundary, 'EXTERNAL_ENDPOINT');
assert.equal(deriveRecoveryMetadata(local).maxAttempts, 3);
assert.equal(deriveRecoveryMetadata(cloud).recoveryMode, 'FAIL_CLOSED');

assert.throws(() => assertExecutionPermission({ ...local, capability: { ...local.capability, state: 'PLANNABLE' } }, 'EXECUTE'), /permission denied/i);
assert.throws(() => assertExecutionSecurityBoundary({ ...cloud, requirements: { browser: true, network: false } }), /requires network permission/i);
assert.throws(() => assertExecutionSecurityBoundary({ ...local, executionMode: 'LOCAL', requirements: { browser: true, network: true } }), /cannot require network access/i);

const task = createTaskContext('task-wp2-001', 'trace-wp2-001');
const audit = await createExecutionAuditEvent({
  task,
  capabilityId: local.id,
  tool: local,
  stage: 'AUTHORIZATION',
  outcome: 'ALLOW',
  message: 'Authorization: super-secret https://example.test/x 192.168.1.10',
});
assert.equal(audit.traceId, 'trace-wp2-001');
assert.equal(audit.security.privacyBoundary, 'LOCAL_ONLY');
assert.equal(audit.recovery.maxAttempts, 3);
assert.match(audit.message ?? '', /Authorization \[REDACTED\]/);
assert.doesNotMatch(audit.message ?? '', /super-secret|https:\/\/|192\.168\.1\.10/);

const structured = toStructuredExecutionLog(audit);
assert.equal(structured.logType, 'flixo.execution.audit');
assert.equal(structured.level, 'INFO');
assert.equal(structured.event.eventId, audit.eventId);
assert.equal(classifyExecutionFailure(new Error('permission denied by security boundary')), 'SECURITY');

console.log('EXECUTION_OBSERVABILITY_CONTRACT=PASS');
