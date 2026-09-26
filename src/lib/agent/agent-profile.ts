/**
 * FLIXO Agent Platform — advisory runtime profiles.
 *
 * Profiles describe specialization and intended reasoning scope.
 * They NEVER grant mutation, merge, dispatch, or certification authority;
 * those permissions remain governed by the canonical control-plane contracts.
 */
export type AgentAuthorityBinding = 'CANONICAL_CONTROL_PLANE';
export type AgentRuntimeMode = 'NATIVE' | 'EXTERNAL_ADAPTER' | 'READ_ONLY';

export type AgentProfile = Readonly<{
  id: string;
  purpose: string;
  runtimeMode: AgentRuntimeMode;
  lenses: readonly string[];
  skills: readonly string[];
  authorityBinding: AgentAuthorityBinding;
  doesNotGrantAuthority: true;
}>;

const define = (
  id: string,
  purpose: string,
  lenses: readonly string[],
  skills: readonly string[],
  runtimeMode: AgentRuntimeMode = 'NATIVE',
): AgentProfile => Object.freeze({
  id,
  purpose,
  runtimeMode,
  lenses: Object.freeze([...lenses]),
  skills: Object.freeze([...skills]),
  authorityBinding: 'CANONICAL_CONTROL_PLANE',
  doesNotGrantAuthority: true,
});

export const AGENT_PROFILES: readonly AgentProfile[] = Object.freeze([
  define('analysis', 'Root-cause and hypothesis analysis.', ['ROOT_CAUSE_ANALYSIS', 'HYPOTHESIS_DISCRIMINATION', 'DECISION_CALIBRATION'], ['reasoning', 'evidence']),
  define('codeScout', 'Dependency and minimal-change repository exploration.', ['DEPENDENCY_IMPACT_REASONING', 'CHANGE_IMPACT_SIMULATION'], ['code-scout', 'repository-read']),
  define('errorAgent', 'Failure classification and temporal evidence analysis.', ['ROOT_CAUSE_ANALYSIS', 'EVIDENCE_PROVENANCE', 'TEMPORAL_STATE_REASONING'], ['error-investigation', 'evidence']),
  define('repairAgent', 'Bounded repair planning and recovery selection.', ['ROOT_CAUSE_ANALYSIS', 'RECOVERY_REASONING', 'RECURRENCE_PREVENTION'], ['repair', 'regression']),
  define('executionAgent', 'Canonical user-intent execution through verified capabilities.', ['HUMAN_INTENT_MODELING', 'TOOL_SELECTION_REASONING', 'EVIDENCE_PROVENANCE'], ['execution', 'verification']),
  define('reviewAgent', 'Independent adversarial and regression review.', ['ADVERSARIAL_FALSIFICATION', 'REGRESSION_REASONING', 'NEGATIVE_PROOF_REASONING'], ['review', 'red-team'], 'READ_ONLY'),
  define('testAgent', 'Regression and verification design.', ['REGRESSION_REASONING', 'EVIDENCE_PROVENANCE', 'FAILURE_TAXONOMY'], ['testing', 'e2e']),
  define('securityAgent', 'Security-boundary and trust analysis.', ['SECURITY_BOUNDARY_REASONING', 'ADVERSARIAL_FALSIFICATION'], ['security', 'red-team'], 'READ_ONLY'),
  define('performanceAgent', 'Performance and dependency-impact analysis.', ['PERFORMANCE_REASONING', 'DEPENDENCY_IMPACT_REASONING'], ['performance', 'profiling']),
  define('certificationAuthority', 'Evidence and exact-SHA certification analysis.', ['EVIDENCE_PROVENANCE', 'TEMPORAL_STATE_REASONING', 'NEGATIVE_PROOF_REASONING'], ['certification'], 'READ_ONLY'),
  define('actionHistorian', 'Learning, anti-lesson, and recurrence analysis.', ['LEARNING_AND_ANTI_LESSON', 'MEMORY_CONSOLIDATION', 'RECURRENCE_PREVENTION'], ['historical-learning']),
  define('actionRepairBot', 'Operational repair execution under canonical policy.', ['ROOT_CAUSE_ANALYSIS', 'RECOVERY_REASONING', 'EVIDENCE_PROVENANCE'], ['repair', 'execution']),
  define('actionRepairVerifier', 'Independent challenge of repair evidence.', ['ADVERSARIAL_FALSIFICATION', 'REGRESSION_REASONING', 'EVIDENCE_PROVENANCE'], ['repair-verification'], 'READ_ONLY'),
  define('ACTION-CODE-MENTOR', 'Architecture and minimal-change mentorship.', ['DEPENDENCY_IMPACT_REASONING', 'CONTRACT_COMPOSITION', 'CHANGE_IMPACT_SIMULATION'], ['architecture-review'], 'READ_ONLY'),
  define('MASTER-1', 'Presidential arbitration and highest project-level direction.', ['PRIORITY_ARBITRATION', 'CONFLICT_RECONCILIATION', 'HUMAN_HANDOFF_REASONING'], ['arbitration']),
  define('MASTER-2', 'Deputy arbitration and execution oversight.', ['PRIORITY_ARBITRATION', 'STATE_MACHINE_REASONING', 'CONTRACT_COMPOSITION'], ['oversight']),
  define('MASTER-3', 'Consultative architecture and evidence synthesis.', ['MULTI_AGENT_SYNTHESIS', 'PROVENANCE_GRAPH_REASONING', 'KNOWLEDGE_RETRIEVAL'], ['consulting', 'architecture-review']),
]);


