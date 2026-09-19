#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fingerprintFailure } from './auto-repair/fingerprint.mjs';

export const REQUIRED_WORKFLOWS = Object.freeze([
  'FLIXO Test System',
  'FLIXO WP0 Trust Baseline',
  'FLIXO Test Impact',
  'FLIXO Test Impact Execution',
  'Repository Security Baseline',
  'Claude Security Review',
]);

const SECURITY_CHECK_PATTERNS = Object.freeze([
  /github-advanced-security/i,
  /github advanced security/i,
  /codeql/i,
  /code scanning ai findings/i,
]);

const CERTIFICATION_CHECK_PATTERNS = Object.freeze([
  /^certification$/i,
  /(^|\/)certification$/i,
]);

const EXTERNAL_CHECK_PATTERNS = Object.freeze([
  /^vercel$/i,
  /^vercel deployment$/i,
]);

const PROVIDER_FAILURE_PATTERNS = Object.freeze([
  /CAPIError/i,
  /SessionModelError/i,
  /requested model is not supported/i,
  /api-deployments-free-per-day/i,
  /rate limit/i,
  /quota/i,
  /deployment provider/i,
]);

const latestBy = (items, predicate) => items
  .filter(predicate)
  .sort((a, b) => String(b.updatedAt ?? b.completed_at ?? b.started_at ?? '').localeCompare(String(a.updatedAt ?? a.completed_at ?? a.started_at ?? '')))[0] ?? null;

const latestWorkflow = (runs, name) => latestBy(runs, (run) => run.workflowName === name);
const latestCheck = (checks, patterns) => latestBy(checks, (check) => patterns.some((pattern) => pattern.test(String(check.name ?? ''))));
const stateOf = (item) => !item ? 'MISSING' : item.status === 'completed' ? (item.conclusion ?? 'unknown') : (item.status ?? 'unknown');
const providerFailure = (log) => PROVIDER_FAILURE_PATTERNS.some((pattern) => pattern.test(String(log ?? '')));

export function classifyCancelledRun(run, runs = []) {
  if (!run || run.status !== 'completed' || run.conclusion !== 'cancelled') return null;
  const successor = latestBy(runs, (candidate) =>
    candidate !== run &&
    candidate.workflowName === run.workflowName &&
    candidate.headSha === run.headSha &&
    String(candidate.updatedAt ?? candidate.completed_at ?? candidate.started_at ?? '') >
      String(run.updatedAt ?? run.completed_at ?? run.started_at ?? '') &&
    (candidate.status !== 'completed' || candidate.conclusion !== 'cancelled')
  );
  return successor
    ? { state: 'CANCELLED_SUPERSEDED', successorRunId: successor.databaseId ?? null }
    : { state: 'CANCELLED_UNSUPERSEDED', successorRunId: null };
}

export function validateRepairTarget({ run, executionSha, workflowRuns = [], logs = {}, branch = 'execution' } = {}) {
  const errors = [];
  if (!run?.databaseId) errors.push('TARGET_MISSING');
  if (!run || run.status !== 'completed' || !['failure', 'timed_out', 'cancelled'].includes(run.conclusion)) errors.push('TARGET_NOT_FAILED_COMPLETED');
  if (run?.headSha !== executionSha) errors.push('TARGET_SHA_MISMATCH');
  if ((run?.headBranch ?? null) !== branch) errors.push('TARGET_BRANCH_MISMATCH');
  if (!REQUIRED_WORKFLOWS.includes(String(run?.workflowName ?? ''))) errors.push('TARGET_WORKFLOW_NOT_ALLOWED');
  if (/auto repair/i.test(String(run?.workflowName ?? ''))) errors.push('TARGET_SELF_REPAIR');
  if (classifyCancelledRun(run, workflowRuns)?.state === 'CANCELLED_SUPERSEDED') errors.push('TARGET_SUPERSEDED');
  const evidence = String(logs[String(run?.databaseId ?? '')] ?? '').trim();
  if (!evidence || /EVIDENCE_CAPTURE=FAILED/i.test(evidence)) errors.push('EVIDENCE_CAPTURE_FAILED');
  return { valid: errors.length === 0, errors };
}

const logForCheck = (check, logs) => {
  const detailsUrl = String(check?.details_url ?? '');
  const match = detailsUrl.match(/\/actions\/runs\/(\d+)/);
  return logs[String(match?.[1] ?? '')] ?? logs[String(check?.id ?? '')] ?? '';
};

