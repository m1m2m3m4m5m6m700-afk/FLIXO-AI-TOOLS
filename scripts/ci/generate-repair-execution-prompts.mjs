#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  fingerprintFailure,
  findSimilarCases,
  rankLessons,
  deriveReusableKnowledge,
  loadMemory,
} from './auto-repair-learning.mjs';
import {
  loadPromptRegistry,
  discoverPromptContext,
  createPromptHandoff,
} from './prompt-registry.mjs';

const inputPath = process.argv[2] ?? '/tmp/flixo-watch/input.json';
const reportPath = process.argv[3] ?? '/tmp/flixo-watch/report.json';
const outputPath = process.argv[4] ?? '/tmp/flixo-watch/execution-prompts.json';
const markdownPath = process.argv[5] ?? '/tmp/flixo-watch/execution-prompts.md';

const readJson = (file, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
const readText = (value) => String(value ?? '').replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '').trim();
const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');
const unique = (items) => [...new Set(items.filter(Boolean))];

const input = readJson(inputPath, {});
const report = readJson(reportPath, {});
const memory = loadMemory();
const promptRegistry = loadPromptRegistry();

const executionSha = String(input.executionSha ?? report.executionSha ?? '');
const mainSha = String(input.mainSha ?? report.mainSha ?? '');
const observedBranch = String(input.observedBranch ?? report.observedBranch ?? 'execution');
const workflowRuns = Array.isArray(input.workflowRuns) ? input.workflowRuns : [];
const checkRuns = Array.isArray(input.checkRuns) ? input.checkRuns : [];
const logs = input.logs && typeof input.logs === 'object' ? input.logs : {};
const errors = Array.isArray(report.errors) ? report.errors : [];
const externalBlockers = Array.isArray(report.externalBlockers) ? report.externalBlockers : [];

if (!/^[a-f0-9]{40}$/u.test(executionSha)) throw new Error('PROMPT_GENERATOR_EXECUTION_SHA_INVALID');
if (!['execution', 'main'].includes(observedBranch)) throw new Error('PROMPT_GENERATOR_BRANCH_INVALID');

const failedRuns = workflowRuns
  .filter((run) => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(String(run.conclusion ?? '')))
  .filter((run) => run.headSha === executionSha);

const byRunId = new Map(failedRuns.map((run) => [String(run.databaseId), run]));

const checkFailures = checkRuns
  .filter((check) => check.status === 'completed')
  .filter((check) => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(String(check.conclusion ?? '')))
  .filter((check) => {
    const details = String(check.details_url ?? '');
    const match = details.split('/actions/runs/')[1]?.match(/^\d+/u);
    return match ? byRunId.has(match[1]) : true;
  });

const normalizeIssue = ({ run = null, check = null, error = null } = {}) => {
  const runId = run?.databaseId != null ? String(run.databaseId) : null;
  const checkRunId = check?.id != null ? String(check.id) : null;
  const log = readText(runId ? logs[runId] : '');
  const errorHint = error ? JSON.stringify(error) : '';
  const evidence = log || errorHint || `${check?.name ?? 'unknown check'}${check?.conclusion ? ` conclusion=${check.conclusion}` : ''}`;
  const fingerprint = fingerprintFailure(evidence);
  return {
    runId,
    checkRunId,
    workflow: run?.workflowName ?? run?.name ?? check?.name ?? 'unknown',
    conclusion: run?.conclusion ?? check?.conclusion ?? error?.type ?? 'unknown',
    headSha: run?.headSha ?? executionSha,
    fingerprint,
    log: evidence.slice(0, 8000),
    error,
  };
};

const issueCandidates = [];
for (const run of failedRuns) {
  const matchingChecks = checkFailures.filter((check) => {
    const details = String(check.details_url ?? '');
    const match = details.split('/actions/runs/')[1]?.match(/^\d+/u);
    return match?.[1] === String(run.databaseId);
  });
  if (matchingChecks.length) {
    for (const check of matchingChecks) issueCandidates.push(normalizeIssue({ run, check }));
  } else {
    issueCandidates.push(normalizeIssue({ run }));
  }
}

for (const error of errors) {
  const referencedRunId = error.runId ?? error.databaseId ?? error.targetRunId ?? null;
  const run = referencedRunId != null ? byRunId.get(String(referencedRunId)) ?? null : null;
  issueCandidates.push(normalizeIssue({ run, error }));
}

