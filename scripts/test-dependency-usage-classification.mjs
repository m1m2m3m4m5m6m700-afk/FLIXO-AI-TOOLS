import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';

const output = 'diagnostics/dependency-usage-test.json';
rmSync(output, { force: true });
execFileSync(process.execPath, ['scripts/report-dependency-usage.mjs'], {
  env: { ...process.env, DEPENDENCY_USAGE_JSON: output },
  stdio: 'pipe',
});

if (!existsSync(output)) throw new Error('Usage report was not generated.');
const report = JSON.parse(readFileSync(output, 'utf8'));
if (!report.summary || !Array.isArray(report.entries)) throw new Error('Invalid usage report shape.');
if (report.summary.total !== report.entries.length) throw new Error('Usage report summary mismatch.');
for (const entry of report.entries) {
  if (!entry.name || !entry.declaredIn || !entry.classification || !Array.isArray(entry.files)) {
    throw new Error(`Invalid dependency entry: ${JSON.stringify(entry)}`);
  }
}
rmSync(output, { force: true });
console.log(`Dependency usage contract OK (${report.entries.length} dependencies).`);
