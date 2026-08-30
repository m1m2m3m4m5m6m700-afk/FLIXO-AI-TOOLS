import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const inputPath = process.argv[2] ?? 'diagnostics/ci/workflow-run.json';
const configPath = process.argv[3] ?? '.github/ci-slo.json';
const root = process.cwd();
const payload = JSON.parse(readFileSync(resolve(root, inputPath), 'utf8'));
const config = JSON.parse(readFileSync(resolve(root, configPath), 'utf8'));

const parseTime = (value) => {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : null;
};

const started = parseTime(payload.run_started_at);
const updated = parseTime(payload.updated_at);
const durationSeconds = started !== null && updated !== null ? Math.max(0, (updated - started) / 1000) : null;
const target = Number(config.full_run_max_seconds);
const pass = durationSeconds !== null && Number.isFinite(target) && durationSeconds <= target;

const result = {
  schema: 'flixo.ci-slo.v1',
  sha: String(payload.head_sha ?? 'unknown'),
  run_id: String(payload.run_id ?? 'unknown'),
  workflow: String(payload.workflow ?? 'unknown'),
  measured_duration_seconds: durationSeconds === null ? null : Math.round(durationSeconds),
  target_max_seconds: Number.isFinite(target) ? target : null,
  measured: durationSeconds !== null,
  result: pass ? 'PASS' : 'FAIL',
};

console.log(JSON.stringify(result, null, 2));
if (!pass) process.exit(1);