const grouped = new Map();
for (const issue of issueCandidates) {
  const key = issue.fingerprint || sha256(JSON.stringify(issue)).slice(0, 64);
  const group = grouped.get(key) ?? [];
  group.push(issue);
  grouped.set(key, group);
}

const providerPatterns = [
  /api-deployments-free-per-day/i,
  /rate limit/i,
  /quota/i,
  /deployment provider/i,
  /sessionmodelerror/i,
  /requested model is not supported/i,
];

const buildAgentPrompt = (fingerprint, members, index) => {
  const primary = members[0];
  const known = memory.cases.find((item) => item.fingerprint === fingerprint) ?? null;
  const similar = findSimilarCases(memory, {
    fingerprint,
    normalized: primary.log,
    features: known?.features ?? [],
  }).slice(0, 5);
  const lessons = rankLessons(memory, {
    fingerprint,
    rootCause: known?.rootCause ?? null,
  }).slice(0, 8);
  const reusable = deriveReusableKnowledge(memory, {
    rootCause: known?.rootCause ?? null,
    features: known?.features ?? [],
    fingerprint,
  });
  const external = providerPatterns.some((pattern) => pattern.test(primary.log));
  const promptContext = discoverPromptContext({
    registry: promptRegistry,
    memory,
    failureFingerprint: fingerprint,
    rootCause: known?.rootCause ?? '',
  });
  const registrySelection = promptContext.selection;
  const registryPromptId = registrySelection.status === 'REUSE' ? registrySelection.prompt.promptId : null;
  const promptDecision = registrySelection.status;
  const runIds = unique(members.map((item) => item.runId));
  const workflows = unique(members.map((item) => item.workflow));
  const promptHandoff = registryPromptId
    ? createPromptHandoff({
        registry: promptRegistry,
        promptId: registryPromptId,
        exactSha: executionSha,
        failureFingerprint: fingerprint,
        rootCause: known?.rootCause ?? 'UNKNOWN_RCA',
        evidence: [
          primary.log.slice(0, 2000),
          ...runIds.filter(Boolean).map((runId) => `run:${runId}`),
        ],
      })
    : null;
  const prompt = [
    'FLIXO REPAIR EXECUTION PROMPT — GENERATED BY DAILY VISIT',
    '',
    `Priority: ${index + 1}`,
    `Observed branch: ${observedBranch}`,
    `Exact execution SHA: ${executionSha}`,
    `Main SHA observed: ${mainSha}`,
    `Failure fingerprint: ${fingerprint}`,
    `Workflow(s): ${workflows.join(', ') || 'unknown'}`,
    `Run ID(s): ${runIds.join(', ') || 'none'}`,
    `Repeated observations in this visit: ${members.length}`,
    `Classification: ${external ? 'BLOCKED_EXTERNAL_CANDIDATE' : 'ACTIONABLE_INTERNAL_CANDIDATE'}`,
    `Prompt Registry decision: ${promptDecision}`,
    `Registry Prompt ID: ${registryPromptId ?? 'NONE — PROMPT_REVIEW_REQUIRED before creating a new specialist'}`,
    '',
    'MISSION',
    external
      ? 'Prove whether this is an external-provider blocker. Do not modify repository source to mask an external service/quota/rate-limit failure. Preserve exact evidence and escalate as BLOCKED_EXTERNAL when proven.'
      : 'Repair the demonstrated root cause on execution only. Do not treat a test addition, timeout change, suppression, retry, allowlist, or gate weakening as a repair unless the evidence proves the underlying defect is exactly that behavior.',
    '',
    'MANDATORY EXECUTION',
    '1. READ: PROJECTS.md → المهام.md → AGENTS.md → applicable agent/protocol contracts.',
    '2. LOCK exact SHA, branch, failure fingerprint, affected scope, dependencies, and proof obligations.',
    '3. Consume the latest applicable Code Scout evidence before mutation; re-scout when stale or missing.',
    '4. Capture and preserve exact failure evidence. Distinguish symptom, trigger, propagation, violated invariant, and causal source.',
    '5. Read Prompt Registry before creating or modifying a prompt; reuse/extend/merge/specialize/split before create, and stop at PROMPT_REVIEW_REQUIRED when causal ownership is ambiguous.',
    '6. Search Error Memory before choosing a repair hypothesis; treat memory as advisory, never as proof.',
    '7. Reproduce the failure on the exact SHA where feasible. State UNKNOWN_RCA rather than guessing.',
    '8. Apply the smallest complete root-cause repair in the declared scope on execution only.',
    '8. Add regression/hardening only after the source repair and only when it protects the demonstrated invariant.',
    '9. Run targeted regression, then every affected contract/check, then canonical verification required by the repository.',
    '10. Re-check exact SHA and diff boundary; do not declare GREEN/CLOSED from targeted success alone.',
    '11. Record outcome as SUCCESS, FAILURE, BLOCKED_EXTERNAL, REVERTED, or PROPOSED with provenance.',
    '13. Write the lesson/anti-lesson so the next visit can reuse or reject this strategy.',
    '14. Never treat Prompt Registry metadata or memory as proof of repair success.',
    '',
    'STOP CONDITIONS',
    '- Stale or conflicting exact-SHA evidence.',
    '- Missing failure evidence.',
    '- Unknown RCA at mutation boundary.',
    '- Protected control-plane or certification surfaces outside authorized scope.',
    '- CRITICAL risk without required human/controller authority.',
    '',
    'FAILURE EVIDENCE',
    readText(primary.log) || 'No log text captured; use the referenced run/check evidence and fail closed if evidence remains insufficient.',
    '',
    'KNOWN MEMORY / REUSE',
    JSON.stringify({
      exactCase: Boolean(known),
      rootCause: known?.rootCause ?? null,
      attempts: known?.attempts ?? 0,
      successes: known?.successes ?? 0,
      failures: known?.failures ?? 0,
      similarCases: similar.map(({ case: item, score }) => ({ fingerprint: item.fingerprint, score, rootCause: item.rootCause, rules: item.rules ?? [] })),
      trustedLessons: lessons.filter((item) => !item.anti && item.confidence >= 0.75).map((item) => ({ rule: item.rule, confidence: item.confidence, rootCause: item.rootCause })),
      antiLessons: lessons.filter((item) => item.anti).map((item) => ({ rule: item.rule, confidence: item.confidence, rootCause: item.rootCause })),
      reusableRules: (reusable.generalizedRules ?? []).slice(0, 8),
    }, null, 2),
    '',
    'REQUIRED FINAL HANDOFF',
    'Return exact SHA, failure fingerprint, RCA, changed files, repair rationale, targeted regression, affected-contract verification, canonical CI state, remaining work/blockers, and the learning record reference. Never substitute confidence for proof.',
  ].join('\\n');
  return {
    promptId: `repair-prompt-${fingerprint.slice(0, 20)}`,
    fingerprint,
    priority: index + 1,
    kind: external ? 'BLOCKED_EXTERNAL' : 'REPAIR',
    runIds,
    workflows,
    rootCauseHint: known?.rootCause ?? null,
    exactCaseInMemory: Boolean(known),
    prompt,
  };
};

