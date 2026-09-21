import assert from 'node:assert/strict';
import { searchRegressionCounterexamples } from './regression-counterexamples.mjs';

const clean=searchRegressionCounterexamples({
 targetSha:'a'.repeat(40),
 failureFingerprint:'fp',
 selectedFiles:['src/example.ts'],
 relatedFiles:['src/example.ts'],
 sourceFiles:{'src/example.ts':'export function example(x:number){ if(x===0){ return "boundary"; } return "ok"; }'},
 diff:'@@\n- return "bad";\n+ return "ok";\n',
 failureLog:'ERROR original failure in src/example.ts',
});
assert.equal(clean.protocol,'REGRESSION-COUNTEREXAMPLE-SEARCH-v1');
assert.equal(clean.requiredSearches,12);
assert.equal(clean.searchedCount,12);
assert.equal(clean.counterexampleFound,false);
assert.equal(clean.exhausted,true);
assert.equal(clean.noCounterexampleIsNotPatchCorrect,true);

const bad=searchRegressionCounterexamples({
 targetSha:'b'.repeat(40),
 failureFingerprint:'fp2',
 selectedFiles:['src/example.ts'],
 relatedFiles:['src/example.ts','.github/workflows/auto-repair.yml'],
 sourceFiles:{
  'src/example.ts':'export function example(){return "ok";}',
  '.github/workflows/auto-repair.yml':'name: x',
 },
 diff:'+ continue-on-error: true\n',
 failureLog:'ERROR failure',
});
assert.equal(bad.counterexampleFound,true);
assert.ok(bad.validCounterexamples.some(x=>x.id==='RC01_ORIGINAL_FAILURE_RECURRENCE'||x.id==='RC12_CONTROL_PLANE_MUTATION'));
console.log('REGRESSION_COUNTEREXAMPLE_SEARCH=PASS');