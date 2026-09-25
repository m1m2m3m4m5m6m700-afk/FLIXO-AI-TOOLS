/**
 * FLIXO BOT — Collective Intelligence Runtime
 *
 * This module synthesizes the repository's shared FLIXO-BOT brain into a
 * deterministic, advisory reasoning frame. It never grants mutation,
 * execution, merge, or certification authority.
 */

import { listAgentProfiles } from '@/lib/agent/agent-profile';

export const COLLECTIVE_INTELLIGENCE_VERSION = 'FLIXO-BOT-BRAIN-v2' as const;
export const COLLECTIVE_INTELLIGENCE_SOURCE = 'docs/agents/FLIXO-BOT.json' as const;
export const COLLECTIVE_ACTIVE_MEMBER_COUNT = 200 as const;
export const COLLECTIVE_CAPABILITY_COUNT = 97 as const;

export type CollectiveReasoningLens = Readonly<{
  id: string;
  purpose: string;
  triggers: readonly string[];
}>;

export type CollectiveIntelligenceFrame = Readonly<{
  version: typeof COLLECTIVE_INTELLIGENCE_VERSION;
  mode: 'ONE_SHARED_SUPERSET_COGNITIVE_KERNEL_WITH_ROLE_OVERLAYS';
  authority: 'ADVISORY_ONLY';
  mutationAuthority: false;
  certificationAuthority: false;
  reasoningDepth: 'DEEP';
  request: string;
  capabilityIds: readonly string[];
  selectedLenses: readonly string[];
  selectedPerspectives: readonly string[];
  reasoningSequence: readonly string[];
  proofObligations: readonly string[];
  guardrails: readonly string[];
  depthPolicy: Readonly<{
    mode: 'FULL_ALWAYS';
    noComplexityDowngrade: true;
    reasoningEffort: 'MAXIMUM';
  }>;
  knowledgePolicy: Readonly<{
    exactShaBindingRequired: true;
    staleKnowledgePolicy: 'REQUALIFY_BEFORE_REUSE';
    conflictPolicy: 'PRESERVE_UNTIL_FRESH_EVIDENCE';
    learningDoesNotGrantAuthority: true;
  }>;
}>;