export type AgentDefinition = Readonly<{
  id: string;
  name: string;
  profileId: string;
  purpose: string;
  handoffDescription: string;
  runtimeMode: AgentRuntimeMode;
  lenses: readonly string[];
  skills: readonly string[];
  authorityBinding: AgentAuthorityBinding;
  doesNotGrantAuthority: true;
}>;

export type AgentDefinitionOverrides = Readonly<{
  name?: string;
  handoffDescription?: string;
}>;

function buildAgentDefinition(
  profile: AgentProfile,
  overrides: AgentDefinitionOverrides = {},
): AgentDefinition {
  const name = String(overrides.name ?? profile.id).trim();
  const handoffDescription = String(
    overrides.handoffDescription ?? profile.purpose,
  ).trim();
  if (!name) throw new Error('AGENT_DEFINITION_NAME_REQUIRED');
  if (!handoffDescription) throw new Error('AGENT_DEFINITION_HANDOFF_DESCRIPTION_REQUIRED');
  assertAgentProfileSafety(profile);
  return Object.freeze({
    id: profile.id,
    name,
    profileId: profile.id,
    purpose: profile.purpose,
    handoffDescription,
    runtimeMode: profile.runtimeMode,
    lenses: profile.lenses,
    skills: profile.skills,
    authorityBinding: profile.authorityBinding,
    doesNotGrantAuthority: true,
  });
}

function assertAgentDefinitionCatalogSafety(
  definitions: readonly AgentDefinition[],
): void {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const definition of definitions) {
    if (ids.has(definition.id)) throw new Error(`AGENT_DEFINITION_ID_COLLISION=${definition.id}`);
    if (names.has(definition.name)) throw new Error(`AGENT_DEFINITION_NAME_COLLISION=${definition.name}`);
    ids.add(definition.id);
    names.add(definition.name);
    if (definition.profileId !== definition.id) {
      throw new Error(`AGENT_DEFINITION_PROFILE_BINDING_INVALID=${definition.id}`);
    }
    if (definition.doesNotGrantAuthority !== true) {
      throw new Error(`AGENT_DEFINITION_AUTHORITY_BOUNDARY_INVALID=${definition.id}`);
    }
  }
}

export const AGENT_DEFINITIONS: readonly AgentDefinition[] = Object.freeze(
  AGENT_PROFILES.map((profile) => buildAgentDefinition(profile)),
);

