import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import {
  MISSION_CONTINUITY_PROTOCOL,
  createMission,
  loadMission,
  heartbeat,
  checkpoint,
  recover,
  continuityDecision,
  complete,
  validateMission,
} from './mission-continuity-engine.mjs';

const root = await mkdtemp('/tmp/flixo-mission-continuity-');
const shaA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const shaB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const missionId = 'MISSION-CONTINUITY-TEST';

try {
  assert.equal(MISSION_CONTINUITY_PROTOCOL.branch, 'execution');
  assert.equal(MISSION_CONTINUITY_PROTOCOL.terminalState, 'CLOSED');
  assert.ok(MISSION_CONTINUITY_PROTOCOL.forbiddenStates.includes('SLEEP'));

  const created = createMission({ missionId, taskId: 'TASK-1', entrySha: shaA, root });
  assert.equal(created.created, true);
  assert.equal(created.state.open, true);
  assert.equal(created.state.terminal, false);

  heartbeat({ missionId, exactSha: shaA, progress: true, root, at: '2026-09-22T00:00:00.000Z' });
  assert.equal(
    continuityDecision({ missionId, exactSha: shaA, root, now: Date.parse('2026-09-22T00:00:30.000Z') }).action,
    'CONTINUE',
  );

  checkpoint({ missionId, exactSha: shaA, step: 'ROOT_CAUSE_PROVEN', root });
  assert.equal(loadMission({ missionId, root }).checkpoint.step, 'ROOT_CAUSE_PROVEN');

  assert.deepEqual(
    continuityDecision({ missionId, exactSha: shaB, root }).action,
    'RECOVER',
  );

  recover({ missionId, exactSha: shaA, reason: 'WORKFLOW_FAILED', workflowConclusion: 'failure', root });
  const recovered = loadMission({ missionId, root });
  assert.equal(recovered.state, 'RECOVERING');
  assert.equal(recovered.open, true);
  assert.equal(recovered.attempt, 2);

  heartbeat({ missionId, exactSha: shaA, progress: true, state: 'ACTIVE', root });
  assert.throws(
    () => complete({ missionId, exactSha: shaB, requiredRedCount: 0, regressionPassed: true, learningRecorded: true, root }),
    /SHA_MISMATCH/u,
  );
  assert.throws(
    () => complete({ missionId, exactSha: shaA, requiredRedCount: 1, regressionPassed: true, learningRecorded: true, root }),
    /COMPLETION_RED/u,
  );

  complete({ missionId, exactSha: shaA, requiredRedCount: 0, regressionPassed: true, learningRecorded: true, root });
  const closed = loadMission({ missionId, root });
  assert.equal(closed.state, 'CLOSED');
  assert.equal(closed.open, false);
  assert.equal(closed.terminal, true);
  assert.equal(validateMission({ missionId, root }), true);
  assert.equal(continuityDecision({ missionId, exactSha: shaA, root }).action, 'RESIDENT');
  assert.throws(() => heartbeat({ missionId, exactSha: shaA, root }), /CLOSED_REOPEN|TRANSITION/u);

  console.log('Mission continuity engine PASS');
} finally {
  await rm(root, { recursive: true, force: true });
}
