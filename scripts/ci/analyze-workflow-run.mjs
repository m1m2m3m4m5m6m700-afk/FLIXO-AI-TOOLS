import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const inputPath = process.argv[2] ?? 'diagnostics/ci/workflow-run.json';
const outputPath = process.argv[3] ?? 'diagnostics/ci/diagnostic-report.json';
const root = process.cwd();
const payload = JSON.parse(readFileSync(resolve(root, inputPath), 'utf8'));
const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];

function classify(job) {
  const name = String(job.name ?? '').toLowerCase();
  const conclusion = String(job.conclusion ?? 'unknown');
  const status = String(job.status ?? 'unknown');
  if (conclusion === 'success') return null;
  if (status === 'queued' || status === 'in_progress') return { category: 'INFRA', symptom: 'job-not-complete', owner: String(job.name ?? 'unknown') };
  if (/codeql|secret|socket|security|audit/.test(name)) return { category: 'SECURITY', symptom: conclusion, owner: String(job.name ?? 'unknown') };
  if (/localization|locale|i18n/.test(name)) return { category: 'I18N', symptom: conclusion, owner: String(job.name ?? 'unknown') };
  if (/s3|seo|artifact|build/.test(name)) return { category: 'ARTIFACT', symptom: conclusion, owner: String(job.name ?? 'unknown') };
  if (/type|lint|contract/.test(name)) return { category: 'STATIC', symptom: conclusion, owner: String(job.name ?? 'unknown') };
  if (/runtime|e2e|chromium|firefox|webkit|playwright/.test(name)) return { category: 'E2E', symptom: conclusion, owner: String(job.name ?? 'unknown') };
  if (/canonical|ci/.test(name)) return { category: 'GATE', symptom: conclusion, owner: String(job.name ?? 'unknown') };
  return { category: 'UNKNOWN', symptom: conclusion, owner: String(job.name ?? 'unknown') };
}

const failures = jobs.map(classify).filter(Boolean);
const result = {
  schema: 'flixo.ci-diagnostic.v1',
  sha: String(payload.head_sha ?? 'unknown'),
  run_id: String(payload.run_id ?? 'unknown'),
  workflow: String(payload.workflow ?? 'unknown'),
  conclusion: String(payload.conclusion ?? 'unknown'),
  generated_at: new Date().toISOString(),
  job_count: jobs.length,
  failure_count: failures.length,
  result: failures.length === 0 && payload.conclusion === 'success' ? 'PASS' : 'FAIL',
  failures,
};

mkdirSync(resolve(root, 'diagnostics/ci'), { recursive: true });
writeFileSync(resolve(root, outputPath), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
