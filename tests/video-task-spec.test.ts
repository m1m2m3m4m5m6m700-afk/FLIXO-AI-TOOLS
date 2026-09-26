import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileVideoTaskSpec, parseVideoTaskSpec } from '../src/lib/video/video-task-spec.ts';

test('video planner builds a deterministic multi-stage plan', () => {
  const spec = compileVideoTaskSpec('trim the first 5 seconds, add subtitles, blur the background and remove the object');
  assert.ok(spec);
  assert.equal(spec?.source, 'DETERMINISTIC');
  assert.equal(spec?.execution.previewFirst, true);
  assert.equal(spec?.execution.longRunningJob, true);
  assert.equal(spec?.execution.requiresCloudModel, true);
  assert.deepEqual(
    spec?.operations.map((operation) => operation.kind),
    ['PROBE', 'TRIM', 'SUBTITLES', 'BACKGROUND_BLUR', 'OBJECT_REMOVE'],
  );
});

test('video planner contract rejects unregistered operation kinds', () => {
  assert.throws(() => parseVideoTaskSpec({
    version: 1,
    source: 'DETERMINISTIC',
    goal: 'bad',
    operations: [{ id: 'x', kind: 'NOT_A_REAL_OPERATION', purpose: 'bad', order: 1 }],
    constraints: [],
    execution: { previewFirst: true, longRunningJob: true, requiresCloudModel: false },
  }), /Invalid enum value/);
});
