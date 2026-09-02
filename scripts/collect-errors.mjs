import fs from 'node:fs';
import path from 'node:path';

const root = process.env.ERROR_ARTIFACT_ROOT || 'error-artifacts';
const output = process.env.ERROR_REPORT_PATH || 'error-report.json';
const commit = process.env.GITHUB_SHA || 'unknown';

const files = fs.existsSync(root)
  ? fs.readdirSync(root, { recursive: true }).map((value) => path.join(root, value)).filter((value) => fs.existsSync(value) && fs.statSync(value).isFile())
  : [];

const results = files
  .filter((file) => file.endsWith('result.json'))
  .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')))
  .filter((result) => result && typeof result === 'object');

const classify = (message, job) => {
  const text = `${job}\n${message}`;
  if (/TS\d+|typeerror|cannot find module|type '.*' is not assignable/i.test(text)) return 'TypeError';
  if (/eslint|lint|no-unused|prettier/i.test(text)) return 'LintError';
  if (/contract|registry|route|assertion.*contract|validation failed/i.test(text)) return 'ContractError';
  if (/test|expect\(|playwright|vitest|jest|failed|timeout/i.test(text)) return 'TestError';
  return 'TestError';
};

const errors = [];
for (const result of results) {
  if (result.status === 'success') continue;
  const outputText = typeof result.output === 'string' ? result.output : '';
  const lines = outputText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = lines.filter((line) => /error|failed|failure|timeout|TS\d+/i.test(line));
  const selected = candidates.length ? candidates : [result.message || `${result.job || 'job'} failed`];
  for (const message of selected) {
    errors.push({
      type: classify(message, result.job),
      job: result.job,
      file: result.file || null,
      message,
    });
  }
}

const byCategory = (type) => errors.filter((error) => error.type === type).length;
const report = {
  timestamp: new Date().toISOString(),
  commit,
  errors,
  summary: {
    total: errors.length,
    typecheck: results.filter((r) => r.job === 'typecheck' && r.status !== 'success').length,
    lint: results.filter((r) => r.job === 'lint' && r.status !== 'success').length,
    contracts: results.filter((r) => r.job === 'contracts' && r.status !== 'success').length,
    unit: results.filter((r) => r.job === 'unit-tests' && r.status !== 'success').length,
    integration: results.filter((r) => r.job === 'integration-tests' && r.status !== 'success').length,
    e2e: results.filter((r) => r.job === 'e2e-matrix' && r.status !== 'success').length,
    classified: {
      TypeError: byCategory('TypeError'),
      LintError: byCategory('LintError'),
      ContractError: byCategory('ContractError'),
      TestError: byCategory('TestError'),
    },
  },
};

fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${output}: ${errors.length} error(s).`);
if (results.length === 0) {
  console.error('No job result artifacts were found; fail closed.');
  process.exit(2);
}
if (results.some((result) => result.status !== 'success')) process.exitCode = 1;
