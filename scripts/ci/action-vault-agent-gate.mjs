#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { validateCodeMentorProfile } from './action-code-mentor.mjs';

export const EXPECTED_BOTS = Object.freeze([
  'ACTION-REPAIR',
  'ACTION-REPAIR-2',
  'ACTION-HISTORIAN-3',
]);

const ROLE_BY_BOT = Object.freeze({
  'ACTION-REPAIR': 'PRIMARY_PROGRAMMING_REPAIR_OWNER',
  'ACTION-REPAIR-2': 'HISTORICAL_INDEX_EXPLORER_AND_PREDICTOR',
  'ACTION-HISTORIAN-3': 'FAILURE_LEDGER_AND_LEARNING_RECORDER',
});

const ROOT = process.cwd();
const VAULT = path.resolve(ROOT, 'diagnostics/auto-repair/action-vault');
const BOT_DIR = path.resolve(ROOT, 'diagnostics/auto-repair/action-repair-bots');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const exists = (file) => fs.existsSync(file);
const err = (errors, code, detail = '') => errors.push(detail ? code + '=' + detail : code);

export function validateBotProfile(profile) {
  const errors = [];
  const id = profile?.botId;
  if (!EXPECTED_BOTS.includes(id)) err(errors, 'BOT_ID_INVALID', String(id));
  if (profile?.permanentIndependentAuthority !== false) err(errors, 'INDEPENDENT_AUTHORITY_NOT_DISABLED', String(id));
  if (profile?.transferableKnowledgeOnly !== true) err(errors, 'KNOWLEDGE_TRANSFER_BOUNDARY_MISSING', String(id));
  if (profile?.intelligenceProfileRef !== 'diagnostics/auto-repair/action-vault/ACTION-THREE-BOT-INTELLIGENCE.json') {
    err(errors, 'INTELLIGENCE_PROFILE_MISMATCH', String(id));
  }
  if (profile?.cooperationMode !== 'MANDATORY_SHARED_MISSION_ON_RED') err(errors, 'MANDATORY_COOPERATION_MISSING', String(id));
  const grade = profile?.agentGrade;
  if (!grade || grade.lifecycle !== 'READY') err(errors, 'AGENT_GRADE_NOT_READY', String(id));
  if (!grade?.shortName || !/^[A-Z0-9_-]{2,16}$/u.test(grade.shortName)) err(errors, 'SHORT_NAME_INVALID', String(id));
  if (!Number.isInteger(grade?.upgradeNumber) || grade.upgradeNumber < 1) err(errors, 'UPGRADE_NUMBER_INVALID', String(id));
  if (!Number.isInteger(grade?.upgradePriority) || grade.upgradePriority < 1 || grade.upgradePriority > 100) err(errors, 'UPGRADE_PRIORITY_INVALID', String(id));
  if (!grade?.nextUpgrade?.id || !grade?.nextUpgrade?.weakness) err(errors, 'NEXT_UPGRADE_INVALID', String(id));
  if (!Array.isArray(profile?.requiredCollaborators) || profile.requiredCollaborators.length !== 2) err(errors, 'COLLABORATOR_SET_INVALID', String(id));
  return errors;
}