function externalCheckBlock(check, log) {
  if (!check || !EXTERNAL_CHECK_PATTERNS.some((pattern) => pattern.test(String(check.name ?? '')))) return null;
  return {
    kind: 'BLOCKED_EXTERNAL',
    checkName: check.name,
    state: stateOf(check),
    rootCause: providerFailure(log) ? 'PROVIDER_RATE_LIMIT_OR_DEPLOYMENT_SERVICE_FAILURE' : 'EXTERNAL_PROVIDER_UNRESOLVED',
  };
}

function securityProviderBlock(check, log) {
  if (!check || !SECURITY_CHECK_PATTERNS.some((pattern) => pattern.test(String(check.name ?? '')))) return null;
  if (check.status === 'completed' && check.conclusion === 'success') return null;
  if (!providerFailure(log)) return null;
  return {
    kind: 'BLOCKED_EXTERNAL',
    checkName: check.name,
    state: stateOf(check),
    rootCause: 'EXTERNAL_SECURITY_PROVIDER_FAILURE',
  };
}

export function evaluateGreen({
  executionSha,
  mainSha,
  openPr = null,
  latestMergedPr = null,
  workflowRuns = [],
  checkRuns = [],
  statuses = [],
  logs = {},
  compare = {},
} = {}) {
  const report = {
    schemaVersion: 1,
    protocol: 'FLIXO-CONTINUOUS-ERROR-WATCH-v1',
    generatedAt: new Date().toISOString(),
    executionSha,
    mainSha,
    branch: 'execution',
    pr: openPr ? {
      number: openPr.number ?? null,
      headSha: openPr.headRefOid ?? null,
      baseSha: openPr.baseRefOid ?? null,
      url: openPr.url ?? null,
    } : null,
    status: 'FAIL_CLOSED',
    rootCause: null,
    errors: [],
    externalBlockers: [],
    repair: {
      required: false,
      targetRunId: null,
      failureFingerprint: null,
      repairKey: null,
      action: 'NONE',
      rootCauseAuthority: 'TASK_AGENT_RCA',
    },
    ci: {
      requiredWorkflows: {},
      security: { present: false, status: 'MISSING' },
      certification: { present: false, status: 'MISSING' },
    },
    evidence: {
      exactSha: Boolean(executionSha),
      executionMatchesPr: Boolean(!openPr || openPr.headRefOid === executionSha),
      executionAheadOfMain: Number(compare.ahead_by ?? 0),
      executionBehindMain: Number(compare.behind_by ?? 0),
    },
  };

  if (!executionSha || !mainSha) {
    report.errors.push({ type: 'EVIDENCE_MISSING', message: 'execution or main SHA unavailable' });
    return report;
  }

  if (openPr && openPr.headRefOid !== executionSha) {
    report.errors.push({ type: 'STALE_HEAD', message: 'open PR head does not match execution SHA' });
  }

  if (openPr && Number(compare.behind_by ?? 0) > 0) {
    report.errors.push({
      type: 'MAIN_DIVERGENCE',
      message: `execution is behind canonical main by ${compare.behind_by}`,
    });
  }

  if (!openPr && latestMergedPr) {
    const mergeSha = latestMergedPr.mergeCommit?.oid ?? null;
    if (latestMergedPr.headRefOid !== executionSha || mergeSha !== mainSha) {
      report.errors.push({
        type: 'POST_MERGE_MAIN_IDENTITY_MISMATCH',
        expectedHead: latestMergedPr.headRefOid,
        currentExecution: executionSha,
        expectedMain: mergeSha,
        currentMain: mainSha,
      });
    }
  }

  for (const name of REQUIRED_WORKFLOWS) {
    const run = latestWorkflow(workflowRuns, name);
    const state = stateOf(run);
    report.ci.requiredWorkflows[name] = {
      runId: run?.databaseId ?? null,
      status: state,
      conclusion: run?.conclusion ?? null,
      headSha: run?.headSha ?? null,
    };

    if (!run) {
      report.errors.push({ type: 'REQUIRED_CHECK_MISSING', workflow: name });
      continue;
    }

    if (run.headSha && run.headSha !== executionSha) {
      report.errors.push({
        type: 'STALE_WORKFLOW_EVIDENCE',
        workflow: name,
        runHeadSha: run.headSha,
      });
    }

    if (run.status !== 'completed') {
      report.errors.push({ type: 'REQUIRED_CHECK_PENDING', workflow: name, status: run.status });
    } else if (run.conclusion === 'action_required') {
      report.errors.push({ type: 'REQUIRED_CHECK_ACTION_REQUIRED', workflow: name, runId: run.databaseId, action: 'EXTERNAL_REVIEW_OR_APPROVAL_REQUIRED' });
    } else if (run.conclusion === 'cancelled') {
      const cancelled = classifyCancelledRun(run, workflowRuns);
      if (cancelled?.state === 'CANCELLED_SUPERSEDED') {
        report.ci.requiredWorkflows[name].status = 'CANCELLED_SUPERSEDED';
        report.ci.requiredWorkflows[name].successorRunId = cancelled.successorRunId;
      } else {
        report.errors.push({ type: 'CANCELLED_UNSUPERSEDED', workflow: name, runId: run.databaseId });
      }
    } else if (run.conclusion !== 'success') {
      const failureLog = logs[String(run.databaseId)] ?? '';
      const target = validateRepairTarget({ run, executionSha, workflowRuns, logs });
      if (!target.valid) {
        const evidenceOnly = target.errors.every((type) => type === 'EVIDENCE_CAPTURE_FAILED');
        if (!evidenceOnly) report.errors.push(...target.errors.map((type) => ({ type, workflow: name, runId: run.databaseId })));
        if (target.errors.includes('EVIDENCE_CAPTURE_FAILED')) {
          report.errors.push({ type: 'EVIDENCE_CAPTURE_FAILED', workflow: name, runId: run.databaseId });
        }
      } else if (providerFailure(failureLog)) {
        report.externalBlockers.push({
          kind: 'BLOCKED_EXTERNAL',
          workflow: name,
          state: run.conclusion,
          rootCause: 'EXTERNAL_PROVIDER_FAILURE',
          fingerprint: fingerprintFailure(failureLog),
        });
      } else {
        report.errors.push({
          type: 'REQUIRED_CHECK_RED',
          workflow: name,
          conclusion: run.conclusion,
          runId: run.databaseId,
        });

        if (!report.repair.required) {
          const failureFingerprint = fingerprintFailure(failureLog);
          report.repair = {
            required: true,
            targetRunId: run.databaseId,
            failureFingerprint,
            repairKey: executionSha + ':' + failureFingerprint,
            action: 'PENDING_DISPATCH',
            rootCauseAuthority: 'TASK_AGENT_RCA',
          };
        }
      }
    }
  }

  const securityCheck = latestCheck(checkRuns, SECURITY_CHECK_PATTERNS);
  report.ci.security = {
    present: Boolean(securityCheck),
    status: stateOf(securityCheck),
    conclusion: securityCheck?.conclusion ?? null,
    name: securityCheck?.name ?? null,
  };

  if (!securityCheck) {
    report.errors.push({ type: 'SECURITY_EVIDENCE_MISSING' });
  } else if (securityCheck.status !== 'completed') {
    report.errors.push({
      type: 'SECURITY_CHECK_PENDING',
      checkName: securityCheck.name,
      status: securityCheck.status,
    });
  } else if (securityCheck.conclusion === 'action_required') {
    report.errors.push({
      type: 'SECURITY_CHECK_ACTION_REQUIRED',
      checkName: securityCheck.name,
      action: 'EXTERNAL_REVIEW_OR_APPROVAL_REQUIRED',
    });
  } else if (securityCheck.conclusion !== 'success') {
    const external = securityProviderBlock(securityCheck, logForCheck(securityCheck, logs));
    if (external) {
      report.externalBlockers.push(external);
    } else {
      report.errors.push({
        type: 'SECURITY_CHECK_RED',
        checkName: securityCheck.name,
        conclusion: securityCheck.conclusion,
      });
      if (!report.repair.required && securityCheck.details_url) {
        const match = String(securityCheck.details_url).match(/\/actions\/runs\/(\d+)/);
        report.repair = {
          required: true,
          targetRunId: match ? Number(match[1]) : null,
          action: 'PENDING_DISPATCH',
          rootCauseAuthority: 'TASK_AGENT_RCA',
        };
      }
    }
  }

  const certificationCheck = latestCheck(checkRuns, CERTIFICATION_CHECK_PATTERNS);
  report.ci.certification = {
    present: Boolean(certificationCheck),
    status: stateOf(certificationCheck),
    conclusion: certificationCheck?.conclusion ?? null,
    name: certificationCheck?.name ?? null,
  };

  if (!certificationCheck) {
    report.errors.push({ type: 'CERTIFICATION_EVIDENCE_MISSING' });
  } else if (!(certificationCheck.status === 'completed' && certificationCheck.conclusion === 'success')) {
    report.errors.push({
      type: 'CERTIFICATION_RED_OR_PENDING',
      conclusion: certificationCheck.conclusion ?? certificationCheck.status,
    });
  }

  for (const check of checkRuns) {
    const name = String(check.name ?? '');
    if (/flixo auto repair merge gate|^gate$/i.test(name)) continue;
    if (SECURITY_CHECK_PATTERNS.some((pattern) => pattern.test(name))) continue;
    if (CERTIFICATION_CHECK_PATTERNS.some((pattern) => pattern.test(name))) continue;
    if (check.status === 'completed' && check.conclusion === 'success') continue;

    const external = externalCheckBlock(check, logs[String(check.id)] ?? '');
    if (external) {
      if (!report.externalBlockers.some((item) => item.checkName === external.checkName)) {
        report.externalBlockers.push(external);
      }
      continue;
    }

    if (check.status === 'completed' && ['failure', 'timed_out', 'cancelled', 'action_required'].includes(check.conclusion)) {
      report.errors.push({ type: 'UNEXPECTED_CHECK_RED', checkName: name, conclusion: check.conclusion });
    }
  }

  for (const status of statuses) {
    const context = String(status.context ?? '');
    if (/^vercel(?: deployment)?$/i.test(context) && status.state !== 'success') {
      const key = context.toLowerCase();
      if (!report.externalBlockers.some((item) => String(item.checkName ?? '').toLowerCase() === key)) {
        report.externalBlockers.push({
          kind: 'BLOCKED_EXTERNAL',
          checkName: context,
          state: status.state ?? 'unknown',
          rootCause: 'EXTERNAL_DEPLOYMENT_PROVIDER_UNRESOLVED',
        });
      }
      continue;
    }
    if (status.state && !['success', 'pending'].includes(status.state)) {
      report.errors.push({ type: 'UNEXPECTED_COMMIT_STATUS_RED', context, state: status.state });
    }
  }

  const hardInternalFailure = report.errors.some((error) => [
    'REQUIRED_CHECK_RED',
    'SECURITY_CHECK_RED',
    'UNEXPECTED_CHECK_RED',
    'UNEXPECTED_COMMIT_STATUS_RED',
    'STALE_HEAD',
    'STALE_WORKFLOW_EVIDENCE',
    'MAIN_DIVERGENCE',
    'POST_MERGE_MAIN_IDENTITY_MISMATCH',
    'CANCELLED_UNSUPERSEDED',
  ].includes(error.type));

  const actionRequired = report.errors.some((error) => error.type === 'REQUIRED_CHECK_ACTION_REQUIRED');

  const evidenceFailure = report.errors.some((error) => [
    'EVIDENCE_MISSING',
    'REQUIRED_CHECK_MISSING',
    'SECURITY_EVIDENCE_MISSING',
    'CERTIFICATION_EVIDENCE_MISSING',
    'EVIDENCE_CAPTURE_FAILED',
  ].includes(error.type));

  const pending = report.errors.some((error) => [
    'REQUIRED_CHECK_PENDING',
    'CERTIFICATION_RED_OR_PENDING',
  ].includes(error.type));

  if (hardInternalFailure) {
    report.status = 'RED_INTERNAL';
    report.rootCause = report.repair.required
      ? 'PENDING_TASK_AGENT_RCA'
      : 'REQUIRED_CHECK_FAILURE_REQUIRES_REPAIR_CYCLE';
  } else if (evidenceFailure) {
    report.status = 'FAIL_CLOSED';
    report.rootCause = 'REQUIRED_EVIDENCE_MISSING';
  } else if (actionRequired) {
    report.status = 'FAIL_CLOSED';
    report.rootCause = 'EXTERNAL_REVIEW_OR_APPROVAL_REQUIRED';
  } else if (report.externalBlockers.length > 0) {
    report.status = 'BLOCKED_EXTERNAL';
    report.rootCause = report.externalBlockers.map((item) => item.rootCause).join('; ');
  } else if (pending) {
    report.status = 'WAITING_REQUIRED_CHECKS';
    report.rootCause = 'REQUIRED_EVIDENCE_NOT_GREEN_YET';
  } else {
    report.status = 'GREEN';
    report.rootCause = 'NONE';
  }

  return report;
}

if (path.basename(process.argv[1] ?? '') === 'continuous-error-watch.mjs') {
  const input = process.argv[2] ?? '/tmp/flixo-watch/input.json';
  const output = process.argv[3] ?? '/tmp/flixo-watch/report.json';
  const inputData = JSON.parse(fs.readFileSync(input, 'utf8'));
  const report = evaluateGreen(inputData);
  fs.mkdirSync(output.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    status: report.status,
    executionSha: report.executionSha,
    errors: report.errors.length,
    externalBlockers: report.externalBlockers.length,
    repairTargetRunId: report.repair.targetRunId,
  }, null, 2));
  process.exit(report.status === 'GREEN' ? 0 : 1);
}
