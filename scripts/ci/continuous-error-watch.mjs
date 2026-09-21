#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fingerprintFailure } from './auto-repair/fingerprint.mjs';
import { deriveRepairIdentity } from './repair-control-plane.mjs';

export const REQUIRED_WORKFLOWS = Object.freeze([
  'FLIXO Test System',
  'FLIXO WP0 Trust Baseline',
  'FLIXO Test Impact',
  'FLIXO Test Impact Execution',
  'Repository Security Baseline',
  'Claude Security Review',
]);

export const REQUIRED_WORKFLOWS_BY_BRANCH = Object.freeze({
  execution: REQUIRED_WORKFLOWS,
  main: Object.freeze([
    'FLIXO Test System',
  ]),
});

const requiredWorkflowsForBranch = (branch) =>
  REQUIRED_WORKFLOWS_BY_BRANCH[branch] ?? REQUIRED_WORKFLOWS_BY_BRANCH.execution;

// Any failed execution workflow may enter the repair lane.
// Only the repair/control-plane infrastructure itself is excluded to prevent self-repair loops.
const NON_REPAIRABLE_WORKFLOW_PATTERNS = Object.freeze([
  /auto repair/i,
  /daily flixo green gate/i,
  /execution bot watchdog/i,
  /agent-repair-supervisor/i,
  /agent-repair-heartbeat/i,
  /auto-repair-merge-gate/i,
]);

const SECURITY_CHECK_PATTERNS = Object.freeze([
  /github-advanced-security/i,
  /github advanced security/i,
  /codeql/i,
  /code scanning ai findings/i,
  /^Analyze \(javascript-typescript\)$/i,
  /^Analyze \(actions\)$/i,
]);

const CERTIFICATION_CHECK_PATTERNS = Object.freeze([
  /^certification$/i,
  /(^|\/)certification$/i,
]);

