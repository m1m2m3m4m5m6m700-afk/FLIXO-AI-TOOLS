import assert from 'node:assert/strict';
import { COUNCIL_DIRECTIVE, COUNCIL_DIRECTIVE_VERSION, assertCouncilDirective } from './council-directive.mjs';

assert.equal(COUNCIL_DIRECTIVE_VERSION, '1.0.0');
assert.doesNotThrow(() => assertCouncilDirective());
assert.equal(COUNCIL_DIRECTIVE.sourceOfWork, 'المهام.md');
assert.equal(COUNCIL_DIRECTIVE.greenAuthority, 'Daily·FLIXO Green Gate');
assert.equal(COUNCIL_DIRECTIVE.llmDirectExecution, false);
assert.equal(COUNCIL_DIRECTIVE.thirdBranchAllowed, false);
assert.equal(COUNCIL_DIRECTIVE.taskRegistryCount, 1);
assert.equal(COUNCIL_DIRECTIVE.repeatedRedRequiresNewStrategyOrEvidence, true);
assert.ok(COUNCIL_DIRECTIVE.roles.coordinator);
assert.ok(COUNCIL_DIRECTIVE.roles.learning);
assert.ok(COUNCIL_DIRECTIVE.closure.includes('exact-sha'));
assert.throws(() => assertCouncilDirective({ ...COUNCIL_DIRECTIVE, sourceOfWork: 'parallel-registry' }), /COUNCIL_DIRECTIVE_AUTHORITY_INVALID/);
assert.throws(() => assertCouncilDirective({ ...COUNCIL_DIRECTIVE, exactShaRequired: false }), /COUNCIL_DIRECTIVE_GREEN_AUTHORITY_INVALID/);
console.log('COUNCIL_DIRECTIVE=PASS');
