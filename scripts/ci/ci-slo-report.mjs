import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');

const outputPath = 'diagnostics/ci-slo.json';

async function fetchRuns(workflow) {
  const url = `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/runs?branch=main&status=completed&per_page=20`;
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!response.ok) throw new Error(`GitHub API ${workflow}: ${response.status}`);
  return (await response.json()).workflow_runs ?? [];
}

const durationMinutes = (run) => (new Date(run.updated_at).getTime() - new Date(run.run_started_at).getTime()) / 60000;
const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((sorted.length - 1) * q)));
  return Number(sorted[index].toFixed(2));
};
const newestFirst = (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

const [ciRuns, fullRuns] = await Promise.all([
  fetchRuns('ci.yml'),
  fetchRuns('full-matrix-parallel.yml'),
]);
const ciSuccess = ciRuns.filter((run) => run.conclusion === 'success').sort(newestFirst);
const fullSuccess = fullRuns.filter((run) => run.conclusion === 'success').sort(newestFirst);
const ciDurations = ciSuccess.map(durationMinutes);
const fullDurations = fullSuccess.map(durationMinutes);
const checkedOutSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  main_sha: checkedOutSha,
  samples: { ci_success: ciDurations.length, full_matrix_success: fullDurations.length },
  ci: {
    median_minutes: quantile(ciDurations, 0.5),
    p95_minutes: quantile(ciDurations, 0.95),
    latest_minutes: ciDurations.length ? Number(ciDurations[0].toFixed(2)) : null,
  },
  full_matrix: {
    median_minutes: quantile(fullDurations, 0.5),
    p95_minutes: quantile(fullDurations, 0.95),
    latest_minutes: fullDurations.length ? Number(fullDurations[0].toFixed(2)) : null,
  },
  policy: {
    note: 'Advisory baseline: SLO values are measured from completed main runs; this report does not weaken blocking gates.',
  },
};

mkdirSync('diagnostics', { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
