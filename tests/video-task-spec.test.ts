import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileVideoTaskSpec, parseVideoTaskSpec } from '../src/lib/video/video-task-spec.ts';

test('video planner binds supported local operations to executable capabilities', () => {
  const spec = compileVideoTaskSpec('trim the first 5 seconds and resize to 720p');
  assert.ok(spec);
  assert.deepEqual(
    spec?.operations.map((operation) => operation.capabilityId),
    [undefined, 'video-trimmer', 'video-resizer'],
  );
  assert.equal(spec?.execution.previewFirst, true);
  assert.equal(spec?.execution.longRunningJob, true);
});

test('video planner marks AI-oriented operations as cloud candidates without executable binding', () => {
  const spec = compileVideoTaskSpec('remove the object and replace background');
  assert.ok(spec);
  assert.deepEqual(spec?.operations.map((operation) => operation.capabilityId), [undefined, undefined, undefined]);
  assert.equal(spec?.execution.requiresCloudModel, true);
});

test('video planner rejects unregistered operation kinds', () => {
  assert.throws(() => parseVideoTaskSpec({
    version: 1,
    source: 'DETERMINISTIC',
    goal: 'bad',
    operations: [{ id: 'x', kind: 'NOT_A_REAL_OPERATION', purpose: 'bad', order: 1 }],
    constraints: [],
    execution: { previewFirst: true, longRunningJob: true, requiresCloudModel: false },
  }), /Invalid enum value/);
});
