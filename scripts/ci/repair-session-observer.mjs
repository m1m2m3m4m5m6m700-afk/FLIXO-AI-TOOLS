#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repo = process.env.GITHUB_REPOSITORY ?? '';
const chainId = String(process.env.FLIXO_REPAIR_CHAIN_ID ?? '').trim();
const fingerprint = String(process.env.FLIXO_FAILURE_FINGERPRINT ?? '').trim();
const targetSha = String(process.env.FLIXO_EXPECTED_TARGET_SHA ?? process.env.FLIXO_TARGET_SHA ?? '').trim();
const outputPath = process.env.FLIXO_REPAIR_BEHAVIOR_TRACE_PATH ?? '/tmp/flixo-repair-behavior-trace.json';
const limit = Math.min(30, Math.max(5, Number(process.env.FLIXO_REPAIR_OBSERVER_RUN_LIMIT ?? 15)));

if (!repo) throw new Error('REPAIR_SESSION_OBSERVER_REPOSITORY_MISSING');

function ghJson(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8', env: process.env });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'gh command failed').trim());
  return JSON.parse(result.stdout || 'null');
}

function stageForStep(name) {
  const value = String(name ?? '').toLowerCase();
  if (/evidence|failed ci logs/.test(value)) return 'evidence_capture';
  if (/self-test|control plane|immutable repair boundary before mutation|trusted repair controller/.test(value)) return 'controller_preflight';
  if (/task agent|file-selection|knowledge audit|historical|twin/.test(value)) return 'preparation';
  if (/classify root cause|causal root proof/.test(value)) return 'root_cause';
  if (/select repair strategy|strategy/.test(value)) return 'strategy_selection';
  if (/execute bounded|auto-repair-engine|execute repair/.test(value)) return 'repair_execution';
  if (/phase [123] ai|postflight|preflight/.test(value)) return 'postflight_intelligence';
  if (/verify repair|verification/.test(value)) return 'verification';
  if (/learning|publish|commit|push|handoff/.test(value)) return 'publication_learning';
  return 'workflow_orchestration';
}

function summarizeRun(run) {
  let jobs;
  try {
    jobs = ghJson(['api', 'repos/' + repo + '/actions/runs/' + run.databaseId + '/jobs?per_page=100']).jobs ?? [];
  } catch {
    jobs = [];
  }
  const steps = jobs.flatMap(job => (job.steps ?? []).map(step => ({ job: job.name, name: step.name, status: step.status, conclusion: step.conclusion, number: step.number })));
  const failed = steps.filter(step => ['failure', 'timed_out'].includes(step.conclusion));
  const active = steps.filter(step => ['in_progress', 'queued'].includes(step.status));
  const firstFailure = failed[0] ?? null;
  const executedNames = new Set(steps.filter(step => step.status === 'completed').map(step => step.name));
  const reachedExecute = [...executedNames].some(name => /execute bounded root-cause repair|auto-repair-engine|execute repair/i.test(name));
  const controllerPreExecutionFailure = failed.length > 0 && !reachedExecute;
  return { runId: run.databaseId, displayTitle: run.displayTitle ?? null, headSha: run.headSha ?? null, status: run.status, conclusion: run.conclusion ?? null, event: run.event ?? null, createdAt: run.createdAt ?? null, updatedAt: run.updatedAt ?? null, stage: firstFailure ? stageForStep(firstFailure.name) : run.status === 'in_progress' ? 'active' : 'unknown', firstFailedStep: firstFailure?.name ?? null, failedSteps: failed.map(step => ({ name: step.name, conclusion: step.conclusion })).slice(0, 8), activeSteps: active.map(step => step.name).slice(0, 8), controllerPreExecutionFailure, engineError: controllerPreExecutionFailure && run.conclusion !== 'success' };
}

