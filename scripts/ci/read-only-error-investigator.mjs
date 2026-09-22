#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fingerprintFailure, normalizeFailure, extractFeatures } from './auto-repair/fingerprint.mjs';
import { buildDeepInference } from './read-only-deep-reasoning.mjs';
import { READ_ONLY_POWER_PROFILE, validateReadOnlyPowerProfile } from './read-only-power-profile.mjs';
import { buildSharedLearningContext, publishSharedMemory } from './shared-operational-memory.mjs';

const POWER_PROFILE_VALIDATION = validateReadOnlyPowerProfile();
if (!POWER_PROFILE_VALIDATION.ok) throw new Error('READ_ONLY_POWER_PROFILE_INVALID=' + POWER_PROFILE_VALIDATION.failures.join(','));

const ROOT = process.cwd();
const DEFAULT_OUTPUT = process.env.INVESTIGATION_DIR
  ? path.join(process.env.INVESTIGATION_DIR, 'error-intelligence-latest.json')
  : path.join(ROOT, 'diagnostics/investigation/error-intelligence-latest.json');

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith('--')) continue;
  const eq = token.indexOf('=');
  const key = token.slice(2, eq >= 0 ? eq : undefined);
  const value = eq >= 0 ? token.slice(eq + 1) : process.argv[i + 1];
  args.set(key, value ?? null);
}

const arg = (name, fallback = '') => String(args.get(name) ?? fallback).trim();
const exactSha = (value) => /^[a-f0-9]{40}$/u.test(String(value ?? ''));
const now = () => new Date().toISOString();
const sha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const hash = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};

const providerPatterns = [
  /CAPIError/i,
  /SessionModelError/i,
  /requested model is not supported/i,
  /rate limit/i,
  /quota/i,
  /api-deployments-free-per-day/i,
  /deployment provider/i,
  /provider.*(?:400|401|403|429|500|503)/i,
];

const downstreamPatterns = [
  /auto repair merge gate/i,
  /execution bot watchdog/i,
  /daily.?flixo.?green.?gate/i,
  /merge gate/i,
];

const securityPatterns = [
  /code scanning/i,
  /github advanced security/i,
  /codeql/i,
  /security baseline/i,
  /security review/i,
  /dependabot/i,
];

const contractPatterns = [
  /CI contract failed/i,
  /validate-ci-contract/i,
  /contract drift/i,
  /contract mismatch/i,
];

const salientErrorPattern = /(?:CAPIError|SessionModelError|ERROR|Error:|FAIL(?:ED|URE)?|FATAL|exception|assert(?:ion)? failed|CI contract failed|TypeError|ReferenceError|SyntaxError|TS\d+|ENOENT|ECONNRESET|ETIMEDOUT|HTTP\s*\d{3})[^\n]*/giu;

function cancellationClass(run, runs) {
  if (run?.status !== 'completed' || run?.conclusion !== 'cancelled') return null;
  const successor = runs.find((candidate) =>
    candidate !== run &&
    candidate.workflowName === run.workflowName &&
    candidate.headSha === run.headSha &&
    String(candidate.updatedAt ?? '').localeCompare(String(run.updatedAt ?? '')) > 0 &&
    candidate.conclusion !== 'cancelled'
  );
  return successor
    ? { state: 'CANCELLED_SUPERSEDED', successorRunId: successor.databaseId ?? null }
    : { state: 'CANCELLED_UNSUPERSEDED', successorRunId: null };
}

function providerFailure(log) {
  return providerPatterns.some((pattern) => pattern.test(String(log ?? '')));
}

function securitySignal(run, log) {
  return securityPatterns.some((pattern) => pattern.test(String(run?.workflowName ?? ''))) ||
    securityPatterns.some((pattern) => pattern.test(String(log ?? '')));
}

function normalizeSecurityAlerts(alerts) {
  return (Array.isArray(alerts) ? alerts : []).map((alert) => ({
    number: alert.number ?? null,
    state: alert.state ?? null,
    rule: alert.rule?.id ?? alert.rule?.description ?? null,
    severity: alert.rule?.security_severity_level ?? alert.rule?.severity ?? null,
    tool: alert.tool?.name ?? null,
    htmlUrl: alert.html_url ?? alert.url ?? null,
    path: alert.most_recent_instance?.location?.path ?? alert.most_recent_instance?.location?.file ?? null,
    startLine: alert.most_recent_instance?.location?.start_line ?? null,
    message: alert.most_recent_instance?.message?.text ?? null,
  }));
}

function normalizeWorkflowName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
}

