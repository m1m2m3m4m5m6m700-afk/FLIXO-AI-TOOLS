import assert from 'node:assert/strict';
import {
  assertExecutionAllowed,
  canTransition,
  cancelTask,
  confirmTask,
  createTaskContext,
  interpretConfirmation,
  transitionTask,
} from '../src/lib/agent/task-state.ts';

let task = createTaskContext('task-test', 'trace-test');
assert.equal(task.state, 'IDLE');
assert.equal(task.confirmationRequired, false);

assert.equal(canTransition('IDLE', 'PLANNED'), true);
assert.equal(canTransition('EXECUTING', 'COMPLETED'), false);

assert.throws(() => assertExecutionAllowed(task), /blocked until explicit confirmation/);

task = transitionTask(task, 'PLANNED');
task = transitionTask(task, 'AWAITING_CONFIRMATION');
assert.equal(task.confirmationRequired, true);
assert.equal(interpretConfirmation('ابدأ'), 'CONFIRM');
assert.equal(interpretConfirmation('confirm'), 'CONFIRM');
assert.equal(interpretConfirmation('إلغاء'), 'CANCEL');
assert.equal(interpretConfirmation('maybe do it'), 'AMBIGUOUS');

assert.throws(() => assertExecutionAllowed(task), /blocked until explicit confirmation/);
task = confirmTask(task);
assert.equal(task.state, 'EXECUTING');
assert.equal(task.confirmationRequired, false);
assert.doesNotThrow(() => assertExecutionAllowed(task));

assert.throws(() => confirmTask(task), /Invalid task state transition/);

let cancelled = transitionTask(createTaskContext('cancel-test', 'trace-cancel'), 'PLANNED');
cancelled = transitionTask(cancelled, 'AWAITING_CONFIRMATION');
cancelled = cancelTask(cancelled);
assert.equal(cancelled.state, 'CANCELLED');
assert.equal(cancelTask(cancelled).state, 'CANCELLED');
assert.throws(() => transitionTask(cancelled, 'EXECUTING'), /Invalid task state transition/);

let failed = transitionTask(createTaskContext('fail-test', 'trace-fail'), 'PLANNED');
failed = transitionTask(failed, 'AWAITING_CONFIRMATION');
failed = confirmTask(failed);
failed = transitionTask(failed, 'VERIFYING');
failed = transitionTask(failed, 'FAILED');
assert.throws(() => transitionTask(failed, 'EXECUTING'), /Invalid task state transition/);

console.log('P0 agent state/confirmation contract tests passed.');
