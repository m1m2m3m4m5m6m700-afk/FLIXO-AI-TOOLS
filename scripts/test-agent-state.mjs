import assert from 'node:assert/strict';
import {
  TASK_STATES,
  assertExecutionAllowed,
  canTransition,
  cancelTask,
  confirmTask,
  createTaskContext,
  interpretConfirmation,
  isTerminalTaskState,
  transitionTask,
} from '../src/lib/agent/task-state.ts';

let task = createTaskContext('task-test', 'trace-test');
assert.equal(task.state, 'IDLE');
assert.equal(task.confirmationRequired, false);
assert.equal(task.revision, 0);
assert.equal(task.taskId, 'task-test');
assert.equal(task.traceId, 'trace-test');

assert.equal(canTransition('IDLE', 'PLANNED'), true);
assert.equal(canTransition('EXECUTING', 'COMPLETED'), false);

assert.throws(() => assertExecutionAllowed(task), /blocked until explicit confirmation/);

task = transitionTask(task, 'PLANNED');
task = transitionTask(task, 'AWAITING_CONFIRMATION');
assert.equal(task.confirmationRequired, true);
assert.equal(task.revision, 2);
assert.equal(interpretConfirmation('ابدأ'), 'CONFIRM');
assert.equal(interpretConfirmation('confirm'), 'CONFIRM');
assert.equal(interpretConfirmation('إلغاء'), 'CANCEL');
assert.equal(interpretConfirmation('maybe do it'), 'AMBIGUOUS');
assert.equal(interpretConfirmation(''), 'AMBIGUOUS');

assert.throws(() => assertExecutionAllowed(task), /blocked until explicit confirmation/);
task = confirmTask(task);
assert.equal(task.state, 'EXECUTING');
assert.equal(task.confirmationRequired, false);
assert.equal(task.revision, 3);
assert.doesNotThrow(() => assertExecutionAllowed(task));

assert.throws(() => confirmTask(task), /Invalid task state transition/);

let cancelled = transitionTask(createTaskContext('cancel-test', 'trace-cancel'), 'PLANNED');
cancelled = transitionTask(cancelled, 'AWAITING_CONFIRMATION');
cancelled = cancelTask(cancelled);
assert.equal(cancelled.state, 'CANCELLED');
assert.equal(cancelled.confirmationRequired, false);
assert.equal(cancelled.revision, 3);
assert.equal(cancelTask(cancelled).state, 'CANCELLED');
assert.throws(() => transitionTask(cancelled, 'EXECUTING'), /Invalid task state transition/);

let failed = transitionTask(createTaskContext('fail-test', 'trace-fail'), 'PLANNED');
failed = transitionTask(failed, 'AWAITING_CONFIRMATION');
failed = confirmTask(failed);
failed = transitionTask(failed, 'VERIFYING');
failed = transitionTask(failed, 'FAILED');
assert.equal(failed.confirmationRequired, false);
assert.equal(failed.revision, 5);
assert.throws(() => transitionTask(failed, 'EXECUTING'), /Invalid task state transition/);

for (const terminal of ['COMPLETED', 'FAILED', 'CANCELLED']) {
  assert.equal(isTerminalTaskState(terminal), true, `${terminal} must be terminal`);
  for (const next of TASK_STATES) {
    assert.equal(canTransition(terminal, next), false, `${terminal} must not transition to ${next}`);
  }
}

for (const state of TASK_STATES) {
  assert.equal(isTerminalTaskState(state), ['COMPLETED', 'FAILED', 'CANCELLED'].includes(state));
}

console.log('P0 agent state/confirmation contract tests passed.');
