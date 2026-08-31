import assert from 'node:assert/strict';
import { aggregateFailures } from './engine.ts';
import { classifyFailure } from './taxonomy.ts';

const unknown = classifyFailure({ id: '1', contract: 'CI-X', status: 'FAIL', message: 'something unexpected' });
assert.equal(unknown.classification, 'UNKNOWN');
assert.equal(unknown.confidence, 'LOW');

const report = aggregateFailures([
  { id: '1', contract: 'G4-TITLE-001', status: 'FAIL', message: 'localized title mismatch', route: '/tr/x', locale: 'tr' },
  { id: '2', contract: 'G4-TITLE-001', status: 'FAIL', message: 'localized title mismatch', route: '/tr/y', locale: 'tr' },
  { id: '3', contract: 'G3-INTEGRITY-001', status: 'FAIL', message: 'artifact integrity SHA mismatch', route: '/en/x', locale: 'en' },
]);

assert.equal(report.rootCauses.length, 2);
assert.equal(report.rootCauses[0].occurrences, 2);
assert.equal(report.unknownCount, 0);
assert.equal(report.reportHash.length, 64);

console.log('CI failure intelligence semantics PASS');
