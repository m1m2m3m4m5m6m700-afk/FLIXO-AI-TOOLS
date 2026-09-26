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