export function validateThreeBotIntelligence(profile, bots) {
  const errors = [];
  if (profile?.schemaVersion !== 4) err(errors, 'INTELLIGENCE_SCHEMA_INVALID');
  if (profile?.parity?.model !== 'ROLE_SPECIALIZATION_WITH_SHARED_SAFETY' ||
      profile?.parity?.commonSafetyEqual !== true ||
      profile?.parity?.commonIdentityBindingEqual !== true ||
      profile?.parity?.roleCapabilitiesEqual !== false) {
    err(errors, 'ROLE_SPECIALIZATION_CONTRACT_INVALID');
  }
  const matrix = profile?.roleMatrix ?? {};
  if (matrix['ACTION-REPAIR']?.mission !== 'THINK_AS_PROGRAMMER_AND_APPLY_BOUNDED_SOURCE_REPAIR') err(errors, 'PROGRAMMER_ROLE_MISSION_INVALID');
  if (matrix['ACTION-REPAIR-2']?.mission !== 'SEARCH_HISTORICAL_INDEX_AND_ACTION_REPAIR_CATALOG_THEN_PREDICT_A_CANDIDATE_SOLUTION') err(errors, 'PREDICTOR_ROLE_MISSION_INVALID');
  if (matrix['ACTION-HISTORIAN-3']?.mission !== 'RECORD_EVERY_FAILURE_ATTEMPT_HANDOFF_AND_VERIFIED_OUTCOME_FOR_LIFELONG_REPAIR_MEMORY') err(errors, 'HISTORIAN_ROLE_MISSION_INVALID');
  if (profile?.cooperation?.enabled !== true) err(errors, 'COOPERATION_DISABLED');
  if (JSON.stringify(profile?.cooperation?.participants ?? []) !== JSON.stringify(EXPECTED_BOTS)) err(errors, 'PARTICIPANT_SET_INVALID');
  if (profile?.cooperation?.authority?.taskOwnership !== 'single_active_programming_owner') err(errors, 'SINGLE_OWNER_POLICY_MISSING');
  if (profile?.cooperation?.authority?.repairOwner !== 'ACTION-REPAIR') err(errors, 'PROGRAMMER_OWNER_INVALID');
  if (profile?.cooperation?.authority?.predictionOwner !== 'ACTION-REPAIR-2') err(errors, 'PREDICTOR_OWNER_INVALID');
  if (profile?.cooperation?.authority?.noParallelSourceMutation !== true) err(errors, 'PARALLEL_SOURCE_MUTATION_NOT_BLOCKED');
  if (profile?.safetyBoundary?.intelligenceDoesNotImplyMutationAuthority !== true) err(errors, 'INTELLIGENCE_AUTHORITY_BOUNDARY_MISSING');
  if (profile?.safetyBoundary?.canonicalCiRemainsProofAuthority !== true) err(errors, 'CANONICAL_PROOF_AUTHORITY_MISSING');
  if (profile?.safetyBoundary?.exactShaRequiredForActionableDecision !== true) err(errors, 'EXACT_SHA_REQUIREMENT_MISSING');
  if (profile?.safetyBoundary?.testMutationForbidden !== true) err(errors, 'TEST_MUTATION_BOUNDARY_MISSING');
  if (profile?.safetyBoundary?.mainMutationForbidden !== true) err(errors, 'MAIN_MUTATION_BOUNDARY_MISSING');
  if (profile?.safetyBoundary?.externalFailureCannotBecomeInternalRepair !== true) err(errors, 'EXTERNAL_FAILURE_BOUNDARY_MISSING');

  const members = new Map((profile?.members ?? []).map((item) => [item.id, item]));
  for (const bot of EXPECTED_BOTS) {
    const member = members.get(bot);
    if (!member) err(errors, 'MEMBER_MISSING', bot);
    else if (member.role !== ROLE_BY_BOT[bot]) err(errors, 'MEMBER_ROLE_MISMATCH', bot);
  }
  const profileBotIds = bots.map((bot) => bot.botId);
  if (JSON.stringify(profileBotIds) !== JSON.stringify(EXPECTED_BOTS)) err(errors, 'BOT_PROFILE_SET_MISMATCH');
  return errors;
}

export function validateResidency(policy) {
  const errors = [];
  if (policy?.schemaVersion !== 1) err(errors, 'RESIDENCY_SCHEMA_INVALID');
  if (JSON.stringify(policy?.residents ?? []) !== JSON.stringify(EXPECTED_BOTS)) err(errors, 'RESIDENT_SET_INVALID');
  if (policy?.residency?.alwaysResident !== true) err(errors, 'ALWAYS_RESIDENT_DISABLED');
  if (policy?.residency?.leaveVault !== false) err(errors, 'VAULT_EXIT_NOT_BLOCKED');
  if (policy?.residency?.idleState !== 'RESIDENT_READY') err(errors, 'IDLE_STATE_INVALID');
  if (policy?.residency?.taskMustRemainOpenUntil !== 'CANONICAL_GREEN') err(errors, 'TASK_CLOSURE_POLICY_INVALID');
  if (policy?.operations?.greenAuthority !== 'DAILY_FLIXO_GREEN_GATE') err(errors, 'GREEN_AUTHORITY_INVALID');
  if (policy?.automaticVisits?.botCount !== 3 || policy?.automaticVisits?.visitsPerBotPerDay !== 3) err(errors, 'VISIT_POLICY_INVALID');
  return errors;
}