const prompts = [...grouped.entries()]
  .map(([fingerprint, members], index) => buildAgentPrompt(fingerprint, members, index))
  .sort((a, b) => a.priority - b.priority);

const blockerPrompts = externalBlockers.map((blocker, index) => ({
  promptId: `blocker-prompt-${index + 1}`,
  priority: prompts.length + index + 1,
  kind: 'BLOCKED_EXTERNAL',
  blocker,
  prompt: [
    'FLIXO EXTERNAL BLOCKER HANDOFF PROMPT',
    `Exact execution SHA: ${executionSha}`,
    `Blocker: ${JSON.stringify(blocker)}`,
    '',
    'Do not modify source to conceal, bypass, suppress, or retry-mask this blocker.',
    'Collect provider evidence, preserve provenance, mark BLOCKED_EXTERNAL, and return the exact external dependency and next observable recovery condition.',
  ].join('\\n'),
}));

const taskFallback = (() => {
  if (prompts.length > 0 || blockerPrompts.length > 0 || report.status !== 'GREEN') return null;
  const taskFile = fs.existsSync('المهام.md') ? 'المهام.md' : 'مهام.md';
  if (!fs.existsSync(taskFile)) return null;
  const lines = fs.readFileSync(taskFile, 'utf8').split(/\r?\n/u);
  let section = 'TASK LEDGER';
  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/u);
    if (heading) section = heading[1].trim();
    const item = line.match(/^\\s*-\\s+\\[ \\]\\s+(.+)$/u);
    if (!item) continue;
    return {
      promptId: 'task-prompt-' + sha256(item[1]).slice(0, 20),
      priority: 1,
      kind: 'TASK_EXECUTION',
      task: { section, title: item[1].trim() },
      prompt: [
        'FLIXO DAILY VISIT — TASK EXECUTION PROMPT',
        `Exact execution SHA: ${executionSha}`,
        `Task section: ${section}`,
        `Task: ${item[1].trim()}`,
        '',
        'Execute this task only within its declared scope. READ PROJECTS.md → المهام.md → AGENTS.md and the applicable contracts first.',
        'Inspect current code before mutation, consume applicable Scout evidence, define proof obligations, implement the smallest complete change, run targeted regression and canonical verification, then record exact-SHA evidence and a learning outcome.',
        'Do not weaken tests or gates, do not mutate main directly, and do not close the task without current canonical evidence.',
      ].join('\\n'),
    };
  }
  return null;
})();
const allPrompts = [...prompts, ...blockerPrompts, ...(taskFallback ? [taskFallback] : [])];
const masterPrompt = [
  'FLIXO DAILY VISIT — MASTER REPAIR EXECUTION PROMPT',
  `Exact execution SHA: ${executionSha}`,
  `Main SHA observed: ${mainSha}`,
  `Observed branch: ${observedBranch}`,
  `Visit source report status: ${report.status ?? 'UNKNOWN'}`,
  `Unique incident prompts: ${prompts.length}`,
  `External blocker handoffs: ${blockerPrompts.length}`,
  '',
  'Execute incident prompts in priority order. Do not parallelize overlapping scopes. Reuse memory, lessons, and anti-lessons, but require fresh exact-SHA evidence before every mutation.',
  'A new failure inside the same causal repair boundary is an in-flight failure: repair, targeted retest, then resume remaining verification rather than spawning duplicate repair paths.',
  'When no actionable internal RED exists, execute the highest-priority incomplete task from المهام.md within its declared scope.',
  'Every completed repair must leave a durable learning record; every failed strategy must leave an anti-lesson so the next cycle does not blindly repeat it.',
  '',
  ...allPrompts.map((item) => `### ${item.promptId}\n${item.prompt}`),
].join('\\n');

