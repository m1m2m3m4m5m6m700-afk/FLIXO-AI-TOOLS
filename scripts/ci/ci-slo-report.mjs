import { writeFileSync } from 'node:fs';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');

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

const ciRuns = await fetchRuns('ci.yml');
const ciSuccess = ciRuns.filter((run) => run.conclusion === 'success');
const ciDurations = ciSuccess.map(durationMinutes);

const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  main_sha: process.env.GITHUB_SHA ?? null,
  samples: { ci_success: ciDurations.length },
  ci: {
    median_minutes: quantile(ciDurations, 0.5),
    p95_minutes: quantile(ciDurations, 0.95),
    latest_minutes: ciDurations.length ? Number(ciDurations[0].toFixed(2)) : null,
  },
  policy: {
    note: 'Advisory baseline: SLO values are measured from completed main runs; browser matrix certification is owned by canonical ci.yml.',
  },
};

writeFileSync('diagnostics/ci-slo.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));