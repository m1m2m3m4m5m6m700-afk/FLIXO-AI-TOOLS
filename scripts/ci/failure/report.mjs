import { mkdir, writeFile } from 'node:fs/promises';
import { aggregateFailures } from './engine.ts';

const events = JSON.parse(process.env.CI_FAILURE_EVENTS ?? '[]');
const report = aggregateFailures(events);
await mkdir('artifacts/ci/failure', { recursive: true });
await writeFile('artifacts/ci/failure/report.json', JSON.stringify(report, null, 2) + '\n');
const summary = [
  '# FLIXO CI — Failure Intelligence',
  '',
  `Root causes: ${report.rootCauses.length}`,
  `Failures: ${report.failures.length}`,
  `Unknown: ${report.unknownCount}`,
  '',
  ...report.rootCauses.map((r) => `- ${r.rootCauseId} — ${r.classification} — ${r.occurrences} occurrence(s)`),
].join('\n') + '\n';
await writeFile('artifacts/ci/failure/report.md', summary);
console.log(`Failure report PASS: ${report.rootCauses.length} root causes`);
