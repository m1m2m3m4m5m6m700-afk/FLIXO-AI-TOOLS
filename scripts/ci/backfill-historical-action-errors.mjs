#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!repo || !token) throw new Error('HISTORICAL_ACTION_ERROR_GITHUB_AUTH_REQUIRED');

const start = process.env.FLIXO_HISTORY_START ?? '2026-08-10T00:00:00Z';
const end = process.env.FLIXO_HISTORY_END ?? new Date().toISOString();
const batchDays = Math.max(1, Math.min(31, Number(process.env.FLIXO_HISTORY_BATCH_DAYS ?? 7)));
const outDir = path.resolve(process.env.FLIXO_HISTORY_OUT ?? '/tmp/flixo-historical-errors');
fs.mkdirSync(outDir, { recursive: true });

const ANSI_ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(ANSI_ESC + '\\\\[[0-?]*[ -/]*[@-~]', 'gu');
const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');
const relevant = /(error|failed|failure|fatal|exception|assert|ts\d{3,4}|type .* is not assignable|cannot find name|expect\(|timeout|timed out|permission|forbidden|unauthorized|npm err|module not found|codeql|deployment|vercel|supabase)/iu;
const priority = /(^|\\b)(##\\[error\\]|error:|failed|failure|fatal|exception|assert|ts\\d{3,4}|cannot find name|type .* is not assignable|expect\\(|timeout|timed out|permission denied|forbidden|unauthorized)(\\b|:)/iu;

const api = async (url, attempt = 0) => {
  const response = await fetch('https://api.github.com' + url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + token,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'FLIXO-historical-action-error-indexer',
    },
  });
  const body = await response.text();
  let data = null;
  try { data = body ? JSON.parse(body) : null; } catch {}

  if ((response.status === 403 || response.status === 429) && attempt < 8) {
    const retryAfter = Number(response.headers.get('retry-after') ?? Math.min(60, 5 * (attempt + 1)));
    await new Promise((resolve) => setTimeout(resolve, Math.max(5, Math.min(120, retryAfter)) * 1000));
    return api(url, attempt + 1);
  }

  if (!response.ok) throw new Error('GITHUB_API_' + response.status + '=' + url);
  return data;
};

function normalize(line) {
  return String(line)
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*/u, '')
    .replace(ANSI_PATTERN, '')
    .replace(/https?:\/\/[^\s]+/gu, '<URL>')
    .replace(/\b[0-9a-f]{40}\b/giu, '<SHA>')
    .replace(/\b\d{8,}\b/gu, '<N>')
    .replace(/\s+/gu, ' ')
    .trim();
}

async function fetchFailedRuns(windowStart, windowEnd) {
  const out = new Map();
  for (let page = 1; page <= 100; page += 1) {
    const payload = await api(
      '/repos/' + repo + '/actions/runs?status=completed&created=' +
      encodeURIComponent(windowStart + '..' + windowEnd) +
      '&per_page=100&page=' + page,
    );
    const runs = payload.workflow_runs ?? [];
    for (const run of runs) {
      if (['failure', 'timed_out', 'cancelled', 'action_required'].includes(String(run.conclusion))) {
        out.set(String(run.id), run);
      }
    }
    if (runs.length < 100) break;
  }
  return [...out.values()];
}

async function fetchJobs(runId) {
  const payload = await api(
    '/repos/' + repo + '/actions/runs/' + runId + '/jobs?filter=latest&per_page=100&page=1',
  );
  return payload.jobs ?? [];
}

async function fetchJobLog(jobId) {
  for (let attempt = 0; attempt <= 8; attempt += 1) {
    const response = await fetch(
      'https://api.github.com/repos/' + repo + '/actions/jobs/' + jobId + '/logs',
      {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: 'Bearer ' + token,
          'x-github-api-version': '2022-11-28',
          'user-agent': 'FLIXO-historical-action-error-indexer',
        },
      },
    );

    if (response.status === 404) return '';
    if (response.status === 403 || response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') ?? Math.min(60, 5 * (attempt + 1)));
      await new Promise((resolve) => setTimeout(resolve, Math.max(5, Math.min(120, retryAfter)) * 1000));
      continue;
    }
    if (!response.ok) throw new Error('GITHUB_LOG_' + response.status + '=job:' + jobId);
    return response.text();
  }
  throw new Error('GITHUB_LOG_RATE_LIMIT=job:' + jobId);
}

function selectErrorLines(log) {
  const selected = [];
  const seen = new Set();
  for (const line of String(log).split(/\r?\n/u)) {
    if (!relevant.test(line)) continue;
    const normalized = normalize(line);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    selected.push(normalized);
  }
  const ranked = [
    ...selected.filter((line) => priority.test(line)),
    ...selected.filter((line) => !priority.test(line)),
  ];
  return ranked.slice(0, 500);
}

const occurrences = [];
const seenRunIds = new Set();
let jobCount = 0;
let logJobCount = 0;

const startDate = new Date(start);
const endDate = new Date(end);
if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
  throw new Error('HISTORICAL_ACTION_ERROR_DATE_WINDOW_INVALID');
}

for (
  let cursor = new Date(startDate);
  cursor < endDate;
  cursor = new Date(Math.min(cursor.getTime() + batchDays * 86400000, endDate.getTime()))
) {
  const windowStart = cursor.toISOString();
  const windowEnd = new Date(Math.min(cursor.getTime() + batchDays * 86400000, endDate.getTime())).toISOString();
  const runs = await fetchFailedRuns(windowStart, windowEnd);

  for (const run of runs) {
    const runId = String(run.id);
    if (seenRunIds.has(runId)) continue;

    const createdAt = new Date(String(run.created_at ?? ''));
    if (!Number.isFinite(createdAt.getTime()) || createdAt < new Date(windowStart) || createdAt >= new Date(windowEnd)) continue;
    seenRunIds.add(runId);

    const jobs = await fetchJobs(run.id);
    jobCount += jobs.length;

    for (const job of jobs.filter((item) => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(item.conclusion))) {
      logJobCount += 1;
      const log = await fetchJobLog(job.id);
      for (const line of selectErrorLines(log)) {
        occurrences.push({
          workflow: run.name,
          job: job.name,
          runId,
          sha: String(run.head_sha ?? ''),
          branch: String(run.head_branch ?? ''),
          rawLine: line,
          seenAt: String(run.created_at ?? new Date().toISOString()),
        });
      }
    }
  }
}

const payload = {
  schemaVersion: 3,
  source: 'github-actions-logs',
  authority: 'historical-observation',
  externalDiagnosis: false,
  proofAuthority: 'CURRENT_EXACT_SHA_CI_ONLY',
  start,
  end,
  batchDays,
  runCount: seenRunIds.size,
  failedRunCount: seenRunIds.size,
  jobCount,
  logJobCount,
  occurrenceCount: occurrences.length,
  digest: sha256(JSON.stringify(occurrences)),
  occurrences,
};

const file = path.join(outDir, 'batch-' + start.slice(0, 10) + '-' + end.slice(0, 10) + '.json');
fs.writeFileSync(file, JSON.stringify(payload));
console.log(JSON.stringify({ ...payload, occurrences: undefined, file }, null, 2));
