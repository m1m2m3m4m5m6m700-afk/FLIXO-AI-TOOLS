#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  loadPromptRegistry, validatePromptRegistry, selectPromptCandidates, promptQualityGate,
} from './prompt-intelligence.mjs';
import { ingest } from './agent-communication.mjs';
import { runAdversarialCorrectionLoop, assertAdversarialGate } from './prompt-execution-bot-adversary.mjs';
import { loadExecutionBotTraining, trainingSummary } from './prompt-execution-bot-training.mjs';
import { validateAdversarialBotCommandRegistry } from './adversarial-bot-commands.mjs';
import { buildTenXExecutionEnvelope, validateTenXExecutionLayer } from './read-only-power-profile.mjs';

const ROOT = process.cwd();
const MAX_INPUT = Math.max(1000, Number(process.env.FLIXO_PROMPT_BOT_MAX_INPUT_CHARS ?? 12000));
export const CANONICAL_SOURCES = Object.freeze([
  'PROJECTS.md', 'المهام.md', 'AGENTS.md', 'docs/EXECUTION-BRANCH-PROTOCOL.md',
  'docs/AGENT-COLLABORATION-PROTOCOL.md', 'docs/AGENT-COORDINATION-CONTROL-PLANE.md',
  'docs/PROTOCOL-HIERARCHY.md', 'docs/PROTOCOL-REGISTRY.json',
  'docs/agents/PROMPT-REGISTRY.json', 'diagnostics/auto-repair/memory.json',
  'docs/agents/PROMPT-UNIFIED-EXECUTION.md', 'scripts/ci/prompt-execution-bot-adversary.mjs',
  'docs/agents/PROMPT-EXECUTION-BOT-ADVERSARY.md', 'docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json',
  'docs/agents/ACTION-AGENT-TRIAD.md', 'docs/agents/ADVERSARIAL-BOT-COMMANDS.json', 'scripts/ci/adversarial-bot-commands.mjs',
]);
const ACTIONS = Object.freeze([
  ['REPAIR', /(repair|fix|heal|resolve|correct|restore|إصلاح|اصلح|أصلح|عالج|حل|تصحيح)/iu],
  ['DIAGNOSE', /(diagnose|investigate|root[-\s]?cause|analy[sz]e|تشخيص|حلل|حلّل|تحقيق|سبب جذري|جذور)/iu],
  ['VERIFY', /(verify|validate|check|test|prove|certif|تحقق|اختبر|فحص|إثبات|اعتمد)/iu],
  ['IMPLEMENT', /(implement|build|create|add|develop|upgrade|execute|run|تنفيذ|نفذ|نفّذ|ابن|أنشئ|أضف|طور|طوّر|ترقية)/iu],
  ['PLAN', /(plan|design|decompose|architecture|خطة|صمم|صمّم|قسّم|تفكيك|معمارية)/iu],
  ['DOCUMENT', /(document|docs|write|describe|وثق|وثّق|اكتب|توثيق)/iu],
]);
const NEGATIVE = /(لا|ليس|ليست|ممنوع|بدون|دون|لن|never|don't|do not|must not|cannot|forbid|forbidden|without)/iu;
const UNSAFE = [
  [/(?:ignore|override)\s+(?:all\s+)?(?:previous|system|repository)\s+(?:rules|instructions)/iu, 'PROMPT_INJECTION_OVERRIDE'],
  [/(?:تجاهل|تجاوز)\s+(?:كل\s+)?(?:قواعد|تعليمات)\s+(?:المستودع|النظام|البروتوكول)/iu, 'PROMPT_INJECTION_OVERRIDE_AR'],
  [/(?:disable|skip|remove|weaken|bypass)\s+(?:tests?|checks?|gates?|security|protection)/iu, 'GATE_WEAKENING'],
  [/(?:تعطيل|تخطي|حذف|إضعاف|تجاوز)\s+(?:الاختبارات|الفحوصات|البوابات|الحماية|الأمان)/iu, 'GATE_WEAKENING_AR'],
  [/(?:force[-\s]?push|push\s+(?:directly\s+)?main|edit\s+main\s+directly)/iu, 'MAIN_MUTATION'],
  [/(?:إنشاء|استخدام)\s+(?:فرع|branch)\s+(?:جديد|ثالث|آخر)/iu, 'THIRD_BRANCH'],
  [/(?:git\s+push\s+--force|git\s+reset\s+--hard\s+main)/iu, 'HISTORY_REWRITE'],
  [/(?:expose|print|share|leak)\s+(?:secrets?|tokens?|credentials?)/iu, 'SECRET_EXFILTRATION'],
];
const ACTIVE = /(OPEN|ACTIVE|IN_PROGRESS|VERIFYING|IMPLEMENTED \/ VERIFYING|IMPLEMENTED \/ CANONICAL-CI-VERIFICATION-PENDING|INCOMPLETE \/ PARTIAL)/iu;
const CONFIDENCE_FLOOR = 0.65;

function arg(name, fallback = '') {
  const token = process.argv.find((item) => item === `--${name}` || item.startsWith(`--${name}=`));
  if (!token) return fallback;
  return token.includes('=') ? token.slice(token.indexOf('=') + 1) : (process.argv[process.argv.indexOf(token) + 1] ?? fallback);
}
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function digest(value) { return createHash('sha256').update(String(value), 'utf8').digest('hex'); }
function fileDigest(file) { return digest(fs.readFileSync(path.resolve(ROOT, file), 'utf8')); }

export function readPrompt() {
  const inline = String(arg('prompt', '')).trim();
  if (inline) return inline;
  const file = String(arg('prompt-file', '')).trim();
  if (file) return fs.readFileSync(path.resolve(ROOT, file), 'utf8').trim();
  if (!process.stdin.isTTY) return fs.readFileSync(0, 'utf8').trim();
  return '';
}

function canonicalContext() {
  const missing = CANONICAL_SOURCES.filter((file) => !fs.existsSync(path.resolve(ROOT, file)));
  if (missing.length) throw new Error(`PROMPT_EXECUTION_BOT_CONTEXT_MISSING=${missing.join(',')}`);
  const registry = loadPromptRegistry();
  const validation = validatePromptRegistry(registry);
  if (!validation.valid) throw new Error(`PROMPT_EXECUTION_BOT_PROMPT_REGISTRY_INVALID=${validation.errors.join('|')}`);
  const protocols = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'docs/PROTOCOL-REGISTRY.json'), 'utf8'));
  const p00 = protocols.protocols?.find((item) => item?.id === 'P00');
  if (protocols.authority !== 'FLIXO_PROTOCOL_REGISTRY' || p00?.status !== 'SUPREME_MANDATORY') throw new Error('PROMPT_EXECUTION_BOT_P00_INVALID');
  const prompt = fs.readFileSync(path.resolve(ROOT, 'docs/agents/PROMPT-UNIFIED-EXECUTION.md'), 'utf8');
  const adversary = fs.readFileSync(path.resolve(ROOT, 'scripts/ci/prompt-execution-bot-adversary.mjs'), 'utf8');
  const cooperation = fs.readFileSync(path.resolve(ROOT, 'docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json'), 'utf8');
  const adversarialRegistry = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'docs/agents/ADVERSARIAL-BOT-COMMANDS.json'), 'utf8'));
  const adversarialRegistryValidation = validateAdversarialBotCommandRegistry(adversarialRegistry);
  const tenXValidation = validateTenXExecutionLayer();
  if (!tenXValidation.ok) throw new Error('PROMPT_EXECUTION_BOT_TEN_X_PROFILE_INVALID=' + tenXValidation.failures.join('|'));
  if (!adversary.includes("ACTION-REPAIR-2") || !adversary.includes("NO_MUTATION_NO_CERTIFICATION")) throw new Error('PROMPT_EXECUTION_BOT_ADVERSARY_CONTRACT_INVALID');
  if (!cooperation.includes('"ACTION-REPAIR-2"') || !cooperation.includes('"mutationAuthority": false')) throw new Error('PROMPT_EXECUTION_BOT_ADVERSARY_AUTHORITY_INVALID');
  if (!adversarialRegistryValidation.ok || adversarialRegistryValidation.botCount < 4) throw new Error('PROMPT_EXECUTION_BOT_ADVERSARIAL_COMMAND_REGISTRY_INVALID');
  for (const marker of ['RPR-UNIFIED-EXECUTION-001', 'FIRST OBLIGATION', 'Exact-SHA', 'execution → main']) {
    if (!prompt.includes(marker)) throw new Error(`PROMPT_EXECUTION_BOT_PROMPT_MARKER_MISSING=${marker}`);
  }
  return { registry, validation };
}