const LENSES: readonly CollectiveReasoningLens[] = Object.freeze([
  { id: 'HUMAN_INTENT_MODELING', purpose: 'Model the desired outcome, constraints, negative requirements, and missing information.', triggers: ['want', 'need', 'make', 'change', 'أريد', 'اريد', 'عايز', 'عاوز', 'محتاج'] },
  { id: 'EVIDENCE_PROVENANCE', purpose: 'Bind material claims to current evidence and exact-SHA provenance.', triggers: ['evidence', 'proof', 'exact', 'sha', 'check', 'verify', 'دليل', 'اثبات', 'إثبات', 'تحقق', 'sha'] },
  { id: 'ROOT_CAUSE_ANALYSIS', purpose: 'Separate symptom, mechanism, violated invariant, propagation path, and root cause.', triggers: ['why', 'cause', 'root', 'failure', 'error', 'race', 'bug', 'فشل', 'خطا', 'خطأ', 'سبب', 'مشكلة', 'سباق'] },
  { id: 'HYPOTHESIS_DISCRIMINATION', purpose: 'Generate competing hypotheses and choose discriminating evidence instead of guessing.', triggers: ['hypothesis', 'maybe', 'alternative', 'uncertain', 'فرضية', 'احتمال', 'بديل', 'غير متأكد'] },
  { id: 'ADVERSARIAL_FALSIFICATION', purpose: 'Actively search for counterexamples and ways a proposed diagnosis or patch could be wrong.', triggers: ['adversarial', 'attack', 'bypass', 'counterexample', 'falsify', 'امن', 'أمن', 'هجوم', 'تجاوز', 'دحض'] },
  { id: 'DEPENDENCY_IMPACT_REASONING', purpose: 'Trace upstream/downstream dependencies and the smallest causal change surface.', triggers: ['dependency', 'impact', 'downstream', 'upstream', 'chain', 'اعتماد', 'تأثير', 'سلسلة'] },
  { id: 'REGRESSION_REASONING', purpose: 'Choose targeted regressions that prove the repaired behavior and guard nearby behavior.', triggers: ['test', 'regression', 'browser', 'ci', 'playwright', 'اختبار', 'ريجريشن', 'متصفح', 'ci'] },
  { id: 'SECURITY_BOUNDARY_REASONING', purpose: 'Review permissions, secrets, trust boundaries, injection surfaces, and fail-closed behavior.', triggers: ['security', 'secret', 'token', 'permission', 'auth', 'oidc', 'أمان', 'سر', 'صلاحية', 'مصادقة'] },
  { id: 'RECOVERY_REASONING', purpose: 'Choose bounded retry, replan, rollback, or fail-closed behavior from canonical policy.', triggers: ['retry', 'replan', 'rollback', 'recover', 'استعادة', 'إعادة', 'تراجع', 'rollback'] },
  { id: 'TEMPORAL_STATE_REASONING', purpose: 'Detect stale evidence, changed heads, superseded runs, and current-versus-historical state.', triggers: ['latest', 'current', 'stale', 'historical', 'old', 'جديد', 'الحالي', 'قديم', 'تاريخي'] },
  { id: 'PERFORMANCE_REASONING', purpose: 'Distinguish performance symptoms from correctness regressions and preserve gates while optimizing.', triggers: ['performance', 'latency', 'slow', 'fast', 'speed', 'أداء', 'بطء', 'سرعة'] },
  { id: 'LEARNING_AND_ANTI_LESSON', purpose: 'Turn verified successes into lessons and failed strategies into anti-lessons without transferring authority.', triggers: ['learn', 'lesson', 'memory', 'history', 'تعلم', 'درس', 'ذاكرة', 'سجل'] },
  { id: 'SYSTEMS_THINKING', purpose: 'Reason across interacting subsystems, feedback loops, constraints, and emergent failure modes.', triggers: ['system', 'architecture', 'platform', 'نظام', 'معمارية', 'منظومة'] },
  { id: 'CAUSAL_GRAPH_REASONING', purpose: 'Build causal graphs linking triggers, propagation, violated invariants, and downstream symptoms.', triggers: ['causal', 'propagation', 'chain', 'سببية', 'انتقال', 'سلسلة'] },
  { id: 'STATE_MACHINE_REASONING', purpose: 'Reason about lifecycle state, legal transitions, stale state, and recovery paths.', triggers: ['state', 'transition', 'lifecycle', 'حالة', 'انتقال', 'دورة'] },
  { id: 'CONTRACT_COMPOSITION', purpose: 'Compose multiple repository contracts without weakening the strongest invariant.', triggers: ['contract', 'policy', 'protocol', 'عقد', 'سياسة', 'بروتوكول'] },
  { id: 'FAILURE_TAXONOMY', purpose: 'Classify failures into causal families before selecting any repair strategy.', triggers: ['classification', 'failure family', 'taxonomy', 'تصنيف', 'عائلة'] },
  { id: 'CHANGE_IMPACT_SIMULATION', purpose: 'Predict direct and indirect effects of a proposed change before mutation.', triggers: ['impact', 'blast', 'simulation', 'تأثير', 'محاكاة'] },
  { id: 'PRIORITY_ARBITRATION', purpose: 'Resolve competing tasks using evidence, severity, dependency and ownership rather than convenience.', triggers: ['priority', 'arbitrate', 'urgent', 'أولوية', 'تحكيم', 'عاجل'] },
  { id: 'MULTI_AGENT_SYNTHESIS', purpose: 'Fuse independent agent findings while preserving disagreements and provenance.', triggers: ['agent', 'peer', 'synthesis', 'وكلاء', 'تجميع', 'خلاف'] },
  { id: 'KNOWLEDGE_RETRIEVAL', purpose: 'Retrieve reusable knowledge from shared memory while requalifying it against current evidence.', triggers: ['knowledge', 'memory', 'retrieve', 'معرفة', 'استرجاع'] },
  { id: 'MEMORY_CONSOLIDATION', purpose: 'Consolidate lessons, anti-lessons and counterexamples into the canonical learning stream.', triggers: ['consolidate', 'memory', 'learn', 'دمج', 'ذاكرة', 'تعلم'] },
  { id: 'CONFLICT_RECONCILIATION', purpose: 'Preserve conflicting evidence until fresh exact evidence resolves it.', triggers: ['conflict', 'contradiction', 'reconcile', 'تعارض', 'تناقض', 'تسوية'] },
  { id: 'PROVENANCE_GRAPH_REASONING', purpose: 'Trace every material claim through its source, transformation and verification chain.', triggers: ['provenance', 'trace', 'source', 'أصل', 'تتبع', 'مصدر'] },
  { id: 'NEGATIVE_PROOF_REASONING', purpose: 'Test whether a proposed repair fails under adversarial counterexamples and boundary conditions.', triggers: ['negative proof', 'counterexample', 'falsify', 'إثبات سلبي', 'دحض'] },
  { id: 'RECURRENCE_PREVENTION', purpose: 'Convert repaired failures into preventative controls and recurrence detectors.', triggers: ['recurrence', 'prevent', 'regression', 'تكرار', 'منع'] },
  { id: 'DECISION_CALIBRATION', purpose: 'Calibrate confidence, abstain when evidence is insufficient, and separate observation from inference.', triggers: ['confidence', 'uncertain', 'calibrate', 'ثقة', 'غير مؤكد'] },
  { id: 'TOOL_SELECTION_REASONING', purpose: 'Select the narrowest valid tool path while retaining access to the full cognitive substrate.', triggers: ['tool', 'select', 'command', 'أداة', 'اختيار'] },
  { id: 'HUMAN_HANDOFF_REASONING', purpose: 'Prepare precise escalation when authority or evidence boundaries require human arbitration.', triggers: ['handoff', 'escalate', 'human', 'تصعيد', 'تسليم', 'إنسان'] },
]);

