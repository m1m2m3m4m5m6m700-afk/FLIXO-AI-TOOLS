#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildMentorPacket, validateCodeMentorProfile } from './action-code-mentor.mjs';

const profile = {
  schemaVersion: 1,
  id: 'ACTION-CODE-MENTOR',
  parentBotId: 'ACTION-REPAIR',
  authority: {
    permanentIndependentAuthority: false,
    readOnly: true,
    canMutateSource: false,
    canMutateTests: false,
    canMutateMain: false,
    canApproveGreen: false
  },
  binding: { exactShaRequired: true, requiredBeforeMutation: true },
  teachingModel: {
    promotionOnlyAfterCanonicalGreen: true,
    learners: ['ACTION-REPAIR', 'ACTION-REPAIR-2', 'ACTION-HISTORIAN-3']
  }
};
assert.deepEqual(validateCodeMentorProfile(profile), []);

const tampered = structuredClone(profile);
tampered.authority.canMutateSource = true;
assert.ok(validateCodeMentorProfile(tampered).includes('MENTOR_SOURCE_MUTATION_ENABLED'));

const packet = buildMentorPacket({
  taskId: 'TASK-CODE-MENTOR-TEST',
  fingerprint: 'fingerprint-test',
  targetSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  failedRunId: 'run-mentor-test',
  sourceFiles: ['scripts/ci/action-code-mentor.mjs']
});
assert.equal(packet.parentBotId, 'ACTION-REPAIR');
assert.equal(packet.readOnly, true);
assert.deepEqual(packet.learners, ['ACTION-REPAIR', 'ACTION-REPAIR-2', 'ACTION-HISTORIAN-3']);
assert.ok(packet.historicalLessons.length >= 1);
assert.ok(packet.codeLessons.some((lesson) => lesson.category === 'NODE_RUNTIME'));

console.log(JSON.stringify({
  status: 'PASS',
  protocol: 'CODE_MENTOR_PACKET_V1',
  assertions: 9
}, null, 2));