function salientLines(log) {
  return [...String(log ?? '').matchAll(salientErrorPattern)]
    .map((match) => match[0].replace(/\s+/gu, ' ').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function recurringSignature(log) {
  const lines = salientLines(log);
  const stable = lines
    .map((line) => normalizeFailure(line)
      .replace(/\b(?:run|job|step|attempt|request|pid|id)[=: ]+<RUN>/giu, '$1=<ID>')
      .replace(/\b\d+\b/gu, '<N>'))
    .slice(0, 3)
    .join(' | ');
  if (stable) return hash(stable).slice(0, 20);
  const features = extractFeatures(String(log ?? '')).sort().join('|');
  return hash(features || 'NO_SALIENT_ERROR').slice(0, 20);
}

function classifyRun(run, log, allRuns, executionSha) {
  const text = String(log ?? '');
  const cancellation = cancellationClass(run, allRuns);
  if (cancellation?.state === 'CANCELLED_SUPERSEDED') {
    return {
      class: 'CANCELLED_SUPERSEDED',
      rootCauseStatus: 'NOT_A_ROOT_CAUSE',
      reason: 'A newer non-cancelled run for the same workflow and SHA superseded this cancellation.',
    };
  }
  if (run?.headSha !== executionSha) {
    return {
      class: 'STALE_EVIDENCE',
      rootCauseStatus: 'NOT_CURRENT',
      reason: 'Run evidence belongs to a different execution SHA.',
    };
  }
  if (providerFailure(text)) {
    return {
      class: 'BLOCKED_EXTERNAL',
      rootCauseStatus: 'CONFIRMED_EXTERNAL_PATTERN',
      reason: 'Provider/external-service signature is present in captured evidence.',
    };
  }
  if (contractPatterns.some((pattern) => pattern.test(text))) {
    return {
      class: 'INTERNAL_CONTRACT',
      rootCauseStatus: 'CANDIDATE_ROOT_CAUSE',
      reason: 'The evidence names a repository contract or validator as the failing surface.',
    };
  }
  const normalizedName = normalizeWorkflowName(run?.workflowName);
  if (downstreamPatterns.some((pattern) => pattern.test(normalizedName))) {
    const upstreamFailure = allRuns.find((candidate) =>
      candidate !== run &&
      candidate.headSha === executionSha &&
      candidate.status === 'completed' &&
      ['failure', 'timed_out'].includes(candidate.conclusion) &&
      !downstreamPatterns.some((pattern) => pattern.test(normalizeWorkflowName(candidate.workflowName))) &&
      String(candidate.updatedAt ?? '').localeCompare(String(run.updatedAt ?? '')) <= 0
    );
    if (upstreamFailure) {
      return {
        class: 'DOWNSTREAM_FAILURE',
        rootCauseStatus: 'NOT_ROOT_CAUSE',
        reason: 'Downstream automation failed while another non-downstream workflow was already red (candidate=' + String(upstreamFailure.workflowName) + ').',
        upstreamWorkflow: upstreamFailure.workflowName,
        upstreamRunId: upstreamFailure.databaseId ?? null,
      };
    }
    return {
      class: 'AUTOMATION_CONTROL_FAILURE',
      rootCauseStatus: 'CANDIDATE_ROOT_CAUSE',
      reason: 'Automation/control-plane failure without an earlier non-downstream failure in the supplied snapshot.',
    };
  }
  return {
    class: securitySignal(run, text) ? 'SECURITY_SIGNAL' : 'INTERNAL_UNKNOWN',
    rootCauseStatus: 'UNKNOWN_RCA',
    reason: 'The evidence is insufficient to prove a causal source; independent RCA is required.',
  };
}

function historicalSignals() {
  const memory = readJson(path.join(ROOT, 'diagnostics/auto-repair/memory.json'), {});
  const rootCauses = readJson(path.join(ROOT, 'scripts/ci/root-causes.json'), {});
  const historyPath = path.join(ROOT, 'docs/agents/ACTION-ERROR-HISTORY.md');
  const history = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, 'utf8') : '';
  return {
    memoryLessons: Array.isArray(memory.lessons) ? memory.lessons.map((item) => ({
      fingerprint: item.fingerprint ?? null,
      rootCause: item.rootCause ?? null,
      rule: item.rule ?? null,
      attempts: Number(item.attempts ?? 0),
      successes: Number(item.successes ?? 0),
      firstSeenAt: item.firstSeenAt ?? null,
      lastSeenAt: item.lastSeenAt ?? null,
    })) : [],
    knownRootCauses: Object.entries(rootCauses).map(([id, item]) => ({
      id,
      category: item?.category ?? null,
      files: item?.files ?? [],
      verification: item?.verification ?? [],
      prevention: item?.prevention ?? null,
    })),
    historyMarkers: {
      available: Boolean(history),
      occurrenceCount: (history.match(/^\|/gmu) ?? []).length,
      mentions: {
        cancelledRuns: (history.match(/cancelled workflow runs/giu) ?? []).length,
        evidenceCapture: (history.match(/Evidence retrieval|EVIDENCE_CAPTURE/giu) ?? []).length,
        historicalLearning: (history.match(/Historical learning/giu) ?? []).length,
      },
    },
  };
}

function analyzeSnapshot(input) {
  const currentSha = String(input.executionSha ?? '').trim();
  if (!exactSha(currentSha)) throw new Error('EXACT_EXECUTION_SHA_REQUIRED');
  const runs = Array.isArray(input.runs) ? input.runs : [];
  const observed = [];

  for (const run of runs) {
    const conclusion = String(run.conclusion ?? '').toLowerCase();
    if (!['failure', 'timed_out', 'cancelled'].includes(conclusion) || run.status !== 'completed') continue;
    const log = String(run.log ?? '');
    const classified = classifyRun(run, log, runs, currentSha);
    observed.push({
      runId: run.databaseId ?? null,
      workflow: run.workflowName ?? null,
      conclusion,
      headSha: run.headSha ?? null,
      headBranch: run.headBranch ?? null,
      updatedAt: run.updatedAt ?? null,
      classification: classified.class,
      rootCauseStatus: classified.rootCauseStatus,
      reason: classified.reason,
      upstreamWorkflow: classified.upstreamWorkflow ?? null,
      upstreamRunId: classified.upstreamRunId ?? null,
      fingerprint: log ? fingerprintFailure(log) : null,
      recurringSignature: recurringSignature(log),
      features: extractFeatures(log),
      security: securitySignal(run, log),
      salientEvidence: salientLines(log),
    });
  }

  const groups = new Map();
  for (const item of observed) {
    const group = groups.get(item.recurringSignature) ?? {
      recurringSignature: item.recurringSignature,
      occurrences: 0,
      workflows: new Set(),
      runIds: [],
      classes: new Set(),
      features: new Set(),
      currentShaOccurrences: 0,
      staleOccurrences: 0,
      externalOccurrences: 0,
      representativeEvidence: item.salientEvidence.slice(0, 3),
    };
    group.occurrences += 1;
    if (item.workflow) group.workflows.add(item.workflow);
    if (item.runId != null) group.runIds.push(item.runId);
    group.classes.add(item.classification);
    for (const feature of item.features) group.features.add(feature);
    if (item.headSha === currentSha) group.currentShaOccurrences += 1;
    else group.staleOccurrences += 1;
    if (item.classification === 'BLOCKED_EXTERNAL') group.externalOccurrences += 1;
    groups.set(item.recurringSignature, group);
  }

  const recurringPatterns = [...groups.values()]
    .filter((group) => group.occurrences >= 2)
    .map((group) => ({
      recurringSignature: group.recurringSignature,
      occurrences: group.occurrences,
      workflows: [...group.workflows].sort(),
      runIds: group.runIds.slice(-20),
      classes: [...group.classes].sort(),
      features: [...group.features].sort(),
      currentShaOccurrences: group.currentShaOccurrences,
      staleOccurrences: group.staleOccurrences,
      externalOccurrences: group.externalOccurrences,
      representativeEvidence: group.representativeEvidence,
      repeatStatus: group.currentShaOccurrences > 0 ? 'RECURRING_CURRENT' : 'HISTORICAL_RECURRING',
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  const rootCauseCandidates = observed
    .filter((item) => item.rootCauseStatus === 'CANDIDATE_ROOT_CAUSE' || item.rootCauseStatus === 'CONFIRMED_EXTERNAL_PATTERN')
    .map((item) => ({
      workflow: item.workflow,
      runId: item.runId,
      classification: item.classification,
      rootCauseStatus: item.rootCauseStatus,
      fingerprint: item.fingerprint,
      recurringSignature: item.recurringSignature,
      reason: item.reason,
      features: item.features,
      evidence: item.salientEvidence.slice(0, 5),
    }));

  const staleEvidence = observed.filter((item) => item.classification === 'STALE_EVIDENCE' || item.classification === 'CANCELLED_SUPERSEDED');
  const downstreamFailures = observed.filter((item) => item.classification === 'DOWNSTREAM_FAILURE');
  const securitySignals = observed.filter((item) => item.security);
  const securityFindings = normalizeSecurityAlerts(input.securityFindings);
  const historical = historicalSignals();
  const sharedLearning = buildSharedLearningContext({ fingerprint: observed.find(item=>item.fingerprint)?.fingerprint??null, botId:'READ-INVESTIGATOR', limit:96 });
  const knownFingerprints = new Set(historical.memoryLessons.map((item) => item.fingerprint).filter(Boolean));
  const recurringKnown = recurringPatterns.map((item) => ({
    ...item,
    historicalMemoryMatches: historical.memoryLessons
      .filter((lesson) => item.features.some((feature) => String(lesson.rootCause ?? '').toLowerCase().includes(feature)))
      .slice(0, 8),
  }));

  const rootCauseByWorkflow = new Map();
  for (const item of rootCauseCandidates) {
    const key = String(item.workflow ?? 'UNKNOWN_WORKFLOW');
    const current = rootCauseByWorkflow.get(key) ?? { workflow: key, occurrences: 0, fingerprints: new Set(), classifications: new Set() };
    current.occurrences += 1;
    if (item.fingerprint) current.fingerprints.add(item.fingerprint);
    current.classifications.add(item.classification);
    rootCauseByWorkflow.set(key, current);
  }

  const rootCauseRanking = [...rootCauseByWorkflow.values()]
    .map((item) => ({
      workflow: item.workflow,
      occurrences: item.occurrences,
      fingerprints: [...item.fingerprints],
      classifications: [...item.classifications],
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  const unknowns = [];
  if (!runs.length) unknowns.push('NO_RUNTIME_RUN_SNAPSHOT');
  if (runs.some((run) => run.conclusion === 'failure' && !String(run.log ?? '').trim())) unknowns.push('FAILURE_RUN_WITHOUT_CAPTURED_LOG');
  if (runs.some((run) => run.status === 'completed' && run.conclusion === 'cancelled' && !cancellationClass(run, runs))) unknowns.push('UNRESOLVED_CANCELLATION');
  if (rootCauseCandidates.some((item) => item.rootCauseStatus === 'CANDIDATE_ROOT_CAUSE')) unknowns.push('CANDIDATE_ROOT_CAUSES_REQUIRE_INDEPENDENT_VERIFICATION');
  if (securitySignals.some((item) => item.classification === 'SECURITY_SIGNAL')) unknowns.push('SECURITY_SIGNAL_IS_NOT_A_VULNERABILITY_VERDICT');
  if (securityFindings.length === 0) unknowns.push('NO_OPEN_CODE_SCANNING_ALERTS_IN_CAPTURED_SECURITY_SNAPSHOT');

  const summary = {
    observedRuns: runs.length,
    failureObservations: observed.length,
    recurringPatterns: recurringPatterns.length,
    rootCauseCandidates: rootCauseCandidates.length,
    staleOrSupersededEvidence: staleEvidence.length,
    downstreamFailures: downstreamFailures.length,
    securitySignals: securitySignals.length,
    openCodeScanningAlerts: securityFindings.length,
    externalBlocks: observed.filter((item) => item.classification === 'BLOCKED_EXTERNAL').length,
    knownHistoricalFingerprints: observed.filter((item) => item.fingerprint && knownFingerprints.has(item.fingerprint)).length,
  };

  const base = {
    schemaVersion: 2,
    authority: 'READ_ONLY_ERROR_INVESTIGATOR',
    powerProfile: READ_ONLY_POWER_PROFILE,
    mode: 'READ_ONLY_ERROR_INTELLIGENCE',
    mutationPolicy: 'NO_SOURCE_MUTATION',
    reportWriteScope: DEFAULT_OUTPUT,
    generatedAt: now(),
    observedBranch: input.observedBranch ?? 'execution',
    executionSha: currentSha,
    mainSha: input.mainSha ?? null,
    exactShaVerified: exactSha(currentSha),
    summary,
    observed,
    recurringPatterns: recurringKnown,
    rootCauseCandidates,
    rootCauseRanking,
    downstreamFailures,
    staleEvidence,
    securitySignals,
    securityFindings,
    historicalSignals: historical,
    sharedOperationalMemory: sharedLearning,
    deepInference: buildDeepInference({
      executionSha: currentSha,
      observed,
      historicalSignals: historical,
      securityFindings,
      recurringPatterns,
      downstreamFailures,
      staleEvidence,
    }),
    unknowns,
    decisionPolicy: 'Evidence-backed analysis only. A recurring pattern is not proof of causality. A security signal is not a vulnerability verdict. No report authorizes mutation, certification, merge, push, or repair.',
    writePolicy: 'The investigator may write only its own report path and the canonical shared operational learning memory. It never mutates repository source, Git refs, CI configuration, task state, or control-plane state.',
  };
  return { ...base, digest: hash(JSON.stringify(base)) };
}

function collectWithGh() {
  const repository = process.env.GITHUB_REPOSITORY || arg('repo');
  const branch = arg('branch', process.env.GITHUB_REF_NAME || 'execution');
  if (!repository) throw new Error('GITHUB_REPOSITORY_REQUIRED_FOR_LIVE_COLLECTION');
  const executionSha = arg('sha', process.env.EXPECTED_SHA || sha());
  const limit = Math.min(Math.max(Number(arg('limit', String(READ_ONLY_POWER_PROFILE.budgets.investigatorRunLimit))), 1), READ_ONLY_POWER_PROFILE.budgets.investigatorRunLimit);
  const raw = execFileSync('gh', [
    'run', 'list',
    '--repo', repository,
    '--branch', branch,
    '--limit', String(limit),
    '--json', 'databaseId,workflowName,status,conclusion,headSha,headBranch,createdAt,updatedAt,url',
  ], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const runs = JSON.parse(raw);
  const candidates = runs.filter((run) =>
    run.status === 'completed' &&
    ['failure', 'timed_out', 'cancelled'].includes(String(run.conclusion ?? '').toLowerCase())
  );
  const maxLogs = Math.min(Number(arg('max-logs', String(READ_ONLY_POWER_PROFILE.budgets.investigatorMaxLogs))), candidates.length);
  let captured = 0;
  for (const run of candidates.slice(0, maxLogs)) {
    if (run.conclusion === 'cancelled') {
      run.log = '';
      continue;
    }
    try {
      run.log = execFileSync('gh', ['run', 'view', String(run.databaseId), '--repo', repository, '--log-failed'], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 8 * 1024 * 1024,
      });
      captured += 1;
    } catch {
      run.log = '';
    }
  }
  let securityFindings = [];
  try {
    const rawAlerts = execFileSync('gh', [
      'api',
      '--repo', repository,
      '--method', 'GET',
      'repos/' + repository + '/code-scanning/alerts?ref=' + encodeURIComponent(executionSha) + '&state=open&per_page=100',
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    });
    securityFindings = JSON.parse(rawAlerts);
  } catch {
    securityFindings = [];
  }

  return {
    repository,
    observedBranch: branch,
    executionSha,
    mainSha: process.env.MAIN_SHA || null,
    runs,
    securityFindings,
    capture: { requested: candidates.length, captured },
  };
}

export function runInvestigator(input) {
  return analyzeSnapshot(input);
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const inputPath = arg('input');
  const output = path.resolve(ROOT, arg('output', DEFAULT_OUTPUT));
  const input = inputPath ? readJson(path.resolve(ROOT, inputPath), null) : collectWithGh();
  if (!input || !Array.isArray(input.runs)) throw new Error('INVESTIGATOR_INPUT_RUNS_REQUIRED');
  const report = analyzeSnapshot(input);
  const publishSha=report.executionSha;
  try{
    publishSharedMemory({sourceBot:'READ-INVESTIGATOR',kind:'ERROR',taskId:process.env.FLIXO_AGENT_TASK??('READ-INVESTIGATION:'+publishSha.slice(0,12)),fingerprint:report.observed.find(item=>item.fingerprint)?.fingerprint??null,targetSha:publishSha,claim:'Read-only investigator observed current and historical error patterns for the exact execution SHA.',content:JSON.stringify({summary:report.summary,unknowns:report.unknowns,rootCauseCandidates:report.rootCauseCandidates.slice(0,12),sharedRecordCount:report.sharedOperationalMemory.recordCount}),evidenceRefs:report.observed.slice(0,12).map(item=>item.runId).filter(Boolean),verification:'READ_ONLY_INVESTIGATION',status:'OBSERVED'});
  }catch(error){console.warn('SHARED_MEMORY_PUBLISH_WARNING='+String(error?.message??error));}
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'w' });
  console.log(JSON.stringify({
    status: 'PASS',
    authority: report.authority,
    mode: report.mode,
    executionSha: report.executionSha,
    recurringPatterns: report.summary.recurringPatterns,
    rootCauseCandidates: report.summary.rootCauseCandidates,
    externalBlocks: report.summary.externalBlocks,
    output,
  }, null, 2));
}
