#!/usr/bin/env node
import assert from 'node:assert/strict';
import { selectFileScope } from './action-file-selection-intelligence.mjs';

const base = {
  taskId: 'ACTION-RED:test:fp',
  failureFingerprint: 'fp',
  targetSha: '0123456789abcdef0123456789abcdef01234567',
  failedRunId: '123'
};

const direct = selectFileScope({
  ...base,
  trackedFiles: [
    '.github/workflows/auto-repair.yml',
    'scripts/ci/action-file-selection-intelligence.mjs',
    'scripts/ci/action-three-bot-collaboration.mjs',
    'scripts/ci/action-repair-dual-control.mjs',
    'tests/repair.test.mjs'
  ],
  changedFiles: ['scripts/ci/action-three-bot-collaboration.mjs'],
  failureLog: 'failure in scripts/ci/action-three-bot-collaboration.mjs:120:4'
});
assert.equal(direct.decision, 'SELECTED');
assert.equal(direct.pathOnlyAnalysis, true);
assert.equal(direct.codeContentRead, false);
assert.equal(direct.primaryFile, 'scripts/ci/action-three-bot-collaboration.mjs');
assert.match(direct.selectedFiles[0].reasons.join(','), /DIRECT_FAILURE_PATH/);

const changedOnly = selectFileScope({
  ...base,
  trackedFiles: ['src/a.ts', 'src/b.ts', 'scripts/ci/a.mjs'],
  changedFiles: ['src/a.ts'],
  failureLog: 'TypeScript failure with no explicit file path'
});
assert.equal(changedOnly.selectionMode, 'CURRENT_SHA_CHANGE_SURFACE');
assert.equal(changedOnly.primaryFile, 'src/a.ts');

assert.throws(
  () => selectFileScope({
    ...base,
    targetSha: 'bad-sha',
    trackedFiles: ['src/a.ts'],
    changedFiles: ['src/a.ts'],
    failureLog: 'failure'
  }),
  /ACTION_FILE_SELECTION_IDENTITY_REQUIRED/
);

console.log(JSON.stringify({
  status: 'PASS',
  protocol: 'ACTION-FILE-SELECTION-INTELLIGENCE-v1',
  agentId: 'ACTION-HISTORIAN-3'
}, null, 2));
