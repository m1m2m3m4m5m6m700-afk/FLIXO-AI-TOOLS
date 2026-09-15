import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const output = execFileSync('node', ['scripts/ci/extract-error-root-causes.mjs', 'docs/ERROR_MEMORY.md'], { encoding: 'utf8' });
const report = JSON.parse(output);

assert.equal(report.schemaVersion, 1);
assert.equal(report.source, 'docs/ERROR_MEMORY.md');
assert.equal(report.incidentCount, 7);
assert.equal(report.incidents.length, 7);
assert.equal(report.incidents.find((incident) => incident.id === 'F-006')?.status, 'Fixed in code; CI revalidation pending');
assert.equal(report.incidents.find((incident) => incident.id === 'F-005')?.status, 'Superseded');
assert.equal(report.incidents.find((incident) => incident.id === 'F-007')?.rootCauseKey, 'validator-used-source-text-route-discovery-and-initially-treated-non-ready-routes-as-expected-public-routes');
assert.ok(report.rootCauseGroups.every((group) => group.incidentIds.length >= 1));
assert.equal(report.unresolvedCount, 1);

for (const incident of report.incidents) {
  assert.ok(incident.id.match(/^F-\d+$/));
  assert.ok(incident.rootCause);
  assert.ok(incident.rootCauseKey);
}

console.log(`ERROR ROOT CAUSE EXTRACTOR: PASS (${report.incidentCount} incidents, ${report.rootCauseGroups.length} root-cause groups)`);