function selectRolePerspectives(selectedLenses: readonly string[]): readonly string[] {
  const wanted = new Set(selectedLenses);
  const roles = new Set<string>();
  for (const profile of listAgentProfiles()) {
    if (profile.lenses.some((lens) => wanted.has(lens))) roles.add(profile.id);
  }
  return Object.freeze([...roles]);
}


const REASONING_SEQUENCE = Object.freeze([
  'OBSERVE',
  'INVENTORY',
  'REFRESH_EXACT_SHA',
  'CLASSIFY',
  'CORRELATE',
  'RETRIEVE_SHARED_MEMORY',
  'BUILD_WORLD_MODEL',
  'BUILD_CAUSAL_GRAPH',
  'GENERATE_HYPOTHESES',
  'DISCRIMINATE_WITH_EVIDENCE',
  'CHALLENGE_ADVERSARIALLY',
  'SYNTHESIZE_PEER_PERSPECTIVES',
  'CALIBRATE_UNCERTAINTY',
  'SCOPE_MINIMAL_CHANGE',
  'SIMULATE_OR_PREDICT',
  'CHECK_SECURITY_AND_BOUNDARIES',
  'TARGETED_REGRESSION',
  'INDEPENDENT_REVIEW',
  'VERIFY_EXACT_SHA_AND_LEARN',
]);

const PROOF_OBLIGATIONS = Object.freeze([
  'Every material claim must have a source or be labeled inference.',
  'Historical evidence is contextual until requalified against the current exact SHA.',
  'Contradictions remain visible until fresh evidence resolves them.',
  'A successful-looking patch is not accepted without targeted regression.',
  'Execution remains delegated to canonical gates and the Pipeline Runner.',
  'Learning never grants permissions, mutation authority, merge authority, or certification.',
]);

const GUARDRAILS = Object.freeze([
  'NO_BLIND_RETRY',
  'NO_HIDDEN_AUTHORITY_TRANSFER',
  'NO_EXECUTOR_DUPLICATION',
  'NO_DIRECT_MAIN_MUTATION',
  'NO_SKIPPED_VERIFICATION',
  'FAIL_CLOSED_ON_UNCERTAINTY',
]);

export function buildCollectiveIntelligenceFrame(
  request: string,
  capabilityIds: readonly string[] = [],
): CollectiveIntelligenceFrame {
  const selected = new Set<string>(LENSES.map((lens) => lens.id));
  if (capabilityIds.length > 0) selected.add('DEPENDENCY_IMPACT_REASONING');

  return Object.freeze({
    version: COLLECTIVE_INTELLIGENCE_VERSION,
    mode: 'ONE_SHARED_SUPERSET_COGNITIVE_KERNEL_WITH_ROLE_OVERLAYS',
    authority: 'ADVISORY_ONLY',
    mutationAuthority: false,
    certificationAuthority: false,
    reasoningDepth: 'DEEP',
    request: request.trim(),
    capabilityIds: Object.freeze([...new Set(capabilityIds.map((id) => String(id).trim()).filter(Boolean))]),
    selectedLenses: Object.freeze([...selected]),
    selectedPerspectives: selectRolePerspectives([...selected]),
    reasoningSequence: REASONING_SEQUENCE,
    proofObligations: PROOF_OBLIGATIONS,
    guardrails: GUARDRAILS,
    depthPolicy: Object.freeze({ mode: 'FULL_ALWAYS', noComplexityDowngrade: true, reasoningEffort: 'MAXIMUM' }),
    knowledgePolicy: Object.freeze({
      exactShaBindingRequired: true,
      staleKnowledgePolicy: 'REQUALIFY_BEFORE_REUSE',
      conflictPolicy: 'PRESERVE_UNTIL_FRESH_EVIDENCE',
      learningDoesNotGrantAuthority: true,
    }),
  });
}

export function buildCollectiveIntelligenceContext(
  request: string,
  capabilityIds: readonly string[] = [],
): CollectiveIntelligenceFrame {
  return buildCollectiveIntelligenceFrame(request, capabilityIds);
}

export function summarizeCollectiveIntelligence(frame: CollectiveIntelligenceFrame): string {
  return [
    'FLIXO collective intelligence is advisory only.',
    'Reasoning lenses: ' + frame.selectedLenses.join(', '),
    'Perspectives: ' + frame.selectedPerspectives.join(', '),
    'Required sequence: ' + frame.reasoningSequence.join(' → '),
    'Fresh exact-SHA evidence is mandatory before material conclusions are treated as current.',
  ].join('\n');
}