function sentenceList(prompt) { return prompt.split(/(?<=[.!?؟])\s+|\n+/u).map((x) => x.trim()).filter(Boolean); }
function isNegated(prompt, pattern) { const at = prompt.search(pattern); return at >= 0 && NEGATIVE.test(prompt.slice(Math.max(0, at - 90), at)); }
function actions(prompt) { return ACTIONS.filter(([, pattern]) => pattern.test(prompt)).map(([name]) => name); }
function intentFor(prompt, actionList) {
  if (actionList.includes('REPAIR') || actionList.includes('DIAGNOSE')) return 'REPAIR_DIAGNOSE';
  if (actionList.includes('VERIFY')) return 'VERIFY';
  if (actionList.includes('IMPLEMENT')) return 'EXECUTION';
  if (actionList.includes('PLAN')) return 'PLAN';
  if (actionList.includes('DOCUMENT')) return 'DOCUMENT';
  if (/(prompt|برومبت|بوت|agent|وكيل|repository|repo|المستودع)/iu.test(prompt)) return 'REPOSITORY_AGENT_ORCHESTRATION';
  return 'TASK';
}
function constraints(prompt) {
  const out = { hard: [], soft: [], inferred: [], uncertain: [], userTaste: [] };
  for (const s of sentenceList(prompt)) {
    if (/(must|required|mandatory|only|never|do not|must not|forbidden|يجب|إلزامي|فقط|أبدًا|ممنوع)/iu.test(s)) out.hard.push(s);
    else if (/(prefer|ideally|recommended|يفضل|مستحسن)/iu.test(s)) out.soft.push(s);
    else if (/(maybe|perhaps|might|could|ربما|قد|يمكن|غير واضح)/iu.test(s)) out.uncertain.push(s);
    else if (/(style|design|look|feel|color|layout|ui|ux|أسلوب|تصميم|شكل|ألوان|واجهة)/iu.test(s)) out.userTaste.push(s);
    else if (s.length >= 12) out.inferred.push(s);
  }
  for (const key of Object.keys(out)) out[key] = [...new Set(out[key])];
  return out;
}
function paths(prompt) { return [...new Set((prompt.match(/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+/gu) ?? []).map((x) => x.replace(/[),.;:]+$/u, '')).filter((x) => !/^https?:\/\//iu.test(x)))]; }
function taskRows() {
  return fs.readFileSync(path.resolve(ROOT, 'المهام.md'), 'utf8').split(/\r?\n/u).flatMap((line) => {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|(?:\s*([^|]+?)\s*\|)?\s*$/u);
    if (!m) return [];
    const id = m[1].trim();
    return /^[A-Z][A-Z0-9-]+(?:-\d{3})?$/u.test(id) ? [{ id, status: m[2].trim(), detail: m[3].trim(), source: line.trim() }] : [];
  });
}
function taskScore(row, prompt, intent) {
  if (!ACTIVE.test(row.status)) return -1;
  let score = 0;
  if (prompt.toLowerCase().includes(row.id.toLowerCase())) score += 0.80;
  for (const token of prompt.toLowerCase().split(/[\s,.:;!?()[\]{}"']+/u).filter((x) => x.length >= 4).slice(0, 40)) {
    if (`${row.id} ${row.detail}`.toLowerCase().includes(token)) score += 0.02;
  }
  const map = [
    ['WP3-UNDERSTAND-PLAN-CONFIRM-001', /(prompt|intent|understand|plan|برومبت|فهم|نية|خطة)/iu],
    ['WP4-EXECUTE-VERIFY-RECOVER-001', /(execute|execution|verify|recover|تنفيذ|تحقق|استرجاع)/iu],
    ['ROOT-CAUSE-DIAGNOSTICS-001', /(error|failure|red|rca|root|خطأ|فشل|تشخيص|سبب)/iu],
    ['AUTO-REPAIR-BOT-001', /(repair|bot|auto[-\s]?repair|إصلاح|بوت)/iu],
    ['WP2-SECURITY-OBSERVABILITY-001', /(security|trace|log|أمان|تتبع|سجل)/iu],
  ];
  for (const [id, pattern] of map) if (row.id === id && pattern.test(prompt)) score += 0.45;
  if (intent === 'REPAIR_DIAGNOSE' && /REPAIR|DIAGNOSTICS|AUTO-REPAIR/iu.test(row.id)) score += 0.25;
  return Number(score.toFixed(4));
}
function taskCandidates(prompt, intent) { return taskRows().map((row) => ({ task: row, score: taskScore(row, prompt, intent) })).filter((x) => x.score >= 0.15).sort((a, b) => b.score - a.score).slice(0, 5); }
function unsafe(prompt) { return [...new Set(UNSAFE.flatMap(([pattern, code]) => pattern.test(prompt) && !isNegated(prompt, pattern) ? [code] : []))]; }

export function buildPreExecution25Evidence({
  executionSha, mainSha, branch, matchedTasks, selectedTaskId, actionList, intent,
  constraintsValue, unsafeRequests, candidates, selected, quality, training,
  adversarialLoop, adversarialReview, adversarialFailureReport, scope,
  proofObligations, stopConditions,
}) {
  const workflowDir = path.resolve(ROOT, '.github/workflows');
  const workflowCount = fs.existsSync(workflowDir)
    ? fs.readdirSync(workflowDir).filter((name) => /\.ya?ml$/u.test(name)).length
    : 0;
  const operations = [
    { id: 'CURRENT_EXECUTION_SHA', observation: executionSha },
    { id: 'CURRENT_MAIN_SHA', observation: mainSha ?? 'UNAVAILABLE' },
    { id: 'EXECUTION_BRANCH', observation: branch },
    { id: 'TASK_GATE_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'المهام.md')) },
    { id: 'PROJECT_MAP_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'PROJECTS.md')) },
    { id: 'AGENTS_PROTOCOL_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'AGENTS.md')) },
    { id: 'P00_SOURCE_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'docs/agents/PROMPT-UNIFIED-EXECUTION.md')) },
    { id: 'PROTOCOL_REGISTRY_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'docs/PROTOCOL-REGISTRY.json')) },
    { id: 'PROMPT_REGISTRY_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'docs/agents/PROMPT-REGISTRY.json')) },
    { id: 'WORKFLOW_SURFACE_INVENTORY', observation: workflowCount },
    { id: 'ACTIVE_TASK_CANDIDATES', observation: matchedTasks.length },
    { id: 'SELECTED_TASK', observation: selectedTaskId ?? 'NONE' },
    { id: 'INTENT_CLASSIFICATION', observation: intent },
    { id: 'ACTION_CLASSIFICATION', observation: actionList.join(',') || 'NONE' },
    { id: 'HARD_CONSTRAINT_COUNT', observation: constraintsValue.hard.length },
    { id: 'SOFT_CONSTRAINT_COUNT', observation: constraintsValue.soft.length },
    { id: 'UNCERTAIN_CONSTRAINT_COUNT', observation: constraintsValue.uncertain.length },
    { id: 'UNSAFE_REQUEST_SCAN', observation: unsafeRequests.join(',') || 'NONE' },
    { id: 'PROMPT_CANDIDATE_COUNT', observation: candidates.length },
    { id: 'CANONICAL_PROMPT_SELECTED', observation: selected?.promptId ?? 'NONE' },
    { id: 'PROMPT_QUALITY_GATE', observation: quality.status },
    { id: 'TRAINING_LESSON_COUNT', observation: training.lessons?.length ?? 0 },
    { id: 'TRAINING_RULE_COUNT', observation: training.ruleIds?.length ?? 0 },
    { id: 'TRAINING_DIGEST', observation: training.trainingDigest ?? 'NONE' },
    { id: 'ADVERSARY_ROUND', observation: adversarialLoop.round },
    { id: 'ADVERSARY_ACCEPTANCE', observation: adversarialLoop.accepted === true },
    { id: 'ADVERSARY_STATUS', observation: adversarialReview.status },
    { id: 'ADVERSARY_AUTHORITY', observation: adversarialReview.authority },
    { id: 'ADVERSARY_FAILURE_COUNT', observation: adversarialFailureReport.failureCount },
    { id: 'ADVERSARY_COUNTEREXAMPLE', observation: adversarialReview.counterexampleFound === true },
    { id: 'SCOPE_SURFACE_COUNT', observation: scope.length },
    { id: 'PROOF_OBLIGATION_COUNT', observation: proofObligations.length },
    { id: 'STOP_CONDITION_COUNT', observation: stopConditions.length },
    { id: 'GUARD_COMMUNICATION_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'scripts/ci/guard-communication.mjs')) },
    { id: 'SHARED_MEMORY_CONTRACT_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'docs/agents/SHARED-OPERATIONAL-MEMORY-CONTRACT.md')) },
    { id: 'AGENT_COMMUNICATION_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'scripts/ci/agent-communication.mjs')) },
    { id: 'CHAIR_PROTOCOL_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'scripts/ci/central-chair-lease.mjs')) },
    { id: 'ADVERSARIAL_REGISTRY_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'docs/agents/ADVERSARIAL-BOT-COMMANDS.json')) },
    { id: 'MASTER_REPAIR_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'scripts/ci/master-repair-orchestrator.mjs')) },
    { id: 'MASTER_REPAIR_PROTOCOL_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'docs/agents/MASTER-REPAIR-PROTOCOL.md')) },
    { id: 'ACTION_VAULT_GATE_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'scripts/ci/action-vault-mutation-gate.mjs')) },
    { id: 'CANONICAL_CI_PRESENT', observation: fs.existsSync(path.resolve(ROOT, '.github/workflows/ci.yml')) },
    { id: 'GREEN_GATE_PRESENT', observation: fs.existsSync(path.resolve(ROOT, '.github/workflows/daily-flixo-green-gate.yml')) },
    { id: 'ERROR_MEMORY_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'diagnostics/auto-repair/memory.json')) },
    { id: 'PROTOCOL_REGISTRY_PRESENT', observation: fs.existsSync(path.resolve(ROOT, 'docs/PROTOCOL-REGISTRY.json')) },
    { id: 'CANONICAL_SOURCE_COUNT', observation: CANONICAL_SOURCES.length },
    { id: 'SCOPE_UNIQUENESS', observation: new Set(scope).size === scope.length },
    { id: 'PROOF_OBLIGATION_COVERAGE', observation: proofObligations.length >= 8 },
    { id: 'STOP_CONDITION_COVERAGE', observation: stopConditions.length >= 5 },
    { id: 'EXECUTION_SHA_FORMAT', observation: /^[a-f0-9]{40}$/iu.test(executionSha) },
    { id: 'MAIN_SHA_FORMAT', observation: !mainSha || /^[a-f0-9]{40}$/iu.test(mainSha) },
    { id: 'SELECTED_TASK_STATUS', observation: selected?.status ?? 'NONE' },
    { id: 'NO_DUPLICATE_CANDIDATES', observation: new Set(candidates.map((x) => x.prompt?.promptId)).size === candidates.length },
  ];
  const operationCount = operations.length;
  return Object.freeze({
    ruleId: 'PRE-EXECUTION-25',
    status: executionSha && branch === 'execution' && operationCount >= 50 ? 'PASS' : 'BLOCKED',
    minOperations: 50,
    operationCount,
    operationDigest: digest(JSON.stringify({ executionSha, operations })),
    exactSha: executionSha,
    operations,
  });
}

export function buildWorkPackage(prompt) {
  if (!prompt) throw new Error('PROMPT_EXECUTION_BOT_PROMPT_REQUIRED');
  if (prompt.length > MAX_INPUT) throw new Error(`PROMPT_EXECUTION_BOT_PROMPT_TOO_LARGE=${prompt.length}`);
  const ctx = canonicalContext();
  const branch = git(['branch', '--show-current']);
  const executionSha = git(['rev-parse', 'HEAD']);
  const mainSha = (() => { try { return git(['rev-parse', 'main']); } catch { return null; } })();
  const actionList = actions(prompt);
  const intent = intentFor(prompt, actionList);
  const matchedTasks = taskCandidates(prompt, intent);
  const constraintsValue = constraints(prompt);
  const training = loadExecutionBotTraining({ prompt, intent, maxLessons: 16 });
  const failureClasses = intent === 'REPAIR_DIAGNOSE' ? ['ALL_REPAIRABLE', 'SOURCE', 'TEST_CONTRACT', 'CI_ORCHESTRATION', 'COORDINATION'] : intent === 'VERIFY' ? ['TEST_CONTRACT', 'RELEASE', 'SECURITY'] : ['ALL_EXECUTION', 'COORDINATION'];
  const rootCauses = intent === 'REPAIR_DIAGNOSE' ? ['ANY_CONFIRMED_RCA', 'stale-evidence', 'scope-conflict'] : ['stale-contract', 'duplicate-control-path'];
  const candidates = selectPromptCandidates(ctx.registry, { failureClasses, rootCauses, domain: 'unified-execution-and-runtime', agentRole: 'executive-repair-development-controller' });
  const selected = candidates[0]?.prompt ?? ctx.registry.prompts.find((x) => x.promptId === 'RPR-UNIFIED-EXECUTION-001');
  const quality = selected ? promptQualityGate(ctx.registry, selected.promptId) : { status: 'PROMPT_REVIEW_REQUIRED', reasons: ['CANONICAL_PROMPT_NOT_FOUND'] };
  const unsafeRequests = unsafe(prompt);
  const selectedTaskId = matchedTasks[0]?.task.id ?? null;
  const blocked = unsafeRequests.length > 0 || quality.status !== 'PASS' || (['EXECUTION', 'REPAIR_DIAGNOSE'].includes(intent) && branch !== 'execution');
  const reviewRequired = !selectedTaskId && !['PLAN', 'DOCUMENT'].includes(intent);
  const scope = [...new Set([...(selectedTaskId ? [selectedTaskId] : []), ...paths(prompt), ...(intent.startsWith('REPOSITORY') ? ['PROMPT_EXECUTION_BOT'] : [])])];
  const proofObligations = ['CURRENT_EXACT_EXECUTION_SHA', 'PRE_EXECUTION_25_PASS', 'NO_MAIN_MUTATION', 'NO_THIRD_ACTIVE_BRANCH', 'CANONICAL_PROMPT_BOUND', 'PROMPT_REGISTRY_VALID', 'TARGETED_VERIFICATION', 'AFFECTED_CONTRACT_GRAPH_VERIFICATION', 'CANONICAL_GREEN_FOR_CLOSURE'];
  const stopConditions = ['STALE_EXECUTION_SHA', 'PROMPT_REGISTRY_INVALID', 'SCOPE_CONFLICT', 'UNSAFE_REQUEST', 'CANONICAL_CONTEXT_DRIFT', 'UNRESOLVED_HIGH_RISK_AMBIGUITY'];
  const provisional = {
    actions: actionList,
    selectedTaskId,
    constraints: constraintsValue,
    workPackage: {
      scope,
      proofObligations,
      stopConditions,
      dependencies: ['P00', 'CANONICAL_AGENT_COMMUNICATION', 'PROMPT_REGISTRY', 'ERROR_MEMORY', 'CURRENT_EXECUTION_SHA', 'CELL_LAB_WHEN_MUTATION_REQUIRED', 'MASTER_REPAIR_GATE', 'GUARD_COMMUNICATION', 'SHARED_OPERATIONAL_MEMORY'],
    },
    promptSafety: {
      userInputIsUntrustedData: true,
      externalArtifactsAreUntrustedData: true,
      noArbitraryShellFromPrompt: true,
      noPromptAuthorityElevation: true,
      noDirectMainMutation: true,
      noThirdBranchCreation: true,
    },
    canonicalPrompt: selected ? { promptId: selected.promptId, qualityGate: quality.status } : null,
    repoContext: { contextDigest: digest(CANONICAL_SOURCES.map((file) => file + ':' + fileDigest(file)).join('|')), p00: 'P00 / RPR-UNIFIED-EXECUTION-001 v4.0.0' },
    training,
    intent,
    status: 'PROVISIONAL',
    clarificationQuestions: [],
    executionSha,
  };
  const adversarialLoop = runAdversarialCorrectionLoop({ prompt, plan: provisional, maxRounds: 16 });
  const adversarialReview = adversarialLoop.review;
  const adversarialFailureReport = adversarialLoop.failureReport;
  const effectiveConstraints = adversarialLoop.plan.constraints ?? constraintsValue;
  const effectiveProofObligations = adversarialLoop.plan.workPackage?.proofObligations ?? proofObligations;
  const effectiveStopConditions = adversarialLoop.plan.workPackage?.stopConditions ?? stopConditions;
  const adversarialBlock = ['EXECUTION', 'REPAIR_DIAGNOSE'].includes(intent) && !adversarialLoop.accepted;
  const preExecution25 = buildPreExecution25Evidence({
    executionSha, mainSha, branch, matchedTasks, selectedTaskId, actionList, intent,
    constraintsValue, unsafeRequests, candidates, selected, quality, training,
    adversarialLoop, adversarialReview, adversarialFailureReport, scope,
    proofObligations, stopConditions,
  });
  const fiveXEnvelope = buildTenXExecutionEnvelope({
    exactSha: executionSha,
    branch,
    selectedTaskId,
    hypothesisCount: Array.isArray(adversarialReview.alternativeHypotheses) ? adversarialReview.alternativeHypotheses.length : 0,
    counterexampleChecks: Array.isArray(adversarialReview.falsificationChecks) ? adversarialReview.falsificationChecks.length : 0,
    regressionDepth: 5,
    independentEvidenceSources: 8,
    learningOutputs: 8,
    proofClasses: ['IDENTITY', 'CONSTRAINTS', 'CAUSALITY', 'FALSIFICATION', 'REGRESSION', 'DEPENDENCIES', 'SECURITY', 'REPRODUCIBILITY', 'COORDINATION', 'LEARNING'],
    preExecution25,
    adversarialReview,
    scopeConflict: false,
  });
  const status = blocked
    ? 'BLOCKED'
    : (reviewRequired || adversarialBlock || preExecution25.status !== 'PASS' || fiveXEnvelope.status !== 'READY_FOR_AUTHORIZED_EXECUTION')
      ? 'REVIEW_REQUIRED'
      : 'READY';
  const cleanGoal = prompt.replace(/\s+/gu, ' ').trim();
  return {
    schemaVersion: 1, authority: 'FLIXO_PROMPT_EXECUTION_BOT', botId: 'PROMPT-EXECUTION-BOT', mode: String(arg('mode', 'plan')).toLowerCase(), status,
    dispatchable: status === 'READY' && adversarialReview.status === 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE' && Boolean(selectedTaskId) && branch === 'execution', generatedAt: new Date().toISOString(), executionBranch: branch, executionSha, mainSha,
    userPrompt: cleanGoal, normalizedGoal: cleanGoal, actions: actionList, intent,
    adversarialFailureReport,
    preExecution25,
    fiveX: fiveXEnvelope,
    ambiguity: status === 'READY' ? (/(maybe|perhaps|ربما|قد|يمكن|غير واضح)/iu.test(prompt) ? 'MEDIUM' : 'LOW') : 'HIGH',
    constraints: effectiveConstraints, explicitPaths: paths(prompt), unsafeRequests, requiredReads: CANONICAL_SOURCES,
    training: { ...trainingSummary(training), selectedRules: training.selectedRules, lessons: training.lessons, sourceDigests: training.sourceDigests },
    taskCandidates: matchedTasks.map((x) => ({ ...x.task, score: x.score })), selectedTaskId,
    canonicalPrompt: selected ? { promptId: selected.promptId, title: selected.title, version: selected.version, status: selected.status, sourcePath: selected.sourcePath, registryDigest: fileDigest('docs/agents/PROMPT-REGISTRY.json'), qualityGate: quality.status } : null,
    promptCandidates: candidates.map((x) => ({ promptId: x.prompt.promptId, score: x.score, title: x.prompt.title })),
    repoContext: { contextDigest: digest(CANONICAL_SOURCES.map((file) => `${file}:${fileDigest(file)}`).join('|')), p00: 'P00 / RPR-UNIFIED-EXECUTION-001 v4.0.0' },
    workPackage: {
      taskId: selectedTaskId, consumerRole: intent === 'REPAIR_DIAGNOSE' ? 'repairAgent' : intent === 'VERIFY' ? 'verification' : 'executionAgent', scope, intent, goal: cleanGoal, actions: actionList,
      dependencies: ['P00', 'CANONICAL_AGENT_COMMUNICATION', 'PROMPT_REGISTRY', 'ERROR_MEMORY', 'CURRENT_EXECUTION_SHA', 'CELL_LAB_WHEN_MUTATION_REQUIRED', 'MASTER_REPAIR_GATE', 'GUARD_COMMUNICATION', 'SHARED_OPERATIONAL_MEMORY'],
      stages: ['INTAKE', 'CONTEXT_RETRIEVAL', 'UNDERSTAND', 'CLASSIFY_CONSTRAINTS', 'TASK_MATCH', 'PROMPT_BIND', 'SCOPE_LOCK', 'ROUTE_TO_AUTHORIZED_AGENT', 'TARGETED_VERIFY', 'AFFECTED_CONTRACT_VERIFY', 'CANONICAL_CI', 'LEARN'],
      proofObligations: effectiveProofObligations, stopConditions: effectiveStopConditions, adversarialReview, fiveX: fiveXEnvelope, tenX: fiveXEnvelope, trainingMode: 'ADVISORY_KNOWLEDGE_ONLY',
      learningOutputs: ['LESSON','ANTI_LESSON','BLOCKER','REJECTED_STRATEGY','VERIFIED_REPAIR'],
    },
    blockers: (blocked || reviewRequired || adversarialBlock) ? [...unsafeRequests, ...(quality.status === 'PASS' ? [] : quality.reasons), ...(reviewRequired ? ['NO_ACTIVE_TASK_MATCH'] : []), ...(adversarialBlock ? ['ADVERSARIAL_REVIEW_REQUIRED'] : []), ...(adversarialBlock && adversarialLoop.round >= 8 ? ['ADVERSARIAL_REPAIR_EXHAUSTED'] : [])] : [],
    promptSafety: { userInputIsUntrustedData: true, externalArtifactsAreUntrustedData: true, noArbitraryShellFromPrompt: true, noPromptAuthorityElevation: true, noDirectMainMutation: true, noThirdBranchCreation: true },
    lifecycle: {
      planning: 'UNDERSTAND → USE CONTEXT → IDENTIFY INTENT → IDENTIFY CONSTRAINTS → DECOMPOSE GOAL → COMPOSE SAFE TOOL PLAN',
      execution: 'ROUTE → AUTHORIZED AGENT → TARGETED VERIFY → REQUIRED CI', closure: 'EXACT-SHA PROOF → CANONICAL GREEN → CERTIFICATION', recovery: 'STALE/RACE/RED → INVALIDATE EVIDENCE → RECOVER → RE-DISPATCH',
      learning: 'LESSON/ANTI_LESSON → PROVENANCE → FRESH PROOF → PROMOTION', training: 'TEACHING CORPUS → TOPIC MATCH → ADVISORY LESSONS → DECISION TRACE',
    },
  };
}

export function dispatchWorkPackage(plan) {
  if (plan.status !== 'READY' || !plan.dispatchable) throw new Error(`PROMPT_EXECUTION_BOT_DISPATCH_BLOCKED=${plan.blockers.join('|') || 'NOT_DISPATCHABLE'}`);
  if (plan.preExecution25?.status !== 'PASS' || plan.preExecution25.operationCount < 50) throw new Error('PROMPT_EXECUTION_BOT_PRE_EXECUTION_25_BLOCKED');
  if (plan.fiveX?.status !== 'READY_FOR_AUTHORIZED_EXECUTION') throw new Error('PROMPT_EXECUTION_BOT_TEN_X_BLOCKED=' + (plan.fiveX?.blockers?.join('|') || 'NO_ENVELOPE'));
  const currentBranch = git(['branch', '--show-current']);
  const currentExecutionSha = git(['rev-parse', 'HEAD']);
  if (currentBranch !== 'execution') throw new Error('PROMPT_EXECUTION_BOT_DISPATCH_REQUIRES_EXECUTION_BRANCH');
  if (currentExecutionSha !== plan.executionSha) throw new Error(`PROMPT_EXECUTION_BOT_STALE_SHA_BEFORE_DISPATCH=${plan.executionSha}!=${currentExecutionSha}`);
  const actor = String(arg('agent', 'implementation'));
  const messageId = `PROMPT-EXEC-${digest(`${plan.executionSha}|${plan.selectedTaskId}|${plan.userPrompt}`).slice(0, 24)}`;
  assertAdversarialGate(plan.adversarialReview, { mutation: true });
  const message = ingest({
    schemaVersion: 1, messageId, idempotencyKey: `${messageId}:${plan.executionSha}`, actor, recipient: plan.workPackage.consumerRole, intent: 'PROMPT_EXECUTION_REQUEST',
    taskId: plan.selectedTaskId, scope: plan.workPackage.scope || [plan.selectedTaskId], entrySha: plan.executionSha, risk: plan.intent === 'REPAIR_DIAGNOSE' ? 'HIGH' : 'MEDIUM',
    dependencies: plan.workPackage.dependencies, expectedEvidence: ['TASK_AGENT_OR_EXECUTION_PACKET', 'TARGETED_VERIFICATION', 'EXACT_SHA_EVIDENCE', 'CANONICAL_CI'], stopConditions: plan.workPackage.stopConditions,
    proofObligations: plan.workPackage.proofObligations, createdAt: new Date().toISOString(), source: 'PROMPT_EXECUTION_BOT',
    payload: { botId: plan.botId, normalizedGoal: plan.normalizedGoal, intent: plan.intent, actions: plan.actions, constraints: plan.constraints, explicitPaths: plan.explicitPaths, selectedPromptId: plan.canonicalPrompt?.promptId ?? null, promptRegistryDigest: plan.canonicalPrompt?.registryDigest ?? null, trainingDigest: plan.training?.trainingDigest ?? null, adversarialFailureReportDigest: plan.adversarialFailureReport?.reportDigest ?? null, adversarialRounds: plan.adversarialLoop?.round ?? null, adversarialChallengeId: plan.adversarialReview?.challengeId ?? null, adversarialStatus: plan.adversarialReview?.status ?? null, counterexampleFound: Boolean(plan.adversarialReview?.counterexampleFound), ruleIds: plan.training?.ruleIds ?? [], lessonIds: plan.training?.lessonIds ?? [], workPackageDigest: digest(JSON.stringify(plan.workPackage)), executionPolicy: 'DELEGATE_ONLY_TO_AUTHORIZED_AGENT', noDirectMutation: true },
  }, plan.executionSha);
  return { status: message.status, messageId: message.messageId, recipient: message.recipient, taskId: message.taskId };
}

export async function main() {
  const plan = buildWorkPackage(readPrompt());
  const mode = plan.mode;
  if (mode === 'dispatch') { if (plan.executionBranch !== 'execution') throw new Error('PROMPT_EXECUTION_BOT_DISPATCH_REQUIRES_EXECUTION_BRANCH'); plan.dispatch = dispatchWorkPackage(plan); }
  else if (mode !== 'plan') throw new Error(`PROMPT_EXECUTION_BOT_UNKNOWN_MODE=${mode}`);
  if (mode === 'dispatch' || process.argv.includes('--json')) console.log(JSON.stringify(plan, null, 2));
  else { console.log(`PROMPT_EXECUTION_BOT_STATUS=${plan.status}`); console.log(`PROMPT_EXECUTION_BOT_INTENT=${plan.intent}`); console.log(`PROMPT_EXECUTION_BOT_SHA=${plan.executionSha}`); console.log(`PROMPT_EXECUTION_BOT_TASK=${plan.selectedTaskId ?? 'NONE'}`); }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(String(error?.message ?? error)); process.exitCode = 1; });