const EXTERNAL_CHECK_PATTERNS = Object.freeze([
  /^vercel$/i,
  /^vercel deployment$/i,
  /cloudflare.*deploy/i,
  /deploy.*cloudflare/i,
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
  if (!run || run.status !== 'completed' || !['failure', 'timed_out'].includes(run.conclusion)) errors.push('TARGET_NOT_FAILED_COMPLETED');
  if (run?.conclusion === 'cancelled') errors.push('TARGET_CANCELLED_NOT_SOURCE_FAILURE');
  if (run?.headSha !== executionSha) errors.push('TARGET_SHA_MISMATCH');
  if ((run?.headBranch ?? null) !== branch) errors.push('TARGET_BRANCH_MISMATCH');
  const workflowName = [run?.workflowName, run?.name, run?.displayTitle]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' | ');
  const normalizedWorkflowIdentity = workflowName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
  if (NON_REPAIRABLE_WORKFLOW_PATTERNS.some((pattern) => pattern.test(normalizedWorkflowIdentity))) {
    errors.push('TARGET_WORKFLOW_NOT_ALLOWED');
  }
  if (/auto repair/i.test(workflowName)) errors.push('TARGET_SELF_REPAIR');
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

const isExternalCheckName = (name) => {
  const normalized = String(name ?? '').trim();
  return EXTERNAL_CHECK_PATTERNS.some((pattern) => pattern.test(normalized));
};

function externalCheckBlock(check, log) {
  if (!check || !isExternalCheckName(check.name)) return null;
  const state = stateOf(check);
  if (state === 'skipped' || state === 'neutral') return null;
  return {
    kind: 'BLOCKED_EXTERNAL',
    checkName: String(check.name ?? '').trim(),
    state,
    rootCause: state === 'action_required'
      ? 'EXTERNAL_REVIEW_OR_APPROVAL_REQUIRED'
      : providerFailure(log)
        ? 'PROVIDER_RATE_LIMIT_OR_DEPLOYMENT_SERVICE_FAILURE'
        : 'EXTERNAL_PROVIDER_UNRESOLVED',
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
  observedBranch = 'execution',
  openPr = null,
  latestMergedPr = null,
  workflowRuns = [],
  checkRuns = [],
  logs = {},
  statuses = [],
  compare = {},
} = {}) {
  const report = {
    schemaVersion: 1,
    protocol: 'FLIXO-CONTINUOUS-ERROR-WATCH-v1',
    generatedAt: new Date().toISOString(),
    executionSha,
    mainSha,
    branch: observedBranch,
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
      claimKey: null,
      repairChainId: null,
      leaseRef: null,
      failedSha: null,
      branch: null,
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

  if (observedBranch === 'execution' && openPr && openPr.headRefOid !== executionSha) {
    report.errors.push({ type: 'STALE_HEAD', message: 'open PR head does not match execution SHA' });
  }

  if (observedBranch === 'execution' && Number(compare.behind_by ?? 0) > 0) {
    report.errors.push({
      type: 'MAIN_DIVERGENCE',
      message: `execution is behind canonical main by ${compare.behind_by}`,
    });
  }

  // Execution may legitimately advance after a merge. A historical merged PR's
  // head SHA must not be treated as the required current execution SHA.
  // On execution, current-vs-main ancestry is already enforced by MAIN_DIVERGENCE.
  // Post-merge identity validation belongs to main-observation certification, not
  // to a newer execution head that has no open PR yet.

  let waitingRequiredChecks = false;
  let externalApprovalRequired = false;
  let internalMainFailure = false;
  const requiredWorkflows = requiredWorkflowsForBranch(observedBranch);
  for (const workflowName of requiredWorkflows) {
    const run = latestWorkflow(workflowRuns, workflowName);
    const status = stateOf(run);
    report.ci.requiredWorkflows[workflowName] = {
      status,
      runId: run?.databaseId ?? null,
      headSha: run?.headSha ?? null,
      headBranch: run?.headBranch ?? null,
    };
    if (status === 'MISSING') {
      report.errors.push({ type: 'REQUIRED_WORKFLOW_MISSING', workflow: workflowName });
      if (observedBranch === 'execution') waitingRequiredChecks = true;
    } else if (status !== 'success') {
      report.errors.push({
        type: 'REQUIRED_WORKFLOW_RED',
        workflow: workflowName,
        status,
        runId: run?.databaseId ?? null,
        headSha: run?.headSha ?? null,
        headBranch: run?.headBranch ?? null,
      });
      if (['queued', 'in_progress', 'pending'].includes(status)) {
        waitingRequiredChecks = true;
      }
      const evidence = String(logs[String(run?.databaseId ?? '')] ?? '').trim();
      if (status === 'action_required') {
        externalApprovalRequired = true;
        report.rootCause = 'EXTERNAL_REVIEW_OR_APPROVAL_REQUIRED';
      } else if (evidence && providerFailure(evidence)) {
        report.rootCause = 'PROVIDER_RATE_LIMIT_OR_DEPLOYMENT_SERVICE_FAILURE';
      } else if (observedBranch === 'main' && ['failure', 'timed_out'].includes(status) && evidence && !/EVIDENCE_CAPTURE=FAILED/i.test(evidence)) {
        internalMainFailure = true;
        report.rootCause = workflowName;
      }
      if (run?.databaseId != null && ['failure', 'timed_out', 'cancelled'].includes(status)) {
        if (!evidence || /EVIDENCE_CAPTURE=FAILED/i.test(evidence)) {
          report.errors.push({
            type: 'EVIDENCE_CAPTURE_FAILED',
            workflow: workflowName,
            runId: run.databaseId,
          });
        }
      }
    } else if (run.headSha !== executionSha && observedBranch === 'execution') {
      report.errors.push({ type: 'STALE_WORKFLOW_EVIDENCE', workflow: workflowName, runId: run.databaseId });
    }
  }

  const securityCheck = latestCheck(checkRuns, SECURITY_CHECK_PATTERNS);
  report.ci.security = {
    present: Boolean(securityCheck),
    status: stateOf(securityCheck),
    name: securityCheck?.name ?? null,
    checkId: securityCheck?.id ?? null,
  };
  if (!securityCheck) report.errors.push({ type: 'SECURITY_EVIDENCE_MISSING' });
  const certificationCheck = latestCheck(checkRuns, CERTIFICATION_CHECK_PATTERNS);
  report.ci.certification = {
    present: Boolean(certificationCheck),
    status: stateOf(certificationCheck),
    name: certificationCheck?.name ?? null,
    checkId: certificationCheck?.id ?? null,
  };
  if (!certificationCheck) report.errors.push({ type: 'CERTIFICATION_EVIDENCE_MISSING' });

  const latestChecksByName = new Map();
  for (const check of checkRuns) {
    const name = String(check.name ?? '');
    const current = latestChecksByName.get(name);
    const checkTime = String(check.updated_at ?? check.updatedAt ?? check.completed_at ?? check.started_at ?? '');
    const currentTime = String(current?.updated_at ?? current?.updatedAt ?? current?.completed_at ?? current?.started_at ?? '');
    if (!current || checkTime.localeCompare(currentTime) > 0) {
      latestChecksByName.set(name, check);
    }
  }
  const latestChecks = [...latestChecksByName.values()];
  const externalCandidates = latestChecks.map((check) => externalCheckBlock(check, logForCheck(check, logs))).filter(Boolean);
  const externalStatusCandidates = statuses
    .filter((status) => isExternalCheckName(status?.context))
    .map((status) => {
      const state = String(status?.state ?? '').toLowerCase();
      if (!['failure', 'error', 'pending'].includes(state)) return null;
      return {
        kind: 'BLOCKED_EXTERNAL',
        checkName: String(status?.context ?? '').trim(),
        state: state === 'error' ? 'failure' : state,
        rootCause: 'EXTERNAL_PROVIDER_UNRESOLVED',
      };
    })
    .filter(Boolean);
  report.externalBlockers = [...externalCandidates, ...externalStatusCandidates];
  if (externalCandidates.some((item) => ['failure', 'cancelled', 'timed_out', 'queued', 'in_progress'].includes(item.state))) {
    report.rootCause = 'EXTERNAL_CHECK_BLOCKED';
  }
  const securityBlock = securityProviderBlock(securityCheck, logForCheck(securityCheck, logs));
  if (securityBlock) report.externalBlockers.push(securityBlock);
  else if (securityCheck && stateOf(securityCheck) !== 'success') {
    report.errors.push({
      type: 'SECURITY_EVIDENCE_MISSING',
      checkName: securityCheck.name ?? null,
      status: stateOf(securityCheck),
    });
  }

  if (observedBranch === 'execution' && !report.repair.required) {
    const failedCandidates = workflowRuns
      .filter((candidate) =>
        candidate?.headSha === executionSha &&
        candidate?.headBranch === 'execution' &&
        candidate?.status === 'completed' &&
        ['failure', 'timed_out'].includes(candidate?.conclusion) &&
        !NON_REPAIRABLE_WORKFLOW_PATTERNS.some((pattern) => pattern.test(String(candidate?.workflowName ?? '')))
      )
      .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));

    for (const candidate of failedCandidates) {
      const failureLog = String(logs[String(candidate.databaseId)] ?? '');
      const target = validateRepairTarget({
        run: candidate,
        executionSha,
        workflowRuns,
        logs,
        branch: 'execution',
      });
      if (!target.valid || providerFailure(failureLog)) continue;

      const failureFingerprint = fingerprintFailure(failureLog);
      const identity = deriveRepairIdentity({
        branch: 'execution',
        failedSha: executionSha,
        failureFingerprint,
        targetRunId: candidate.databaseId,
      });
      report.errors.push({
        type: 'UNEXPECTED_WORKFLOW_RED',
        workflow: candidate.workflowName,
        conclusion: candidate.conclusion,
        runId: candidate.databaseId,
      });
      report.repair = {
        required: true,
        targetRunId: candidate.databaseId,
        failureFingerprint,
        repairKey: identity.claimKey,
        claimKey: identity.claimKey,
        repairChainId: identity.repairChainId,
        leaseRef: identity.leaseRef,
        failedSha: executionSha,
        branch: 'execution',
        action: 'PENDING_DISPATCH',
        rootCauseAuthority: 'TASK_AGENT_RCA',
      };
      break;
    }
  }

  if (report.externalBlockers.length) {
    const approvalBlocker = report.externalBlockers.find((item) => item.state === 'action_required');
    const blocker = report.externalBlockers.find((item) => ['failure', 'cancelled', 'timed_out', 'queued', 'in_progress'].includes(item.state));
    if (approvalBlocker) {
      report.status = 'FAIL_CLOSED';
      report.rootCause = approvalBlocker.rootCause;
      report.repair.required = false;
    } else if (blocker) {
      report.status = blocker.kind === 'BLOCKED_EXTERNAL' ? 'BLOCKED_EXTERNAL' : 'FAIL_CLOSED';
      report.rootCause = blocker.rootCause;
      report.repair.required = false;
    }
  }

  const activeExternalBlocker = report.externalBlockers.some((item) =>
    ['failure', 'cancelled', 'timed_out', 'queued', 'in_progress'].includes(item.state)
  );

  if (report.repair.required) {
    report.status = 'RED_INTERNAL';
    report.rootCause = report.errors.find((item) => item.type === 'UNEXPECTED_WORKFLOW_RED')?.workflow ?? 'INTERNAL_WORKFLOW_FAILURE';
  } else if (activeExternalBlocker) {
    // Preserve the external blocker decision already reduced above; never reclassify it as an internal repair.
  } else if (internalMainFailure) {
    report.status = 'RED_INTERNAL';
    report.rootCause = report.rootCause ?? 'INTERNAL_WORKFLOW_FAILURE';
  } else if (externalApprovalRequired) {
    report.status = 'FAIL_CLOSED';
    report.rootCause = report.rootCause ?? 'EXTERNAL_REVIEW_OR_APPROVAL_REQUIRED';
  } else if (waitingRequiredChecks && !report.rootCause) {
    report.status = 'WAITING_REQUIRED_CHECKS';
  } else if (report.errors.some((error) => [
    'STALE_HEAD',
    'STALE_WORKFLOW_EVIDENCE',
    'MAIN_DIVERGENCE',
    'POST_MERGE_MAIN_IDENTITY_MISMATCH',
    'REQUIRED_CHECK_RED',
    'SECURITY_CHECK_RED',
    'UNEXPECTED_CHECK_RED',
    'UNEXPECTED_COMMIT_STATUS_RED',
  ].includes(error.type))) {
    report.status = 'RED_INTERNAL';
    report.rootCause = 'REQUIRED_CHECK_FAILURE_REQUIRES_REPAIR_CYCLE';
  } else if (report.errors.length) {
    report.status = report.rootCause ? 'BLOCKED_EXTERNAL' : 'FAIL_CLOSED';
  } else if (report.externalBlockers.some((item) => item.state === 'action_required')) {
    report.status = 'FAIL_CLOSED';
    report.rootCause = report.externalBlockers.find((item) => item.state === 'action_required')?.rootCause
      ?? 'EXTERNAL_REVIEW_OR_APPROVAL_REQUIRED';
  } else if (report.externalBlockers.some((item) =>
    ['failure', 'cancelled', 'timed_out', 'queued', 'in_progress'].includes(item.state)
  )) {
    report.status = report.externalBlockers.some((item) => item.kind === 'BLOCKED_EXTERNAL')
      ? 'BLOCKED_EXTERNAL'
      : 'FAIL_CLOSED';
  } else {
    report.status = 'GREEN';
    report.rootCause = null;
  }

  return report;
}