assertAgentDefinitionCatalogSafety(AGENT_DEFINITIONS);

const DEFINITIONS_BY_ID = new Map(
  AGENT_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function createAgentDefinition(
  profileId: string,
  overrides: AgentDefinitionOverrides = {},
): AgentDefinition {
  const profile = getAgentProfile(profileId);
  if (!profile) throw new Error(`UNKNOWN_AGENT_PROFILE=${profileId}`);
  const definition = buildAgentDefinition(profile, overrides);
  const existing = DEFINITIONS_BY_ID.get(definition.id);
  if (existing && (
    existing.name !== definition.name
    || existing.handoffDescription !== definition.handoffDescription
  )) {
    throw new Error(`AGENT_DEFINITION_COLLISION=${definition.id}`);
  }
  return definition;
}

export function getAgentDefinition(id: string): AgentDefinition | undefined {
  return DEFINITIONS_BY_ID.get(String(id).trim());
}

export function listAgentDefinitions(): readonly AgentDefinition[] {
  return AGENT_DEFINITIONS;
}

const BY_ID = new Map(AGENT_PROFILES.map((profile) => [profile.id, profile]));

export function getAgentProfile(id: string): AgentProfile | undefined {
  return BY_ID.get(id);
}

export function listAgentProfiles(): readonly AgentProfile[] {
  return AGENT_PROFILES;
}

export function profilesForLenses(lenses: readonly string[]): readonly AgentProfile[] {
  const wanted = new Set(lenses);
  return Object.freeze(
    AGENT_PROFILES.filter((profile) => profile.lenses.some((lens) => wanted.has(lens))),
  );
}

export function assertAgentProfileSafety(profile: AgentProfile): void {
  if (profile.authorityBinding !== 'CANONICAL_CONTROL_PLANE' || profile.doesNotGrantAuthority !== true) {
    throw new Error('Agent profile is not bound to the canonical control plane.');
  }
}


/**
 * Canonical bounded helper-agent composition for autonomous execution.
 *
 * This is a composition of existing profiles, not a second registry or authority.
 * Mutation ownership remains with the canonical execution gate and control plane.
 */
export const AUTONOMOUS_EXECUTION_SQUAD = Object.freeze([
  Object.freeze({ seat: 'SCOUT', profileId: 'codeScout', mode: 'READ_ONLY' as const }),
  Object.freeze({ seat: 'RCA', profileId: 'errorAgent', mode: 'READ_ONLY' as const }),
  Object.freeze({ seat: 'FALSIFIER', profileId: 'reviewAgent', mode: 'READ_ONLY' as const }),
  Object.freeze({ seat: 'REPAIR', profileId: 'actionRepairBot', mode: 'CANONICAL_MUTATION' as const }),
  Object.freeze({ seat: 'TEST', profileId: 'testAgent', mode: 'VERIFY' as const }),
  Object.freeze({ seat: 'SECURITY', profileId: 'securityAgent', mode: 'READ_ONLY' as const }),
  Object.freeze({ seat: 'LEARN', profileId: 'actionHistorian', mode: 'LEARNING' as const }),
  Object.freeze({ seat: 'CERTIFY', profileId: 'certificationAuthority', mode: 'READ_ONLY' as const }),
] as const);

export function assertAutonomousExecutionSquadSafety(): void {
  const mutationSeats = AUTONOMOUS_EXECUTION_SQUAD.filter((seat) => seat.mode === 'CANONICAL_MUTATION');
  if (mutationSeats.length !== 1 || mutationSeats[0]?.profileId !== 'actionRepairBot') {
    throw new Error('AUTONOMOUS_SQUAD_MUTATION_AUTHORITY_INVALID');
  }
  for (const seat of AUTONOMOUS_EXECUTION_SQUAD) {
    const profile = getAgentProfile(seat.profileId);
    if (!profile) throw new Error(`AUTONOMOUS_SQUAD_PROFILE_MISSING=${seat.profileId}`);
    assertAgentProfileSafety(profile);
  }
}
