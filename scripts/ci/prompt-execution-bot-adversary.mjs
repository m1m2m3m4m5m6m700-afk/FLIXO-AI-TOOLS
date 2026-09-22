#!/usr/bin/env node
import { createHash } from 'node:crypto';

export const EXECUTION_BOT_ADVERSARY = Object.freeze({
  role: 'ADVERSARIAL_PROGRAMMER_FALSIFIER',
  agentId: 'ACTION-REPAIR-2',
  protocol: 'ACTION-VAULT-TRIAD-ADVERSARIAL-LEARNING-v1',
  authority: 'NO_MUTATION_NO_CERTIFICATION',
});

const digest = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');
const text = (value) => String(value ?? '').replace(/\s+/gu, ' ').trim();

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
  add('NO_FALSE_GREEN', /(?:green|success|done|complete|closed|نجح|أخضر|مكتمل)/iu.test(p) ? plan.workPackage.proofObligations.includes('CANONICAL_GREEN_FOR_CLOSURE') : true, 'Closure claims remain evidence-bound.', 'Could wording about success become false proof?');

  const counterexamples = [];
  const hard = plan.constraints?.hard ?? [];
  const joined = hard.join(' | ');
  if (/\b(?:force[-\s]?push|push\s+(?:directly\s+)?main|edit\s+main\s+directly)\b|تعديل\s+main|دفع\s+إجباري/iu.test(p)) counterexamples.push('MAIN_MUTATION_REQUEST');
  if (/\b(?:skip|disable|weaken|bypass)\b|تخطي|تعطيل|إضعاف|تجاوز/iu.test(p) && !/(?:do not|never|لا|ممنوع)/iu.test(joined)) counterexamples.push('GATE_WEAKENING_REQUEST');
  if ((plan.intent === 'REPAIR_DIAGNOSE') && !/(error|failure|red|ci|test|خطأ|فشل|أحمر|اختبار)/iu.test(p)) counterexamples.push('REPAIR_WITHOUT_FAILURE_EVIDENCE');
  if (plan.status === 'READY' && plan.clarificationQuestions?.length) counterexamples.push('READY_WITH_UNRESOLVED_QUESTIONS');

  const passedChecks = checks.filter((item) => item.passed).length;
  const status = counterexamples.length ? 'COUNTEREXAMPLE_FOUND' : (passedChecks === checks.length ? 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE' : 'FALSIFICATION_INCOMPLETE');
  return Object.freeze({
    schemaVersion: 1, protocol: EXECUTION_BOT_ADVERSARY.protocol, role: EXECUTION_BOT_ADVERSARY.role, agentId: EXECUTION_BOT_ADVERSARY.agentId,
    authority: EXECUTION_BOT_ADVERSARY.authority, status, challengeId: 'PEB-A-' + digest(plan.executionSha + '|' + p).slice(0, 20),
    targetSha: plan.executionSha, taskId: plan.selectedTaskId, checks,
    falsificationChecks: checks.map((item) => ({ id: item.id, passed: item.passed })),
    counterexamples, counterexampleFound: counterexamples.length > 0,
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

export function assertAdversarialGate(review, { mutation = false } = {}) {
  if (!review || review.protocol !== EXECUTION_BOT_ADVERSARY.protocol) throw new Error('PROMPT_EXECUTION_ADVERSARY_PROTOCOL_INVALID');
  if (review.authority !== 'NO_MUTATION_NO_CERTIFICATION') throw new Error('PROMPT_EXECUTION_ADVERSARY_AUTHORITY_INVALID');
  if (mutation && review.status !== 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE') throw new Error('PROMPT_EXECUTION_ADVERSARY_GATE_FAILED');
  if (mutation && review.counterexampleFound) throw new Error('PROMPT_EXECUTION_ADVERSARY_COUNTEREXAMPLE_FOUND');
  return true;
}