export function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) throw new Error('Usage: continuous-error-watch.mjs <input.json> <output.json>');

  let report;
  try {
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    report = evaluateGreen(input);
  } catch (error) {
    report = {
      schemaVersion: 1,
      protocol: 'FLIXO-CONTINUOUS-ERROR-WATCH-v1',
      generatedAt: new Date().toISOString(),
      executionSha: null,
      mainSha: null,
      branch: null,
      pr: null,
      status: 'FAIL_CLOSED',
      rootCause: 'REQUIRED_EVIDENCE_MISSING',
      errors: [{
        type: 'WATCHER_INPUT_INVALID',
        message: error instanceof Error ? error.message : String(error),
      }],
      externalBlockers: [],
      repair: {
        required: false,
        targetRunId: null,
        failureFingerprint: null,
        repairKey: null,
        claimKey: null,
        repairChainId: null,
        leaseRef: null,
        failedSha: null,
        branch: null,
        action: 'NONE',
        rootCauseAuthority: 'TASK_AGENT_RCA',
      },
      ci: {
        requiredWorkflows: {},
        security: { present: false, status: 'MISSING' },
        certification: { present: false, status: 'MISSING' },
      },
      evidence: {
        exactSha: false,
        executionMatchesPr: false,
        executionAheadOfMain: 0,
        executionBehindMain: 0,
      },
    };
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  if (report.errors.some((error) => error.type === 'WATCHER_INPUT_INVALID')) process.exitCode = 1;
}

if (path.basename(process.argv[1] ?? '') === 'continuous-error-watch.mjs') main();