const bundle = {
  schemaVersion: 1,
  authority: 'DAILY_FLIXO_GREEN_GATE',
  generatedAt: new Date().toISOString(),
  executionSha,
  mainSha,
  observedBranch,
  reportStatus: report.status ?? 'UNKNOWN',
  masterPrompt,
  promptCount: allPrompts.length,
  uniqueFailureCount: prompts.length,
  externalBlockerCount: blockerPrompts.length,
  prompts: allPrompts,
  learningContract: {
    memorySource: 'diagnostics/auto-repair/memory.json',
    learningMode: 'ADVISORY_WITH_FRESH_PROOF_REQUIRED',
    successfulFixesBecomeLessons: true,
    failedStrategiesBecomeAntiLessons: true,
    autoPolicyMutation: false,
    greenAuthority: 'CANONICAL_CERTIFICATION_ONLY',
  },
  digest: sha256(masterPrompt),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2) + '\\n');
fs.writeFileSync(markdownPath, `# FLIXO Daily Repair Prompt Bundle

- Exact execution SHA: ${executionSha}
- Main SHA: ${mainSha}
- Observed branch: ${observedBranch}
- Visit status: ${report.status ?? 'UNKNOWN'}
- Unique failure prompts: ${prompts.length}
- External blocker handoffs: ${blockerPrompts.length}
- Bundle digest: ${bundle.digest}

## Master Prompt

\`\`\`
${masterPrompt}
\`\`\`
`);

console.log(JSON.stringify({
  status: 'PASS',
  executionSha,
  reportStatus: bundle.reportStatus,
  promptCount: bundle.promptCount,
  uniqueFailureCount: bundle.uniqueFailureCount,
  externalBlockerCount: bundle.externalBlockerCount,
  digest: bundle.digest,
  outputPath,
  markdownPath,
}, null, 2));
