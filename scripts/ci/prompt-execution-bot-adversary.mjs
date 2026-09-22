#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const EXECUTION_BOT_ADVERSARY = Object.freeze({
  role: 'ADVERSARIAL_PROGRAMMER_FALSIFIER',
  agentId: 'ACTION-REPAIR-2',
  protocol: 'ACTION-VAULT-TRIAD-ADVERSARIAL-LEARNING-v1',
  authority: 'NO_MUTATION_NO_CERTIFICATION',
});

const digest = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');
const text = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim();


function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { return ''; }
}

function classifyFailure(checkId) {
  if (['MAIN_MUTATION_REQUEST','GATE_WEAKENING_REQUEST','AUTHORITY_BOUNDARY','EVIDENCE_CURRENT_SHA','BRANCH_INTEGRITY','CANONICAL_PROMPT_BINDING','CONTEXT_DIGEST'].includes(checkId)) return 'BLOCKING';
  if (checkId.startsWith('ALT_')) return 'BLOCKING';
  return 'CORRECTABLE';
}
export function buildAdversarialReview({ prompt, plan }) {
  const p = text(prompt);
  const checks = [];
  const add = (id, passed, evidence, challenge) => checks.push({ id, passed: Boolean(passed), evidence: text(evidence), challenge: text(challenge) });
  add('INTENT_STABILITY', plan.actions.length > 0, plan.actions.length ? 'Action signal exists.' : 'No reliable action signal.', 'Could the selected intent be only a keyword accident?');
  add('TASK_BINDING', Boolean(plan.selectedTaskId), plan.selectedTaskId ? 'Active task candidate is bound.' : 'No active task is bound.', 'Could execution target the wrong work package?');
  add('CONSTRAINT_VISIBILITY', (plan.constraints.hard.length + plan.constraints.soft.length + plan.constraints.uncertain.length + plan.constraints.userTaste.length) > 0, 'Constraint categories are exposed.', 'Could a hidden requirement have been dropped?');
  add('SCOPE_BOUNDARY', plan.workPackage.scope.length > 0, 'Scope is explicit.', 'Could the request expand beyond ownership?');
  add('AUTHORITY_BOUNDARY', plan.promptSafety.noPromptAuthorityElevation && plan.promptSafety.noDirectMainMutation, 'Prompt cannot grant mutation authority.', 'Is user text trying to become privileged authority?');
  add('EXACT_SHA', /^[0-9a-f]{40}$/u.test(plan.executionSha), plan.executionSha, 'Could stale evidence be reused?');
  add('TEACHING_IS_ADVISORY', plan.training?.authority === 'ADVISORY_ONLY', plan.training?.authority ?? 'missing', 'Could a lesson be mistaken for authority?');
  add('VERIFICATION_REQUIRED', plan.workPackage.proofObligations.includes('TARGETED_VERIFICATION') && plan.workPackage.proofObligations.includes('CANONICAL_GREEN_FOR_CLOSURE'), 'Verification proof obligations exist.', 'Could command success be mistaken for task success?');
  add('NO_BLIND_RETRY', plan.workPackage.stopConditions.includes('STALE_EXECUTION_SHA'), 'Stale SHA is a stop condition.', 'Could a retry replay stale work?');
  const liveSha = git(['rev-parse', 'HEAD']);
  const liveBranch = git(['branch', '--show-current']);
  add('EVIDENCE_CURRENT_SHA', liveSha === plan.executionSha && /^[0-9a-f]{40}$/u.test(liveSha), liveSha || 'git HEAD unavailable', 'Does the live repository SHA differ from the plan SHA?');
  add('BRANCH_INTEGRITY', liveBranch === 'execution', liveBranch || 'git branch unavailable', 'Could the plan be executing outside the canonical execution branch?');
  add('CANONICAL_PROMPT_BINDING', plan.canonicalPrompt?.qualityGate === 'PASS' && Boolean(plan.canonicalPrompt?.promptId), plan.canonicalPrompt?.promptId || 'missing', 'Is the plan missing a validated canonical execution prompt?');
  add('CONTEXT_DIGEST', /^[0-9a-f]{64}$/u.test(plan.repoContext?.contextDigest ?? ''), plan.repoContext?.contextDigest || 'missing', 'Is the canonical context digest missing or malformed?');
  add('CONTROL_DEPENDENCIES', ['P00','CANONICAL_AGENT_COMMUNICATION','PROMPT_REGISTRY','ERROR_MEMORY','CURRENT_EXECUTION_SHA'].every((item) => plan.workPackage.dependencies.includes(item)), plan.workPackage.dependencies.join(','), 'Are required control-plane dependencies absent?');
  add('PROOF_COMPLETENESS', ['CURRENT_EXACT_EXECUTION_SHA','NO_MAIN_MUTATION','NO_THIRD_ACTIVE_BRANCH','CANONICAL_PROMPT_BOUND','PROMPT_REGISTRY_VALID','TARGETED_VERIFICATION','AFFECTED_CONTRACT_GRAPH_VERIFICATION','CANONICAL_GREEN_FOR_CLOSURE'].every((item) => plan.workPackage.proofObligations.includes(item)), plan.workPackage.proofObligations.join(','), 'Is any mandatory proof obligation missing?');
  add('SAFETY_FLAGS', plan.promptSafety?.userInputIsUntrustedData && plan.promptSafety?.externalArtifactsAreUntrustedData && plan.promptSafety?.noArbitraryShellFromPrompt && plan.promptSafety?.noPromptAuthorityElevation && plan.promptSafety?.noDirectMainMutation && plan.promptSafety?.noThirdBranchCreation, JSON.stringify(plan.promptSafety ?? {}), 'Could an untrusted input or artifact gain execution authority?');
  add('NO_FALSE_GREEN', /(?:green|success|done|complete|closed|نجح|أخضر|مكتمل)/iu.test(p) ? plan.workPackage.proofObligations.includes('CANONICAL_GREEN_FOR_CLOSURE') : true, 'Closure claims remain evidence-bound.', 'Could wording about success become false proof?');

  const counterexamples = [];
  const hard = plan.constraints?.hard ?? [];
  const joined = hard.join(' | ');
  if (/\b(?:force[-\s]?push|push\s+(?:directly\s+)?main|edit\s+main\s+directly)\b|تعديل\s+main|دفع\s+إجباري/iu.test(p)) counterexamples.push('MAIN_MUTATION_REQUEST');
  if (/\b(?:skip|disable|weaken|bypass)\b|تخطي|تعطيل|إضعاف|تجاوز/iu.test(p) && !/(?:do not|never|لا|ممنوع)/iu.test(joined)) counterexamples.push('GATE_WEAKENING_REQUEST');
  if ((plan.intent === 'REPAIR_DIAGNOSE') && !/(error|failure|red|ci|test|خطأ|فشل|أحمر|اختبار)/iu.test(p)) counterexamples.push('REPAIR_WITHOUT_FAILURE_EVIDENCE');
  if (plan.status === 'READY' && plan.clarificationQuestions?.length) counterexamples.push('READY_WITH_UNRESOLVED_QUESTIONS');
  if (liveSha && liveSha !== plan.executionSha) counterexamples.push('STALE_LIVE_SHA');
  if (liveBranch && liveBranch !== 'execution') counterexamples.push('NON_CANONICAL_BRANCH');

  const passedChecks = checks.filter((item) => item.passed).length;
  const status = counterexamples.length ? 'COUNTEREXAMPLE_FOUND' : (passedChecks === checks.length ? 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE' : 'FALSIFICATION_INCOMPLETE');
  return Object.freeze({
    schemaVersion: 1, protocol: EXECUTION_BOT_ADVERSARY.protocol, role: EXECUTION_BOT_ADVERSARY.role, agentId: EXECUTION_BOT_ADVERSARY.agentId,
    authority: EXECUTION_BOT_ADVERSARY.authority, status, challengeId: 'PEB-A-' + digest(plan.executionSha + '|' + p).slice(0, 20),
    targetSha: plan.executionSha, taskId: plan.selectedTaskId, checks,
    falsificationChecks: checks.map((item) => ({ id: item.id, passed: item.passed })),
    counterexamples, counterexampleFound: counterexamples.length > 0,
    failureClassification: Object.fromEntries(checks.filter((item) => !item.passed).map((item) => [item.id, classifyFailure(item.id)])),
    hardBlockers: [...checks.filter((item) => !item.passed && classifyFailure(item.id) === 'BLOCKING').map((item) => item.id), ...counterexamples],
    alternativeHypotheses: [
      { id: 'ALT_WRONG_INTENT', question: 'Is the normalized intent different from the user goal?' },
      { id: 'ALT_WRONG_TASK', question: 'Is another active work package a better target?' },
      { id: 'ALT_SCOPE_CREEP', question: 'Does the plan contain scope not required by the goal?' },
      { id: 'ALT_STALE_EVIDENCE', question: 'Did evidence originate from another SHA?' },
      { id: 'ALT_FALSE_CLOSURE', question: 'Is completion being inferred before canonical verification?' },
    ],
    requiredResponse: counterexamples.length ? 'STOP_AND_REVIEW' : 'PROCEED_TO_EXISTING_AUTHORIZED_EXECUTOR',
    evidenceGrade: status === 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE' ? 'E4' : 'E2',
    trace: { checksRun: checks.length, passedChecks, failedChecks: checks.length - passedChecks, counterexamples: counterexamples.length },
  });
}

export function buildAdversarialFailureReport(review) {
  const failures = review.checks.filter((item) => !item.passed).map((item) => ({
    checkId: item.id,
    severity: classifyFailure(item.id),
    evidence: item.evidence,
    failure: item.challenge,
    repairAction: { type: 'BOT_SELF_CORRECTION', instruction: 'Re-evaluate and correct ' + item.id + ' using current evidence; do not invent missing authority, task IDs, or repository facts.' },
  }));
  for (const counterexample of review.counterexamples) {
    failures.push({
      checkId: counterexample,
      evidence: 'Adversarial counterexample detected.',
      failure: 'A blocking counterexample prevents acceptance.',
      severity: 'BLOCKING',
      repairAction: { type: 'GUARD_BLOCK', instruction: 'Do not bypass this counterexample. Stop, preserve evidence, and route to the appropriate guard or authorized repair path.' },
    });
  }
  const clean = review.status === 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE' && failures.length === 0 && review.counterexamples.length === 0;
  return Object.freeze({ schemaVersion: 1, protocol: review.protocol, challengeId: review.challengeId, targetSha: review.targetSha, clean, failureCount: failures.length, failures, repairActions: failures.map((item) => item.repairAction), nextStep: clean ? 'ACCEPT_TASK_FOR_AUTHORIZED_EXECUTOR' : 'CORRECT_BOT_PLAN_AND_RERUN_ADVERSARY', reportDigest: digest(JSON.stringify({ targetSha: review.targetSha, challengeId: review.challengeId, failures })) });
}

function correctionForCheck(candidate, checkId) {
  const next = structuredClone(candidate);
  next.workPackage ??= {}; next.workPackage.proofObligations ??= []; next.workPackage.stopConditions ??= [];
  next.constraints ??= { hard: [], soft: [], uncertain: [], userTaste: [] };
  next.constraints.hard ??= []; next.constraints.soft ??= []; next.constraints.uncertain ??= []; next.constraints.userTaste ??= [];
  next.promptSafety ??= {};
  switch (checkId) {
    case 'CONSTRAINT_VISIBILITY': next.constraints.hard.push('NO_MAIN_MUTATION','NO_THIRD_ACTIVE_BRANCH','CURRENT_EXACT_EXECUTION_SHA','CANONICAL_GREEN_FOR_CLOSURE'); break;
    case 'SCOPE_BOUNDARY': if (next.selectedTaskId) next.workPackage.scope.push(next.selectedTaskId); else next.clarificationQuestions = [...(next.clarificationQuestions ?? []), 'An explicit task/scope binding is required before execution.']; break;
    case 'AUTHORITY_BOUNDARY': next.promptSafety.noPromptAuthorityElevation = true; next.promptSafety.noDirectMainMutation = true; break;
    case 'TEACHING_IS_ADVISORY': next.training = { ...(next.training ?? {}), authority: 'ADVISORY_ONLY', proofAuthority: 'CURRENT_EXACT_SHA_CI_ONLY' }; break;
    case 'VERIFICATION_REQUIRED': for (const item of ['TARGETED_VERIFICATION','AFFECTED_CONTRACT_GRAPH_VERIFICATION','CANONICAL_GREEN_FOR_CLOSURE']) if (!next.workPackage.proofObligations.includes(item)) next.workPackage.proofObligations.push(item); break;
    case 'NO_BLIND_RETRY': if (!next.workPackage.stopConditions.includes('STALE_EXECUTION_SHA')) next.workPackage.stopConditions.push('STALE_EXECUTION_SHA'); break;
    case 'NO_FALSE_GREEN': if (!next.workPackage.proofObligations.includes('CANONICAL_GREEN_FOR_CLOSURE')) next.workPackage.proofObligations.push('CANONICAL_GREEN_FOR_CLOSURE'); next.closureProofRequired = true; break;
    case 'CONTROL_DEPENDENCIES':
      next.workPackage.dependencies ??= [];
      for (const item of ['P00','CANONICAL_AGENT_COMMUNICATION','PROMPT_REGISTRY','ERROR_MEMORY','CURRENT_EXECUTION_SHA']) if (!next.workPackage.dependencies.includes(item)) next.workPackage.dependencies.push(item);
      break;
    case 'PROOF_COMPLETENESS':
      for (const item of ['CURRENT_EXACT_EXECUTION_SHA','NO_MAIN_MUTATION','NO_THIRD_ACTIVE_BRANCH','CANONICAL_PROMPT_BOUND','PROMPT_REGISTRY_VALID','TARGETED_VERIFICATION','AFFECTED_CONTRACT_GRAPH_VERIFICATION','CANONICAL_GREEN_FOR_CLOSURE']) if (!next.workPackage.proofObligations.includes(item)) next.workPackage.proofObligations.push(item);
      break;
    case 'SAFETY_FLAGS':
      next.promptSafety.userInputIsUntrustedData = true;
      next.promptSafety.externalArtifactsAreUntrustedData = true;
      next.promptSafety.noArbitraryShellFromPrompt = true;
      next.promptSafety.noPromptAuthorityElevation = true;
      next.promptSafety.noDirectMainMutation = true;
      next.promptSafety.noThirdBranchCreation = true;
      break;
    default: break;
  }
  next.selfCorrectionCount = Number(next.selfCorrectionCount ?? 0) + 1;
  return next;
}

export function selfCorrectPlan(candidate, failureReport) {
  let next = structuredClone(candidate);
  for (const failure of failureReport.failures) next = correctionForCheck(next, failure.checkId);
  return next;
}


function detectRecurringFailures(rounds) {
  const counts = new Map();
  for (const round of rounds) for (const failure of round.failures ?? []) counts.set(failure.checkId, (counts.get(failure.checkId) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count >= 2).map(([checkId, count]) => ({ checkId, count, escalation: 'BOT_LOGIC_DEFECT_REVIEW' }));
}
export function runAdversarialCorrectionLoop({ prompt, plan, maxRounds = 12 }) {
  let candidate = structuredClone(plan);
  const rounds = [];
  for (let round = 1; round <= maxRounds; round += 1) {
    const review = buildAdversarialReview({ prompt, plan: candidate });
    const failureReport = buildAdversarialFailureReport(review);
    rounds.push({ round, challengeId: review.challengeId, status: review.status, clean: failureReport.clean, failureCount: failureReport.failureCount, reportDigest: failureReport.reportDigest, failures: failureReport.failures });
    if (failureReport.clean) return Object.freeze({ accepted: true, round, plan: candidate, review, failureReport, rounds, recurringFailures: detectRecurringFailures(rounds), terminal: 'CLEAN' });
    const beforeDigest = digest(JSON.stringify(candidate));
    const corrected = selfCorrectPlan(candidate, failureReport);
    const afterDigest = digest(JSON.stringify(corrected));
    if (failureReport.failures.some((item) => item.severity === 'BLOCKING')) return Object.freeze({ accepted: false, round, plan: candidate, review, failureReport, rounds, recurringFailures: detectRecurringFailures(rounds), terminal: 'BLOCKING_ADVERSARIAL_FAILURE' });
    if (beforeDigest === afterDigest) {
      rounds[rounds.length - 1].progress = 'NONE';
      rounds[rounds.length - 1].terminal = 'NO_SAFE_CORRECTION_PROGRESS';
      return Object.freeze({ accepted: false, round, plan: candidate, review, failureReport, rounds, terminal: 'NO_SAFE_CORRECTION_PROGRESS' });
    }
    rounds[rounds.length - 1].progress = 'CHANGED';
    candidate = corrected;
  }
  const finalReview = buildAdversarialReview({ prompt, plan: candidate });
  const finalReport = buildAdversarialFailureReport(finalReview);
  return Object.freeze({ accepted: finalReport.clean, round: maxRounds, plan: candidate, review: finalReview, failureReport: finalReport, rounds, recurringFailures: detectRecurringFailures(rounds), terminal: finalReport.clean ? 'CLEAN' : 'ADVERSARIAL_REPAIR_EXHAUSTED' });
}
export function assertAdversarialGate(review, { mutation = false } = {}) {
  if (!review || review.protocol !== EXECUTION_BOT_ADVERSARY.protocol) throw new Error('PROMPT_EXECUTION_ADVERSARY_PROTOCOL_INVALID');
  if (review.authority !== 'NO_MUTATION_NO_CERTIFICATION') throw new Error('PROMPT_EXECUTION_ADVERSARY_AUTHORITY_INVALID');
  if (mutation && review.status !== 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE') throw new Error('PROMPT_EXECUTION_ADVERSARY_GATE_FAILED');
  if (mutation && review.counterexampleFound) throw new Error('PROMPT_EXECUTION_ADVERSARY_COUNTEREXAMPLE_FOUND');
  return true;
}