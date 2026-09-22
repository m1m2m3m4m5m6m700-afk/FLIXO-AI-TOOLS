import assert from 'node:assert/strict';
import { authorizeExecution } from '../src/lib/agent/execution-gate.ts';
import { createTaskContext, transitionTask } from '../src/lib/agent/task-state.ts';

const input = new Blob(['test-image'], { type: 'image/png' });

let task = createTaskContext('gate-task', 'gate-trace');
task = transitionTask(task, 'PLANNED');
task = transitionTask(task, 'AWAITING_CONFIRMATION');
task = transitionTask(task, 'EXECUTING');

const authorized = await authorizeExecution({
  task,
  capabilityId: 'image-compressor',
  parameters: { quality: 0.8 },
  inputBlob: input,
});

assert.equal(authorized.capabilityId, 'image-compressor');
assert.equal(authorized.executionMode, 'LOCAL');
assert.equal(authorized.traceId, 'gate-trace');
assert.equal(authorized.security.permission, 'EXECUTE');
assert.equal(authorized.security.browserLocal, true);
assert.equal(authorized.recovery.retryAllowed, true);
assert.equal(authorized.audit.stage, 'AUTHORIZATION');
assert.equal(authorized.audit.outcome, 'ALLOW');
assert.equal(authorized.audit.traceId, 'gate-trace');
assert.match(authorized.audit.eventId, /^[a-f0-9]{64}$/);
assert.equal(authorized.parameters.quality, 0.8);

const unconfirmed = createTaskContext('blocked-task', 'blocked-trace');
await assert.rejects(
  authorizeExecution({ task: unconfirmed, capabilityId: 'image-compressor', inputBlob: input }),
  /Execution is blocked until explicit confirmation/,
);

await assert.rejects(
  authorizeExecution({ task, capabilityId: 'photo-colorizer', inputBlob: input }),
  /not executable/,
);

await assert.rejects(
  authorizeExecution({ task, capabilityId: 'image-compressor', parameters: { quality: 9 }, inputBlob: input }),
  /Capability 'image-compressor' parameters failed the canonical schema validation\./,
);

const oversized = new Blob([new Uint8Array(64 * 1024 * 1024 + 1)]);
await assert.rejects(
  authorizeExecution({ task, capabilityId: 'image-compressor', inputBlob: oversized }),
  /file-size limit/,
);

console.log('Agent execution gate tests passed.');
