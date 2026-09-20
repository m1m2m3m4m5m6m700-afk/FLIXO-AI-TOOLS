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
  /daily·flixo green gate/i,
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
  const workflowName = String(run?.workflowName ?? '');
  if (NON_REPAIRABLE_WORKFLOW_PATTERNS.some((pattern) => pattern.test(workflowName))) {
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
  observedBranch = 'execution',
  openPr = null,
  latestMergedPr = null,
  workflowRuns = [],
  checkRuns = [],
  logs = {},
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

  if (observedBranch === 'execution' && openPr && Number(compare.behind_by ?? 0) > 0) {
    report.errors.push({
      type: 'MAIN_DIVERGENCE',
      message: `execution is behind canonical main by ${compare.behind_by}`,
    });
  }

  if (observedBranch === 'execution' && !openPr && latestMergedPr) {
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
    } else if (status !== 'success') {
      report.errors.push({
        type: 'REQUIRED_WORKFLOW_RED',
        workflow: workflowName,
        status,
        runId: run?.databaseId ?? null,
        headSha: run?.headSha ?? null,
        headBranch: run?.headBranch ?? null,
      });
      if (run?.databaseId != null && ['failure', 'timed_out', 'cancelled'].includes(status)) {
        const evidence = String(logs[String(run.databaseId)] ?? '').trim();
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

  const externalCandidates = checkRuns.map((check) => externalCheckBlock(check, logForCheck(check, logs))).filter(Boolean);
  report.externalBlockers = externalCandidates;
  if (externalCandidates.some((item) => ['failure', 'action_required', 'cancelled', 'timed_out', 'queued', 'in_progress'].includes(item.state))) {
    report.rootCause = 'EXTERNAL_CHECK_BLOCKED';
  }
  const securityBlock = securityProviderBlock(securityCheck, logForCheck(securityCheck, logs));
  if (securityBlock) report.externalBlockers.push(securityBlock);

  const internalCancelledWithEvidence = report.errors.some((item) => {
    if (item.type !== 'REQUIRED_WORKFLOW_RED' || item.status !== 'cancelled') return false;
    const run = workflowRuns.find((candidate) => candidate?.databaseId === item.runId);
    if (!run || run.headSha !== executionSha || run.headBranch !== observedBranch) return false;
    const cancellation = classifyCancelledRun(run, workflowRuns);
    const evidence = String(logs[String(run.databaseId)] ?? '').trim();
    return cancellation?.state === 'CANCELLED_UNSUPERSEDED' &&
      Boolean(evidence) &&
      !/EVIDENCE_CAPTURE=FAILED/i.test(evidence);
  });

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
    const blocker = report.externalBlockers.find((item) => ['failure', 'action_required', 'cancelled', 'timed_out', 'queued', 'in_progress'].includes(item.state));
    if (blocker) {
      report.status = blocker.kind === 'BLOCKED_EXTERNAL' ? 'BLOCKED_EXTERNAL' : 'FAIL_CLOSED';
      report.rootCause = blocker.rootCause;
      report.repair.required = false;
    }
  }

  if (report.repair.required) {
    report.status = 'RED_INTERNAL';
    report.rootCause = report.errors.find((item) => item.type === 'UNEXPECTED_WORKFLOW_RED')?.workflow ?? 'INTERNAL_WORKFLOW_FAILURE';
  } else if (report.errors.length) {
    report.status = report.rootCause
      ? 'BLOCKED_EXTERNAL'
      : internalCancelledWithEvidence
        ? 'RED_INTERNAL'
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
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const report = evaluateGreen(input);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (path.basename(process.argv[1] ?? '') === 'continuous-error-watch.mjs') main();
