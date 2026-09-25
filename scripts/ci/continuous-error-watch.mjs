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
  'FLIXO Security Red-Team Triad (Isolated)',
  'Repository Security Baseline',
  'Claude Security Review',
]);

export const REQUIRED_WORKFLOWS_BY_BRANCH = Object.freeze({
  execution: REQUIRED_WORKFLOWS,
  main: Object.freeze([
    'FLIXO Test System',
  ]),
});

const REQUIRED_WORKFLOW_PATHS = Object.freeze({
  'FLIXO Test System': '.github/workflows/ci.yml',
  'FLIXO WP0 Trust Baseline': '.github/workflows/wp0-trust-baseline.yml',
  'FLIXO Test Impact': '.github/workflows/test-impact.yml',
  'FLIXO Test Impact Execution': '.github/workflows/test-impact-execution.yml',
  'Repository Security Baseline': '.github/workflows/repository-security-baseline.yml',
  'Claude Security Review': '.github/workflows/claude-security-review.yml',
  'FLIXO Security Red-Team Triad (Isolated)': '.github/workflows/security-red-team.yml',
});

const requiredWorkflowsForBranch = (branch) =>
  REQUIRED_WORKFLOWS_BY_BRANCH[branch] ?? REQUIRED_WORKFLOWS_BY_BRANCH.execution;

// Any failed execution workflow may enter the repair lane.
// Only the repair/control-plane infrastructure itself is excluded to prevent self-repair loops.
const PROPOSAL_ONLY_WORKFLOW_PATHS = Object.freeze(new Set([
  '.github/workflows/execution-sync.yml',
  '.github/workflows/historical-action-error-index.yml',
]));

const isAuthoritativeWorkflowRun = (run) =>
  !PROPOSAL_ONLY_WORKFLOW_PATHS.has(String(run?.workflowPath ?? run?.path ?? '').trim());

const REPAIRABLE_WORKFLOW_PATHS = Object.freeze({
  'FLIXO Test System': '.github/workflows/ci.yml',
  'FLIXO WP0 Trust Baseline': '.github/workflows/wp0-trust-baseline.yml',
  'FLIXO Test Impact': '.github/workflows/test-impact.yml',
  'FLIXO Test Impact Execution': '.github/workflows/test-impact-execution.yml',
  'Repository Security Baseline': '.github/workflows/repository-security-baseline.yml',
  'Claude Security Review': '.github/workflows/claude-security-review.yml',
  'FLIXO Security Red-Team Triad (Isolated)': '.github/workflows/security-red-team.yml',
});

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
  /workflow trust baseline/i,
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

const latestWorkflow = (runs, name) => {
  const expectedPath = REQUIRED_WORKFLOW_PATHS[name] ?? null;
  const candidates = runs
    .filter((run) => run.workflowName === name && (!expectedPath || String(run.workflowPath ?? run.path ?? '') === expectedPath))
    .sort((a, b) => String(b.updatedAt ?? b.completed_at ?? b.started_at ?? '')
      .localeCompare(String(a.updatedAt ?? a.completed_at ?? a.started_at ?? '')));
  for (const candidate of candidates) {
    const cancellation = classifyCancelledRun(candidate, runs);
    if (cancellation?.state === 'CANCELLED_SUPERSEDED') continue;
    return candidate;
  }
  return null;
};
const latestCheck = (checks, patterns) => latestBy(checks, (check) => patterns.some((pattern) => pattern.test(String(check.name ?? ''))));
const stateOf = (item) => !item ? 'MISSING' : item.status === 'completed' ? (item.conclusion ?? 'unknown') : (item.status ?? 'unknown');

