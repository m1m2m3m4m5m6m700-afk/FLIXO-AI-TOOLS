#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

export const EXPECTED_BOTS = Object.freeze([
  'ACTION-REPAIR',
  'ACTION-REPAIR-2',
  'ACTION-HISTORIAN-3',
]);

const ROLE_BY_BOT = Object.freeze({
  'ACTION-REPAIR': 'PRIMARY_REPAIR_OWNER',
  'ACTION-REPAIR-2': 'SECONDARY_REPAIR_OWNER',
  'ACTION-HISTORIAN-3': 'HISTORIAN_AND_SOLUTION_INDEXER',
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
  if (profile?.schemaVersion !== 1) err(errors, 'INTELLIGENCE_SCHEMA_INVALID');
  if (profile?.parity?.cognitiveCapabilitiesEqual !== true ||
      profile?.parity?.knowledgeSourcesEqual !== true ||
      profile?.parity?.reasoningModesEqual !== true ||
      profile?.parity?.searchAccessEqual !== true ||
      profile?.parity?.learningAccessEqual !== true ||
      profile?.parity?.explorationAccessEqual !== true ||
      profile?.parity?.challengeAccessEqual !== true ||
      profile?.parity?.taskAssignmentAwarenessEqual !== true ||
      profile?.parity?.resultInterpretationEqual !== true ||
      profile?.parity?.rcaCapabilityEqual !== true ||
      profile?.parity?.inferenceFallbackEqual !== true) {
    err(errors, 'CAPABILITY_PARITY_INVALID');
  }
  if (profile?.cooperation?.enabled !== true) err(errors, 'COOPERATION_DISABLED');
  if (JSON.stringify(profile?.cooperation?.participants ?? []) !== JSON.stringify(EXPECTED_BOTS)) err(errors, 'PARTICIPANT_SET_INVALID');
  if (profile?.cooperation?.authority?.taskOwnership !== 'single_active_repair_owner') err(errors, 'SINGLE_OWNER_POLICY_MISSING');
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

  for (const bot of [primary, secondary]) {
    if (bot?.executionBoundary?.singleActiveRepairOwner !== true) err(errors, 'SINGLE_OWNER_ENFORCEMENT_MISSING', bot?.botId);
    if (bot?.executionBoundary?.canMutateTests !== false) err(errors, 'TEST_MUTATION_ENABLED', bot?.botId);
    if (bot?.executionBoundary?.canMutateMain !== false) err(errors, 'MAIN_MUTATION_ENABLED', bot?.botId);
    if (bot?.executionBoundary?.canonicalGreen !== 'DAILY_FLIXO_GREEN_GATE') err(errors, 'CANONICAL_GREEN_INVALID', bot?.botId);
  }

  if (primary?.executionContract?.mutationBranch !== 'execution' ||
      primary?.executionContract?.mutationScope !== 'ERROR_ONLY' ||
      primary?.executionContract?.exactShaRequired !== true ||
      primary?.executionContract?.reproduceBeforeMutation !== true ||
      primary?.executionContract?.targetedRegressionRequired !== true ||
      primary?.executionContract?.canonicalGreenRequired !== true) {
    err(errors, 'PRIMARY_EXECUTION_CONTRACT_WEAK');
  }

  if (secondary?.rules?.handoffActivatesOwnership !== true || secondary?.executionBoundary?.canMutateBeforeHandoff !== false) {
    err(errors, 'SECONDARY_HANDOFF_BOUNDARY_WEAK');
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

  for (const file of [profilePath, residencyPath, gradePath]) {
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
  try { if (exists(profilePath)) intelligence = readJson(profilePath); } catch { err(errors, 'INTELLIGENCE_PROFILE_INVALID_JSON'); }
  try { if (exists(residencyPath)) residency = readJson(residencyPath); } catch { err(errors, 'RESIDENCY_POLICY_INVALID_JSON'); }
  try { if (exists(gradePath)) grade = readJson(gradePath); } catch { err(errors, 'AGENT_GRADE_INVALID_JSON'); }

  for (const profile of profiles) errors.push(...validateBotProfile(profile));
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
