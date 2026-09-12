#!/usr/bin/env node
import assert from 'node:assert/strict';
import { assertExpectedExecutionSha, readExecutionSha } from './execution-sha-provenance.mjs';

const actual = readExecutionSha();
assert.match(actual, /^[0-9a-f]{40}$/iu);
assert.equal(assertExpectedExecutionSha({ actualSha: actual, expectedSha: actual }), actual);

assert.throws(
  () => assertExpectedExecutionSha({ actualSha: actual, expectedSha: null }),
  /EXPECTED_SHA is missing or malformed/u,
);
assert.throws(
  () => assertExpectedExecutionSha({ actualSha: actual, expectedSha: '0000000000000000000000000000000000000000' }),
  /Execution SHA mismatch/u,
);
assert.throws(
  () => assertExpectedExecutionSha({ actualSha: null, expectedSha: actual }),
  /Actual execution SHA is missing or malformed/u,
);

console.log(JSON.stringify({
  status: 'PASS',
  actualSha: actual,
  checks: {
    exactHeadResolved: true,
    matchingShaAccepted: true,
    missingExpectedShaRejected: true,
    mismatchedShaRejected: true,
    missingActualShaRejected: true,
  },
}, null, 2));