export const classifyAutomationOutcome = (item) => {
  // Terminal automation has exactly two outcomes for bots/certification:
  // GREEN only on explicit success; every other outcome is RED.
  // Lifecycle details remain available through stateOf() and are never terminal outcomes.
  return stateOf(item) === 'success' ? 'GREEN' : 'RED';
};
const exactShaOfCheck = (check) => {
  if (!check) return null;
  const value = check.headSha ?? check.head_sha ?? null;
  return typeof value === 'string' && /^[0-9a-f]{40}$/iu.test(value) ? value : null;
};
const actionRunIdOfCheck = (check) => {
  const detailsUrl = String(check?.details_url ?? '');
  const match = detailsUrl.match(/\/actions\/runs\/(\d+)(?:\/job\/\d+)?(?:[/?#]|$)/u);
  return match?.[1] ?? null;
};
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
  const repairableRedConclusions = new Set(['failure', 'timed_out', 'skipped', 'neutral']);
  if (!run || run.status !== 'completed' || !repairableRedConclusions.has(run.conclusion)) {
    errors.push('TARGET_NOT_FAILED_COMPLETED');
  }
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
  const workflowPath = String(run?.path ?? run?.workflowPath ?? '').trim();
  const expectedWorkflowPath = REPAIRABLE_WORKFLOW_PATHS[workflowName] ?? null;
  if (!expectedWorkflowPath) {
    errors.push('TARGET_WORKFLOW_NOT_ALLOWED');
  } else if (!workflowPath) {
    errors.push('TARGET_WORKFLOW_PATH_MISSING');
  } else if (workflowPath !== expectedWorkflowPath) {
    errors.push('TARGET_WORKFLOW_PATH_MISMATCH');
  }
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
  if (state === 'success') return null;
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

  // After a canonical merge, execution may legitimately lag main until the next execution cycle.
  // Treat divergence as actionable only while an execution→main PR is open.
  if (observedBranch === 'execution' && openPr && Number(compare.behind_by ?? 0) > 0) {
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

  // Security is an aggregate surface, not a single "latest" check.
  // A successful CodeQL check must never hide a failing GHAS/provider check.
  const securityChecks = latestChecks.filter((check) =>
    SECURITY_CHECK_PATTERNS.some((pattern) => pattern.test(String(check.name ?? '')))
  );
  const securityCheck = [...securityChecks]
    .sort((a, b) => String(b.updated_at ?? b.updatedAt ?? b.completed_at ?? b.started_at ?? '')
      .localeCompare(String(a.updated_at ?? a.updatedAt ?? a.completed_at ?? a.started_at ?? '')))[0] ?? null;
  const aggregateSecurityStatus = !securityChecks.length
    ? 'MISSING'
    : securityChecks.some((check) => ['failure', 'timed_out', 'cancelled', 'skipped', 'neutral', 'action_required'].includes(stateOf(check)))
      ? 'failure'
      : securityChecks.some((check) => ['queued', 'in_progress', 'pending'].includes(stateOf(check)))
        ? 'in_progress'
        : 'success';

  report.ci.security = {
    present: Boolean(securityChecks.length),
    status: aggregateSecurityStatus,
    name: securityCheck?.name ?? null,
    checkId: securityCheck?.id ?? null,
    checks: securityChecks.map((check) => ({
      name: check.name ?? null,
      status: stateOf(check),
      checkId: check.id ?? null,
    })),
  };
  if (!securityChecks.length) report.errors.push({ type: 'SECURITY_EVIDENCE_MISSING' });

  const certificationCheck = latestCheck(checkRuns, CERTIFICATION_CHECK_PATTERNS);
  const certificationStatus = stateOf(certificationCheck);
  const certificationHeadSha = exactShaOfCheck(certificationCheck);
  const certificationRunId = actionRunIdOfCheck(certificationCheck);
  const canonicalTestRunId = report.ci.requiredWorkflows['FLIXO Test System']?.runId != null
    ? String(report.ci.requiredWorkflows['FLIXO Test System'].runId)
    : null;
  report.ci.certification = {
    present: Boolean(certificationCheck),
    status: certificationStatus,
    name: certificationCheck?.name ?? null,
    checkId: certificationCheck?.id ?? null,
    headSha: certificationHeadSha,
    exactSha: certificationHeadSha === executionSha,
    runId: certificationRunId,
    canonicalRunId: canonicalTestRunId,
    canonicalRun: certificationRunId !== null && canonicalTestRunId !== null && certificationRunId === canonicalTestRunId,
  };
  if (!certificationCheck) {
    report.errors.push({ type: 'CERTIFICATION_EVIDENCE_MISSING' });
  } else if (certificationStatus !== 'success') {
    report.errors.push({
      type: 'CERTIFICATION_CHECK_RED',
      status: certificationStatus,
      checkId: certificationCheck.id ?? null,
    });
  } else if (!certificationHeadSha) {
    report.errors.push({
      type: 'CERTIFICATION_SHA_MISSING',
      checkId: certificationCheck.id ?? null,
    });
  } else if (certificationHeadSha !== executionSha) {
    report.errors.push({
      type: 'STALE_CERTIFICATION_EVIDENCE',
      checkId: certificationCheck.id ?? null,
      certificationSha: certificationHeadSha,
      executionSha,
    });
  } else if (!certificationRunId) {
    report.errors.push({
      type: 'CERTIFICATION_RUN_ID_MISSING',
      checkId: certificationCheck.id ?? null,
    });
  } else if (!canonicalTestRunId) {
    report.errors.push({
      type: 'CANONICAL_TEST_RUN_ID_MISSING',
      checkId: certificationCheck.id ?? null,
    });
  } else if (certificationRunId !== canonicalTestRunId) {
    report.errors.push({
      type: 'NONCANONICAL_CERTIFICATION_RUN',
      checkId: certificationCheck.id ?? null,
      certificationRunId,
      canonicalTestRunId,
    });
  }

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
  if (externalCandidates.some((item) => ['failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'queued', 'in_progress'].includes(item.state))) {
    report.rootCause = 'EXTERNAL_CHECK_BLOCKED';
  }

  for (const check of securityChecks) {
    const securityBlock = securityProviderBlock(check, logForCheck(check, logs));
    if (securityBlock) {
      report.externalBlockers.push(securityBlock);
    } else if (stateOf(check) !== 'success') {
      report.errors.push({
        type: 'SECURITY_EVIDENCE_MISSING',
        checkName: check.name ?? null,
        status: stateOf(check),
      });
    }
  }

  if (observedBranch === 'execution' && !report.repair.required) {
    const failedCandidates = workflowRuns
      .filter((candidate) =>
        candidate?.headSha === executionSha &&
        candidate?.headBranch === 'execution' &&
        candidate?.status === 'completed' &&
        isAuthoritativeWorkflowRun(candidate) &&
        ['failure', 'timed_out', 'skipped', 'neutral'].includes(candidate?.conclusion)
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
      if (!target.valid) {
        if (providerFailure(failureLog)) {
          report.externalBlockers.push({
            kind: 'BLOCKED_EXTERNAL',
            checkName: String(candidate.workflowName ?? '').trim(),
            state: candidate.conclusion,
            rootCause: 'EXTERNAL_PROVIDER_FAILURE',
          });
        } else if (target.errors.includes('TARGET_WORKFLOW_NOT_ALLOWED') || target.errors.includes('TARGET_WORKFLOW_PATH_MISMATCH')) {
          report.errors.push({
            type: 'UNAPPROVED_WORKFLOW_RED',
            workflow: candidate.workflowName,
            runId: candidate.databaseId,
            conclusion: candidate.conclusion,
          });
          report.rootCause = report.rootCause ?? 'UNAPPROVED_WORKFLOW_FAILURE_REQUIRES_CHAIR_REVIEW';
        }
        continue;
      }
      if (providerFailure(failureLog)) continue;

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
    const blocker = report.externalBlockers.find((item) => ['failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'queued', 'in_progress'].includes(item.state));
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
    ['failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'queued', 'in_progress'].includes(item.state)
  );

  // Repository-wide binary outcome guard:
  // any completed skipped/neutral run on the exact execution SHA is RED,
  // even when that workflow is not part of the canonical required set.
  const nonBinaryRuns = workflowRuns.filter((item) =>
    item?.headSha === executionSha &&
    item?.status === 'completed' &&
    isAuthoritativeWorkflowRun(item) &&
    ['skipped', 'neutral'].includes(item?.conclusion),
  );
  for (const item of nonBinaryRuns) {
    report.errors.push({
      type: 'NON_BINARY_AUTOMATION_OUTCOME',
      workflow: item.workflowName ?? item.name ?? 'unknown',
      runId: item.databaseId ?? null,
      status: item.conclusion,
      headSha: item.headSha ?? null,
    });
  }

  const skippedRequiredWorkflows = Object.entries(report.ci.requiredWorkflows)
    .filter(([, item]) => item.status === 'skipped' || item.status === 'neutral');
  if (skippedRequiredWorkflows.length) {
    for (const [workflow, item] of skippedRequiredWorkflows) {
      report.errors.push({ type: 'SKIPPED_CHECK_RED', workflow, runId: item.runId ?? null, status: item.status });
    }
    report.status = 'RED_INTERNAL';
    report.rootCause = 'SKIPPED_REQUIRED_CHECK_REQUIRES_REPAIR_CYCLE';
    report.repair.required = false;
  }

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
    'UNAPPROVED_WORKFLOW_RED',
    'SKIPPED_CHECK_RED',
    'NON_BINARY_AUTOMATION_OUTCOME',
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
    ['failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'queued', 'in_progress'].includes(item.state)
  )) {
    report.status = report.externalBlockers.some((item) => item.kind === 'BLOCKED_EXTERNAL')
      ? 'BLOCKED_EXTERNAL'
      : 'FAIL_CLOSED';
  } else {
    report.status = 'GREEN';
    report.rootCause = null;
  }

  report.automationOutcome = report.status === 'GREEN' ? 'GREEN' : 'RED';
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