export function validateExecutionBoundaries(profiles) {
  const errors = [];
  const primary = profiles.find((x) => x.botId === 'ACTION-REPAIR');
  const secondary = profiles.find((x) => x.botId === 'ACTION-REPAIR-2');
  const historian = profiles.find((x) => x.botId === 'ACTION-HISTORIAN-3');

  if (primary?.executionBoundary?.singleActiveRepairOwner !== true) err(errors, 'SINGLE_OWNER_ENFORCEMENT_MISSING', primary?.botId);
  if (primary?.executionBoundary?.canMutateWhenOwner !== true) err(errors, 'PRIMARY_OWNER_MUTATION_DISABLED');
  if (primary?.executionBoundary?.canMutateTests !== false) err(errors, 'PRIMARY_TEST_MUTATION_ENABLED');
  if (primary?.executionBoundary?.canMutateMain !== false) err(errors, 'PRIMARY_MAIN_MUTATION_ENABLED');
  if (primary?.executionBoundary?.canonicalGreen !== 'DAILY_FLIXO_GREEN_GATE') err(errors, 'PRIMARY_CANONICAL_GREEN_INVALID');
  if (secondary?.executionAuthority !== 'HISTORICAL_PREDICTION_PROPOSAL_ONLY') err(errors, 'SECONDARY_EXECUTION_ROLE_INVALID');
  if (secondary?.mutationAuthority !== false) err(errors, 'SECONDARY_MUTATION_AUTHORITY_ENABLED');
  if (secondary?.executionBoundary?.canMutateWhenOwner !== false) err(errors, 'SECONDARY_OWNER_MUTATION_ENABLED');
  if (secondary?.executionBoundary?.canMutateTests !== false) err(errors, 'SECONDARY_TEST_MUTATION_ENABLED');
  if (secondary?.executionBoundary?.canMutateMain !== false) err(errors, 'SECONDARY_MAIN_MUTATION_ENABLED');

  if (primary?.executionContract?.mutationBranch !== 'execution' ||
      primary?.executionContract?.mutationScope !== 'ERROR_ONLY' ||
      primary?.executionContract?.exactShaRequired !== true ||
      primary?.executionContract?.reproduceBeforeMutation !== true ||
      primary?.executionContract?.targetedRegressionRequired !== true ||
      primary?.executionContract?.canonicalGreenRequired !== true) {
    err(errors, 'PRIMARY_EXECUTION_CONTRACT_WEAK');
  }

  if (secondary?.rules?.requireOwnerReviewBeforeMutation !== true || secondary?.rules?.producePredictionPacket !== true || secondary?.rules?.searchHistoricalIndexBeforeProposal !== true) {
    err(errors, 'SECONDARY_PREDICTION_CONTRACT_WEAK');
  }

  if (historian?.mutationAuthority !== false ||
      historian?.canMutateSource !== false ||
      historian?.canDispatchRepair !== false ||
      historian?.executionAuthority !== 'RECORD_INDEX_ESCALATE_ONLY' ||
      historian?.executionBoundary?.sourceMutation !== false ||
      historian?.executionBoundary?.testMutation !== false) {
    err(errors, 'HISTORIAN_MUTATION_BOUNDARY_WEAK');
  }
  if (historian?.repositoryWriteScope !== 'ACTION_VAULT_MEMORY_ONLY') err(errors, 'HISTORIAN_WRITE_SCOPE_TOO_BROAD');
  return errors;
}

