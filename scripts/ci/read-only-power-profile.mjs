#!/usr/bin/env node
export const READ_ONLY_POWER_PROFILE = Object.freeze({
  protocol: 'FLIXO-READ-ONLY-POWER-PROFILE-v1',
  profile: '5X',
  multiplier: 5,
  authority: 'READ_ONLY',
  mutationAuthority: false,
  exactShaRequired: true,
  dimensions: Object.freeze({
    runtimeEvidence: 5,
    sourceSurface: 5,
    historicalDepth: 5,
    adversarialChallenge: 5,
    knowledgeSynthesis: 5,
  }),
  budgets: Object.freeze({
    investigatorRunLimit: 400,
    investigatorMaxLogs: 175,
    vaultQueryTerms: 240,
    vaultAdviceMatches: 160,
    programmerTwinTrackedFiles: 6000,
    programmerTwinDefinitions: 600,
    programmerTwinCallersPerSymbol: 250,
    programmerTwinCalleesPerFunction: 250,
    programmerTwinEvidencePerSearch: 300,
    salientSignals: 150,
    recurringPatterns: 100,
    hypotheses: 45,
  }),
  layers: Object.freeze([
    'RUNTIME_EVIDENCE_FANOUT',
    'SOURCE_GRAPH_EXPANSION',
    'HISTORICAL_DEPTH_EXPANSION',
    'ADVERSARIAL_FALSIFICATION_EXPANSION',
    'KNOWLEDGE_SYNTHESIS_EXPANSION',
  ]),
  safety: Object.freeze([
    'NO_SOURCE_MUTATION',
    'NO_GIT_REF_MUTATION',
    'NO_CI_CONTROL_MUTATION',
    'NO_REPAIR_AUTHORITY',
    'NO_CERTIFICATION_AUTHORITY',
    'EXACT_SHA_BOUND',
  ]),
});

export function validateReadOnlyPowerProfile(profile = READ_ONLY_POWER_PROFILE) {
  const failures = [];
  if (profile?.profile !== '5X') failures.push('PROFILE_NOT_5X');
  if (profile?.multiplier !== 5) failures.push('MULTIPLIER_NOT_5');
  if (profile?.authority !== 'READ_ONLY') failures.push('AUTHORITY_NOT_READ_ONLY');
  if (profile?.mutationAuthority !== false) failures.push('MUTATION_AUTHORITY_LEAK');
  if (profile?.exactShaRequired !== true) failures.push('EXACT_SHA_REQUIREMENT_MISSING');
  if (!Array.isArray(profile?.layers) || profile.layers.length !== 5) failures.push('FIVE_LAYERS_REQUIRED');
  for (const [key, value] of Object.entries(profile?.dimensions ?? {})) {
    if (value !== 5) failures.push('DIMENSION_NOT_5=' + key);
  }
  for (const rule of profile?.safety ?? []) {
    if (!String(rule).startsWith('NO_') && rule !== 'EXACT_SHA_BOUND') failures.push('UNRECOGNIZED_SAFETY_RULE=' + rule);
  }
  return Object.freeze({ ok: failures.length === 0, failures });
}
