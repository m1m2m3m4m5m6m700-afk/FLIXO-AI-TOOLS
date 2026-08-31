import assert from 'node:assert/strict';
import { aggregateFailures } from './engine.ts';
import { classifyFailure } from './taxonomy.ts';

const unknown = classifyFailure({ id: '1', contract: 'CI-X', status: 'FAIL', message: 'something unexpected' });
assert.equal(unknown.classification, 'UNKNOWN');
assert.equal(unknown.confidence, 'LOW');

const uploadTimeout = classifyFailure({
  id: 'g3-upload-timeout',
  contract: 'G3-DOWNLOAD-001',
  status: 'FAIL',
  message: 'TimeoutError: locator.setInputFiles: Timeout 15000ms exceeded.',
  source: 'tests/helpers/upload-file.ts:39',
});
assert.equal(uploadTimeout.classification, 'RUNTIME_EXCEPTION');
assert.equal(uploadTimeout.rootCauseId, 'RC-G3-RUNTIME-001');
assert.equal(uploadTimeout.confidence, 'HIGH');

const report = aggregateFailures([
  { id: '1', contract: 'G4-TITLE-001', status: 'FAIL', message: 'localized title mismatch', route: '/tr/x', locale: 'tr' },
  { id: '2', contract: 'G4-TITLE-001', status: 'FAIL', message: 'localized title mismatch', route: '/tr/y', locale: 'tr' },
  { id: '3', contract: 'G3-INTEGRITY-001', status: 'FAIL', message: 'artifact integrity SHA mismatch', route: '/en/x', locale: 'en' },
  { id: '4', contract: 'G3-DOWNLOAD-001', status: 'FAIL', message: 'TimeoutError: locator.setInputFiles: Timeout 15000ms exceeded.', route: '/en/image-compressor', locale: 'en' },
]);

assert.equal(report.rootCauses.length, 3);
assert.equal(report.rootCauses.find((rootCause) => rootCause.rootCauseId === 'RC-G3-RUNTIME-001')?.occurrences, 1);
assert.equal(report.rootCauses.find((rootCause) => rootCause.rootCauseId === 'RC-G4-SEO-003')?.occurrences, 2);
assert.equal(report.unknownCount, 0);
assert.equal(report.reportHash.length, 64);

console.log('CI failure intelligence semantics PASS');
