#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  loadPromptRegistry, validatePromptRegistry, selectPromptCandidates, promptQualityGate,
} from './prompt-intelligence.mjs';
import { ingest } from './agent-communication.mjs';
import { buildAdversarialReview, assertAdversarialGate } from './prompt-execution-bot-adversary.mjs';
import { loadExecutionBotTraining, trainingSummary } from './prompt-execution-bot-training.mjs';

const ROOT = process.cwd();
const MAX_INPUT = Math.max(1000, Number(process.env.FLIXO_PROMPT_BOT_MAX_INPUT_CHARS ?? 12000));
export const CANONICAL_SOURCES = Object.freeze([
  'PROJECTS.md', 'المهام.md', 'AGENTS.md', 'docs/EXECUTION-BRANCH-PROTOCOL.md',
  'docs/AGENT-COLLABORATION-PROTOCOL.md', 'docs/AGENT-COORDINATION-CONTROL-PLANE.md',
  'docs/PROTOCOL-HIERARCHY.md', 'docs/PROTOCOL-REGISTRY.json',
  'docs/agents/PROMPT-REGISTRY.json', 'diagnostics/auto-repair/memory.json',
  'docs/agents/PROMPT-UNIFIED-EXECUTION.md',
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
  const status = blocked ? 'BLOCKED' : reviewRequired ? 'REVIEW_REQUIRED' : 'READY';
  const scope = [...new Set([...(selectedTaskId ? [selectedTaskId] : []), ...paths(prompt), ...(intent.startsWith('REPOSITORY') ? ['PROMPT_EXECUTION_BOT'] : [])])];
  const proofObligations = ['CURRENT_EXACT_EXECUTION_SHA', 'NO_MAIN_MUTATION', 'NO_THIRD_ACTIVE_BRANCH', 'CANONICAL_PROMPT_BOUND', 'PROMPT_REGISTRY_VALID', 'TARGETED_VERIFICATION', 'AFFECTED_CONTRACT_GRAPH_VERIFICATION', 'CANONICAL_GREEN_FOR_CLOSURE'];
  const stopConditions = ['STALE_EXECUTION_SHA', 'PROMPT_REGISTRY_INVALID', 'SCOPE_CONFLICT', 'UNSAFE_REQUEST', 'CANONICAL_CONTEXT_DRIFT', 'UNRESOLVED_HIGH_RISK_AMBIGUITY'];
  const cleanGoal = prompt.replace(/\s+/gu, ' ').trim();
  return {
    schemaVersion: 1, authority: 'FLIXO_PROMPT_EXECUTION_BOT', botId: 'PROMPT-EXECUTION-BOT', mode: String(arg('mode', 'plan')).toLowerCase(), status,
    dispatchable: status === 'READY' && Boolean(selectedTaskId) && branch === 'execution', generatedAt: new Date().toISOString(), executionBranch: branch, executionSha, mainSha,
    userPrompt: cleanGoal, normalizedGoal: cleanGoal, actions: actionList, intent,
    ambiguity: status === 'READY' ? (/(maybe|perhaps|ربما|قد|يمكن|غير واضح)/iu.test(prompt) ? 'MEDIUM' : 'LOW') : 'HIGH',
    constraints: constraintsValue, explicitPaths: paths(prompt), unsafeRequests, requiredReads: CANONICAL_SOURCES,
    training: { ...trainingSummary(training), selectedRules: training.selectedRules, lessons: training.lessons, sourceDigests: training.sourceDigests },
    taskCandidates: matchedTasks.map((x) => ({ ...x.task, score: x.score })), selectedTaskId,
    canonicalPrompt: selected ? { promptId: selected.promptId, title: selected.title, version: selected.version, status: selected.status, sourcePath: selected.sourcePath, registryDigest: fileDigest('docs/agents/PROMPT-REGISTRY.json'), qualityGate: quality.status } : null,
    promptCandidates: candidates.map((x) => ({ promptId: x.prompt.promptId, score: x.score, title: x.prompt.title })),
    repoContext: { contextDigest: digest(CANONICAL_SOURCES.map((file) => `${file}:${fileDigest(file)}`).join('|')), p00: 'P00 / RPR-UNIFIED-EXECUTION-001 v4.0.0' },
    workPackage: {
      taskId: selectedTaskId, consumerRole: intent === 'REPAIR_DIAGNOSE' ? 'repairAgent' : intent === 'VERIFY' ? 'verification' : 'executionAgent', scope, intent, goal: cleanGoal, actions: actionList,
      dependencies: ['P00', 'CANONICAL_AGENT_COMMUNICATION', 'PROMPT_REGISTRY', 'ERROR_MEMORY', 'CURRENT_EXECUTION_SHA', 'CELL_LAB_WHEN_MUTATION_REQUIRED'],
      stages: ['INTAKE', 'CONTEXT_RETRIEVAL', 'UNDERSTAND', 'CLASSIFY_CONSTRAINTS', 'TASK_MATCH', 'PROMPT_BIND', 'SCOPE_LOCK', 'ROUTE_TO_AUTHORIZED_AGENT', 'TARGETED_VERIFY', 'AFFECTED_CONTRACT_VERIFY', 'CANONICAL_CI', 'LEARN'],
      proofObligations, stopConditions, trainingMode: 'ADVISORY_KNOWLEDGE_ONLY',
      learningOutputs: ['LESSON','ANTI_LESSON','BLOCKER','REJECTED_STRATEGY','VERIFIED_REPAIR'],
    },
    blockers: blocked ? [...unsafeRequests, ...(quality.status === 'PASS' ? [] : quality.reasons), ...(reviewRequired ? ['NO_ACTIVE_TASK_MATCH'] : [])] : [],
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
  const actor = String(arg('agent', 'implementation'));
  const messageId = `PROMPT-EXEC-${digest(`${plan.executionSha}|${plan.selectedTaskId}|${plan.userPrompt}`).slice(0, 24)}`;
  assertAdversarialGate(plan.adversarialReview, { mutation: true });
  const message = ingest({
    schemaVersion: 1, messageId, idempotencyKey: `${messageId}:${plan.executionSha}`, actor, recipient: plan.workPackage.consumerRole, intent: 'PROMPT_EXECUTION_REQUEST',
    taskId: plan.selectedTaskId, scope: plan.workPackage.scope || [plan.selectedTaskId], entrySha: plan.executionSha, risk: plan.intent === 'REPAIR_DIAGNOSE' ? 'HIGH' : 'MEDIUM',
    dependencies: plan.workPackage.dependencies, expectedEvidence: ['TASK_AGENT_OR_EXECUTION_PACKET', 'TARGETED_VERIFICATION', 'EXACT_SHA_EVIDENCE', 'CANONICAL_CI'], stopConditions: plan.workPackage.stopConditions,
    proofObligations: plan.workPackage.proofObligations, createdAt: new Date().toISOString(), source: 'PROMPT_EXECUTION_BOT',
    payload: { botId: plan.botId, normalizedGoal: plan.normalizedGoal, intent: plan.intent, actions: plan.actions, constraints: plan.constraints, explicitPaths: plan.explicitPaths, selectedPromptId: plan.canonicalPrompt?.promptId ?? null, promptRegistryDigest: plan.canonicalPrompt?.registryDigest ?? null, trainingDigest: plan.training?.trainingDigest ?? null, adversarialChallengeId: plan.adversarialReview?.challengeId ?? null, adversarialStatus: plan.adversarialReview?.status ?? null, counterexampleFound: Boolean(plan.adversarialReview?.counterexampleFound), ruleIds: plan.training?.ruleIds ?? [], lessonIds: plan.training?.lessonIds ?? [], workPackageDigest: digest(JSON.stringify(plan.workPackage)), executionPolicy: 'DELEGATE_ONLY_TO_AUTHORIZED_AGENT', noDirectMutation: true },
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