const payload = ghJson(['run', 'list', '--repo', repo, '--workflow', 'auto-repair.yml', '--limit', String(limit), '--json', 'databaseId,displayTitle,status,conclusion,headSha,event,createdAt,updatedAt']);
const allRuns = Array.isArray(payload) ? payload : [];
const inferredChainId = chainId || (String(allRuns[0]?.displayTitle ?? '').match(/^FLIXO Auto Repair Chain ([^ ]+)/)?.[1] ?? '');
let executionSha = targetSha;
if (!executionSha) {
  try {
    executionSha = String(ghJson(['api', 'repos/' + repo + '/git/ref/heads/execution']).object?.sha ?? '').trim();
  } catch {
    executionSha = '';
  }
}
const matched = allRuns.filter(run => {
  const title = String(run.displayTitle ?? '');
  if (inferredChainId && title.includes(inferredChainId)) return true;
  if (fingerprint && title.includes(fingerprint)) return true;
  return !inferredChainId && !fingerprint && (!executionSha || run.headSha === executionSha);
});
const runs = matched.slice(0, limit).map(summarizeRun);
const completed = runs.filter(run => ['failure', 'timed_out', 'cancelled', 'success'].includes(run.conclusion));
const failures = completed.filter(run => ['failure', 'timed_out'].includes(run.conclusion));
const stageCounts = new Map();
for (const run of failures) stageCounts.set(run.stage, (stageCounts.get(run.stage) ?? 0) + 1);
const repeatedStages = [...stageCounts.entries()].filter(item => item[1] >= 2).sort((a, b) => b[1] - a[1]);
const repeatedStage = repeatedStages[0]?.[0] ?? null;
const sameShaFailures = failures.filter(run => !executionSha || run.headSha === executionSha);
const noProgress = sameShaFailures.length >= 2 && repeatedStage !== null;
const engineErrorRuns = failures.filter(run => run.engineError);
const nextStrategy = repeatedStage === 'controller_preflight' || repeatedStage === 'preparation' || repeatedStage === 'evidence_capture' ? 'workflow-forensics' : repeatedStage === 'strategy_selection' ? 'alternate-hypothesis' : repeatedStage === 'repair_execution' ? 'observability-trace' : repeatedStage === 'verification' ? 'alternate-hypothesis' : repeatedStage === 'workflow_orchestration' ? 'workflow-forensics' : (noProgress || engineErrorRuns.length >= 2 ? 'alternate-hypothesis' : null);
const directive = { strategyChangeRequired: noProgress || engineErrorRuns.length >= 2, controllerFaultDetected: engineErrorRuns.length > 0, repeatedStage, repeatedStageCount: repeatedStages[0]?.[1] ?? 0, repeatedSameShaFailureCount: sameShaFailures.length, engineErrorRuns: engineErrorRuns.length, noProgress, nextStrategy, doNotRepeatCurrentBehavior: noProgress || engineErrorRuns.length >= 2, reason: noProgress ? 'SAME_SESSION_BEHAVIOR_REPEATED_WITHOUT_VERIFIABLE_PROGRESS' : engineErrorRuns.length >= 2 ? 'PRE_EXECUTION_CONTROLLER_FAILURE_REPEATED' : 'NO_REPEATED_BEHAVIOR_SIGNAL' };
const result = { schemaVersion: 1, protocol: 'FLIXO-REPAIR-BOT-BEHAVIOR-TRACE-v1', observedAt: new Date().toISOString(), repository: repo, chainId: inferredChainId || null, failureFingerprint: fingerprint || null, targetSha: executionSha || null, observedRuns: runs, aggregate: { runCount: runs.length, completedCount: completed.length, failureCount: failures.length, activeCount: runs.filter(run => run.status === 'in_progress' || run.status === 'queued').length, successCount: completed.filter(run => run.conclusion === 'success').length, cancelledCount: completed.filter(run => run.conclusion === 'cancelled').length }, directive };
result.traceHash = createHash('sha256').update(JSON.stringify(result), 'utf8').digest('hex');
fs.mkdirSync(outputPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ protocol: result.protocol, traceHash: result.traceHash, directive, runCount: runs.length }));