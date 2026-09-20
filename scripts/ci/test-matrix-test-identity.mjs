import assert from 'node:assert/strict';
import { collectNativeTests, collectTestIds, testId } from './matrix-test-identity.mjs';

const duplicateTitlesSameFile = {
  suites: [{
    title: '',
    specs: [],
    suites: [
      { title: 'Account', specs: [{ file: 'tests/example.spec.ts', title: 'loads', tests: [{ status: 'expected' }] }], suites: [] },
      { title: 'Dashboard', specs: [{ file: 'tests/example.spec.ts', title: 'loads', tests: [{ status: 'expected' }] }], suites: [] },
    ],
  }],
};

const tests = collectNativeTests(duplicateTitlesSameFile);
assert.equal(tests.length, 2);
assert.equal(new Set(collectTestIds(duplicateTitlesSameFile)).size, 2, 'suite path must prevent same-file title collisions');
assert.equal(collectTestIds(duplicateTitlesSameFile)[0], 'tests/example.spec.ts::Account > loads::0');
assert.equal(collectTestIds(duplicateTitlesSameFile)[1], 'tests/example.spec.ts::Dashboard > loads::0');
assert.throws(() => testId({ file: 'tests/x.spec.ts', title: '', ordinal: 0 }), /requires a title/);
assert.throws(() => testId({ file: 'tests/x.spec.ts', title: 'x', ordinal: -1 }), /non-negative ordinal/);
console.log('Matrix test identity regression PASS');
