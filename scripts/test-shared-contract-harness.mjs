import assert from 'node:assert/strict';
import { assertHarnessPass, runToolContractHarness } from './helpers/tool-contract-harness.ts';

const results = await runToolContractHarness({
  input: 'fixture',
  execute: async (input) => ({ value: input, aria: 'ready' }),
  verifyOutput: (output) => assert.equal(output.value, 'fixture'),
  verifyA11y: (output) => assert.equal(output.aria, 'ready'),
  expectError: async () => { throw new Error('expected-error-path'); },
});

assert(results.some((item) => item.stage === 'INPUT' && item.ok));
assert(results.some((item) => item.stage === 'EXECUTE' && item.ok));
assert(results.some((item) => item.stage === 'OUTPUT' && item.ok));
assert(results.some((item) => item.stage === 'A11Y' && item.ok));
assert(results.some((item) => item.stage === 'ERROR' && item.ok === false));

await assert.rejects(async () => {
  assertHarnessPass([{ stage: 'OUTPUT', ok: false, error: 'contract' }]);
}, /CONTRACT_HARNESS_FAILED=OUTPUT/);
console.log('SHARED_CONTRACT_HARNESS_SELF_TEST=PASS');