export function runGate(root = ROOT) {
  const vault = path.resolve(root, 'diagnostics/auto-repair/action-vault');
  const botDir = path.resolve(root, 'diagnostics/auto-repair/action-repair-bots');
  const errors = [];
  const warnings = [];

  const profilePath = path.join(vault, 'ACTION-THREE-BOT-INTELLIGENCE.json');
  const residencyPath = path.join(vault, 'ACTION-RESIDENCY-POLICY.json');
  const gradePath = path.join(vault, 'ACTION-VAULT-AGENT-GRADE.json');
  const mentorPath = path.join(vault, 'ACTION-CODE-MENTOR.json');
  const parallelProtocolPath = path.resolve(root, 'docs/agents/ACTION-VAULT-PARALLEL-COLLABORATION-PROTOCOL.md');
  const sleepAdmissionPath = path.resolve(root, 'scripts/ci/action-vault-sleep-admission.mjs');
  const collaborationScriptPath = path.resolve(root, 'scripts/ci/action-three-bot-collaboration.mjs');
  const targetedProtocolPath = path.resolve(root, 'docs/agents/ACTION-VAULT-TARGETED-REPAIR-PROTOCOL.md');
  const targetedPlannerPath = path.resolve(root, 'scripts/ci/action-vault-targeted-test.mjs');
  const targetedTestPath = path.resolve(root, 'scripts/ci/test-action-vault-targeted-test.mjs');

  for (const file of [profilePath, residencyPath, gradePath, parallelProtocolPath, sleepAdmissionPath, collaborationScriptPath, targetedProtocolPath, targetedPlannerPath, targetedTestPath]) {
    if (!exists(file)) err(errors, 'REQUIRED_VAULT_CONTRACT_MISSING', path.relative(root, file));
  }

  const profiles = EXPECTED_BOTS.map((bot) => {
    const file = path.join(botDir, bot + '.json');
    if (!exists(file)) {
      err(errors, 'BOT_PROFILE_MISSING', bot);
      return null;
    }
    try { return readJson(file); } catch (error) {
      err(errors, 'BOT_PROFILE_INVALID_JSON', bot);
      return null;
    }
  }).filter(Boolean);

  let intelligence = null;
  let residency = null;
  let grade = null;
  let mentor = null;
  try { if (exists(profilePath)) intelligence = readJson(profilePath); } catch { err(errors, 'INTELLIGENCE_PROFILE_INVALID_JSON'); }
  try { if (exists(residencyPath)) residency = readJson(residencyPath); } catch { err(errors, 'RESIDENCY_POLICY_INVALID_JSON'); }
  try { if (exists(gradePath)) grade = readJson(gradePath); } catch { err(errors, 'AGENT_GRADE_INVALID_JSON'); }
  try { if (exists(mentorPath)) mentor = readJson(mentorPath); } catch { err(errors, 'CODE_MENTOR_INVALID_JSON'); }

  for (const profile of profiles) errors.push(...validateBotProfile(profile));
  if (mentor) errors.push(...validateCodeMentorProfile(mentor));
  else err(errors, 'CODE_MENTOR_PROFILE_MISSING');
  if (intelligence) errors.push(...validateThreeBotIntelligence(intelligence, profiles));
  if (residency) errors.push(...validateResidency(residency));
  errors.push(...validateExecutionBoundaries(profiles));

  if (grade) {
    if (grade.schemaVersion !== 1) err(errors, 'AGENT_GRADE_SCHEMA_INVALID');
    if (JSON.stringify(grade.residents ?? []) !== JSON.stringify(EXPECTED_BOTS)) err(errors, 'AGENT_GRADE_RESIDENT_SET_INVALID');
    if (grade.proofAuthority !== 'DAILY_FLIXO_GREEN_GATE') err(errors, 'AGENT_GRADE_PROOF_AUTHORITY_INVALID');
    if (grade.mutationModel !== 'SINGLE_ACTIVE_OWNER_ON_EXECUTION') err(errors, 'AGENT_GRADE_MUTATION_MODEL_INVALID');
    if (grade.learningModel !== 'UNVERIFIED_IN_SESSION; VERIFIED_ONLY_AFTER_GREEN') err(errors, 'AGENT_GRADE_LEARNING_MODEL_INVALID');
    if (grade.trustRequirements?.length !== 8) err(errors, 'AGENT_GRADE_TRUST_REQUIREMENTS_INVALID');
    if (grade.rules?.failedAttemptDoesNotCloseMission !== true) err(errors, 'AGENT_GRADE_FAILED_ATTEMPT_CLOSURE_INVALID');
    if (grade.rules?.noFalseGreen !== true) err(errors, 'AGENT_GRADE_FALSE_GREEN_RULE_MISSING');
  }

  if (residency) {
    if (residency.schemaVersion !== 2) err(errors, 'RESIDENCY_VERSION_INVALID');
    if (residency.residency?.noSleepBeforeGreen !== true) err(errors, 'NO_SLEEP_BEFORE_GREEN_MISSING');
    if (residency.residency?.noIdleBeforeGreen !== true) err(errors, 'NO_IDLE_BEFORE_GREEN_MISSING');
    if (residency.sleepAdmission?.required !== true) err(errors, 'SLEEP_ADMISSION_REQUIRED_MISSING');
    if (residency.sleepAdmission?.exactShaRequired !== true) err(errors, 'SLEEP_EXACT_SHA_REQUIRED_MISSING');
    if (residency.sleepAdmission?.openWorkBlocksSleep !== true) err(errors, 'SLEEP_OPEN_WORK_BLOCK_MISSING');
    if (residency.automaticVisits?.visitModes?.includes('EXCHANGE') !== true) err(errors, 'RESIDENCY_EXCHANGE_VISIT_MISSING');
  }

  if (intelligence?.cooperation?.mentorship?.enabled !== true) err(errors, 'CODE_MENTOR_COOPERATION_MISSING');
  if (intelligence?.cooperation?.mentorship?.parentBot !== 'ACTION-REPAIR') err(errors, 'CODE_MENTOR_PARENT_INVALID');
  if (intelligence?.cooperation?.mentorship?.readOnly !== true) err(errors, 'CODE_MENTOR_READ_ONLY_MISSING');
  if (intelligence?.cooperation?.mentorship?.promotedOnlyAfterCanonicalGreen !== true) err(errors, 'CODE_MENTOR_GREEN_PROMOTION_MISSING');
  if (intelligence?.cooperation?.parallelExecution?.cognitiveParallelism !== true) err(errors, 'PARALLEL_COGNITIVE_MODE_MISSING');
  if (intelligence?.cooperation?.parallelExecution?.sourceMutationParallelism !== false) err(errors, 'PARALLEL_SOURCE_MUTATION_MUST_REMAIN_FALSE');
  if (intelligence?.cooperation?.parallelExecution?.allThreeContributionsRequired !== true) err(errors, 'ALL_THREE_CONTRIBUTIONS_REQUIRED_MISSING');
  if (intelligence?.cooperation?.parallelExecution?.exchangeBeforeMutation !== true) err(errors, 'EXCHANGE_BEFORE_MUTATION_MISSING');
  if (intelligence?.cooperation?.parallelExecution?.peerLearningReceiptsRequired !== true) err(errors, 'PEER_LEARNING_RECEIPTS_MISSING');
  if (intelligence?.cooperation?.sharedLearning?.promotedOnlyAfterCanonicalGreen !== true) err(errors, 'GREEN_ONLY_SHARED_LEARNING_MISSING');

  if (exists(targetedProtocolPath)) {
    const targetedProtocol = fs.readFileSync(targetedProtocolPath, 'utf8');
    if (!targetedProtocol.includes('TARGETED REGRESSION')) err(errors, 'TARGETED_REGRESSION_PROTOCOL_MISSING');
    if (!targetedProtocol.includes('EXACT-SHA')) err(errors, 'TARGETED_EXACT_SHA_RULE_MISSING');
    if (!targetedProtocol.includes('Canonical CI')) err(errors, 'TARGETED_CANONICAL_CI_RULE_MISSING');
  }
  if (exists(targetedPlannerPath)) {
    const targetedPlanner = fs.readFileSync(targetedPlannerPath, 'utf8');
    if (!targetedPlanner.includes('fullSuiteRequired:false')) err(errors, 'TARGETED_PLANNER_FULL_SUITE_FLAG_MISSING');
    if (!targetedPlanner.includes('ACTION-VAULT-TARGETED-REPAIR-v1')) err(errors, 'TARGETED_PLANNER_PROTOCOL_ID_MISSING');
  }

  const sharedRefs = intelligence?.sharedSources ?? [];
  for (const ref of sharedRefs) {
    if (!exists(path.resolve(root, ref))) warnings.push('SHARED_SOURCE_MISSING=' + ref);
  }

  const result = {
    schemaVersion: 1,
    authority: 'ACTION_VAULT_AGENT_GRADE_GATE',
    status: errors.length ? 'FAIL' : 'PASS',
    botCount: profiles.length,
    bots: profiles.map((x) => ({
      botId: x.botId,
      shortName: x.agentGrade?.shortName ?? null,
      lifecycle: x.agentGrade?.lifecycle ?? null,
      upgradeNumber: x.agentGrade?.upgradeNumber ?? null,
      upgradePriority: x.agentGrade?.upgradePriority ?? null,
      weakness: x.agentGrade?.nextUpgrade?.weakness ?? null,
      role: x.role ?? null,
    })),
    warnings,
    errors,
    checkedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(path.resolve(root, 'diagnostics/auto-repair/action-vault/agent-grade-validation.json')), { recursive: true });
  fs.writeFileSync(path.resolve(root, 'diagnostics/auto-repair/action-vault/agent-grade-validation.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runGate();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exit(1);
}
