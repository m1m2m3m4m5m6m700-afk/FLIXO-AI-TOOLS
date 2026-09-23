/**
 * FLIXO BOT — Collective Intelligence Runtime
 *
 * This module synthesizes the repository's shared FLIXO-BOT brain into a
 * deterministic, advisory reasoning frame. It never grants mutation,
 * execution, merge, or certification authority.
 */

export const COLLECTIVE_INTELLIGENCE_VERSION = 'FLIXO-BOT-BRAIN-v1' as const;
export const COLLECTIVE_INTELLIGENCE_SOURCE = 'docs/agents/FLIXO-BOT.json' as const;
export const COLLECTIVE_ACTIVE_MEMBER_COUNT = 61 as const;
export const COLLECTIVE_CAPABILITY_COUNT = 97 as const;

export type CollectiveReasoningLens = Readonly<{
  id: string;
  purpose: string;
  triggers: readonly string[];
}>;

export type CollectiveIntelligenceFrame = Readonly<{
  version: typeof COLLECTIVE_INTELLIGENCE_VERSION;
  mode: 'ONE_SHARED_COGNITIVE_KERNEL_WITH_ROLE_OVERLAYS';
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
]);

const ROLE_PERSPECTIVES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  analysis: ['ROOT_CAUSE_ANALYSIS', 'HYPOTHESIS_DISCRIMINATION', 'UNCERTAINTY_MODELING'],
  codeScout: ['DEPENDENCY_IMPACT_REASONING', 'MINIMAL_CHANGE_SELECTION'],
  errorAgent: ['ROOT_CAUSE_ANALYSIS', 'EVIDENCE_PROVENANCE', 'TEMPORAL_STATE_REASONING'],
  repairAgent: ['ROOT_CAUSE_ANALYSIS', 'MINIMAL_CHANGE_SELECTION', 'RECOVERY_REASONING'],
  executionAgent: ['HUMAN_INTENT_MODELING', 'MINIMAL_CHANGE_SELECTION', 'EVIDENCE_PROVENANCE'],
  reviewAgent: ['ADVERSARIAL_FALSIFICATION', 'EVIDENCE_PROVENANCE', 'REGRESSION_REASONING'],
  testAgent: ['REGRESSION_REASONING', 'EVIDENCE_PROVENANCE'],
  securityAgent: ['SECURITY_BOUNDARY_REASONING', 'ADVERSARIAL_FALSIFICATION'],
  performanceAgent: ['PERFORMANCE_REASONING', 'DEPENDENCY_IMPACT_REASONING'],
  certificationAuthority: ['EVIDENCE_PROVENANCE', 'TEMPORAL_STATE_REASONING'],
  actionHistorian: ['LEARNING_AND_ANTI_LESSON', 'TEMPORAL_STATE_REASONING'],
  actionRepairBot: ['ROOT_CAUSE_ANALYSIS', 'MINIMAL_CHANGE_SELECTION', 'RECOVERY_REASONING'],
  actionRepairVerifier: ['ADVERSARIAL_FALSIFICATION', 'REGRESSION_REASONING', 'EVIDENCE_PROVENANCE'],
  'ACTION-CODE-MENTOR': ['DEPENDENCY_IMPACT_REASONING', 'MINIMAL_CHANGE_SELECTION'],
});

const REASONING_SEQUENCE = Object.freeze([
  'OBSERVE',
  'INVENTORY',
  'CLASSIFY',
  'CORRELATE',
  'BUILD_WORLD_MODEL',
  'GENERATE_HYPOTHESES',
  'DISCRIMINATE_WITH_EVIDENCE',
  'CHALLENGE_ADVERSARIALLY',
  'SCOPE_MINIMAL_CHANGE',
  'SIMULATE_OR_PREDICT',
  'TARGETED_REGRESSION',
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

function selectPerspectives(selectedLenses: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (const [role, lenses] of Object.entries(ROLE_PERSPECTIVES)) {
    if (lenses.some((lens) => selectedLenses.includes(lens))) out.push(role);
  }
  return Object.freeze(out);
}

export function buildCollectiveIntelligenceFrame(
  request: string,
  capabilityIds: readonly string[] = [],
): CollectiveIntelligenceFrame {
  const selected = new Set<string>(LENSES.map((lens) => lens.id));
  if (capabilityIds.length > 0) selected.add('DEPENDENCY_IMPACT_REASONING');

  return Object.freeze({
    version: COLLECTIVE_INTELLIGENCE_VERSION,
    mode: 'ONE_SHARED_COGNITIVE_KERNEL_WITH_ROLE_OVERLAYS',
    authority: 'ADVISORY_ONLY',
    mutationAuthority: false,
    certificationAuthority: false,
    reasoningDepth: 'DEEP',
    request: request.trim(),
    capabilityIds: Object.freeze([...new Set(capabilityIds.map((id) => String(id).trim()).filter(Boolean))]),
    selectedLenses: Object.freeze([...selected]),
    selectedPerspectives: selectPerspectives([...selected]),
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
