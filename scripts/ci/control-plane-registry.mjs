export const REPAIR_GATE_AUTOMATION = Object.freeze([
  'auto-repair.yml',
  'daily-flixo-green-gate.yml',
  'execution-sync.yml',
  'execution-bot-watchdog.yml',
  'auto-repair-merge-gate.yml',
  'advanced-repair-contract.yml',
  'master-repair-governor.yml',
  'agent-communication-relay.yml',
  'ultra-investigator.yml',
  'unified-execution-push-gate.yml',
]);

export const WRITE_CAPABLE_WORKFLOWS = Object.freeze([
  'auto-repair.yml',
  'daily-flixo-green-gate.yml',
  'execution-sync.yml',
  'repair-lease-live-race.yml',
  'historical-action-error-index.yml',
  'action-agent-history-promotion.yml',
  'task-history-ledger.yml',
]);

export const SENSITIVE_PERMISSION_ALLOWLISTS = Object.freeze({
  contents: Object.freeze([...WRITE_CAPABLE_WORKFLOWS]),
  actions: Object.freeze([
    'agent-communication-relay.yml',
    'daily-flixo-green-gate.yml',
    'execution-bot-watchdog.yml',
    'latest-commit-test-supersession.yml',
    'latest-execution-head-cleanup.yml',
  ]),
  'id-token': Object.freeze([
    'agent-communication-relay.yml',
    'council-priority-wake.yml',
    'council-wake-push-relay.yml',
    'agent-master-activation.yml',
    'council-external-lease-watch.yml',
  ]),
  issues: Object.freeze([
    'agent-communication-relay.yml',
    'council-priority-wake.yml',
    'council-wake-push-relay.yml',
    'agent-master-activation.yml',
    'repair-agent-intake.yml',
  ]),
  'pull-requests': Object.freeze([
    'agent-master-activation.yml',
    'claude-security-review.yml',
  ]),
  'security-events': Object.freeze([]),
  statuses: Object.freeze([]),
  deployments: Object.freeze([
    'cd.yml',
  ]),
});

export const SECURITY_CRITICAL_WORKFLOWS = Object.freeze([
  'auto-repair.yml',
  'execution-sync.yml',
  'wp0-trust-baseline.yml',
  'repository-security-baseline.yml',
  'agent-master-activation.yml',
  'council-wake-push-relay.yml',
  'repair-agent-intake.yml',
  'auto-repair-merge-gate.yml',
  'council-live-runtime-verification.yml',
  'security-red-team.yml',
  'master-repair-governor.yml',
]);

export const HISTORICAL_REPAIR_WORKFLOWS = Object.freeze([
  'FLIXO Test System',
  'FLIXO WP0 Trust Baseline',
  'FLIXO Test Impact',
  'FLIXO Test Impact Execution',
  'Repository Security Baseline',
  'Claude Security Review',
  'FLIXO Continuous Delivery',
  'Daily·FLIXO Green Gate',
  'FLIXO Auto Repair Bot',
  'FLIXO Execution Canonical Sync',
]);

export const TRUST_PERIMETER_PATHS = Object.freeze([
  '.github/workflows/auto-repair.yml',
  'scripts/ci/execution-mutation-gate.mjs',
  'scripts/ci/test-chair1-change-accumulator.mjs',
  'scripts/ci/test-agent-isolated-workspace.mjs',
  '.github/workflows/execution-sync.yml',
  '.github/workflows/wp0-trust-baseline.yml',
  'scripts/ci/control-plane-registry.mjs',
  'scripts/ci/repair-control-plane.mjs',
  'scripts/ci/auto-repair-policy.mjs',
  'scripts/ci/repair-protocol.mjs',
  'scripts/ci/auto-repair-engine.mjs',
  'scripts/ci/patch-truth-engine.mjs',
  'scripts/ci/verify-platform-publication-boundary.mjs',
  'scripts/ci/master-repair-historical-replay.mjs',
  'scripts/ci/master-repair-negative-proof.mjs',
  'scripts/ci/master-repair-canary.mjs',
  'scripts/ci/master-repair-rollback-proof.mjs',
  'scripts/ci/master-repair-governor.mjs',
  'scripts/ci/test-patch-truth-engine.mjs',
  'scripts/ci/test-master-repair-governor.mjs',
  'scripts/ci/repair-agent-cognitive-clone.mjs',
  'scripts/ci/validate-repair-agent-cognitive-clone.mjs',
  'scripts/ci/repair-adversarial-convergence.mjs',
  'scripts/ci/test-repair-adversarial-convergence.mjs',
  'scripts/ci/auto-repair-chair1-audit.mjs',
  'scripts/ci/execution-head-authority.mjs',
  'scripts/ci/chair1-change-accumulator.mjs',
  'scripts/ci/guard-communication.mjs',
  'scripts/ci/agent-isolated-workspace.mjs',
  'scripts/ci/agent-session.mjs',
  'scripts/ci/auto-repair-learning.mjs',
  'scripts/ci/auto-repair-proof.mjs',
  'scripts/ci/auto-repair/',
  'scripts/ci/auto-repair/ai-phase1.mjs',
  'scripts/ci/auto-repair/ai-phase2.mjs',
  'scripts/ci/auto-repair/ai-phase3.mjs',
  'scripts/ci/task-agent.mjs',
  'scripts/ci/agent-execution-control.mjs',
  'scripts/ci/repository-security-baseline.mjs',
  'scripts/ci/validate-auto-repair-memory.mjs',
  'scripts/ci/validate-certification-surface.mjs',
  'scripts/ci/validate-ci-cd-trust.mjs',
  'scripts/ci/validate-wp0-trust-baseline.mjs',
  'scripts/ci/validate-council-rpc-contract.mjs',
  'scripts/ci/validate-promotion-closure.mjs',
  'scripts/ci/test-promotion-closure.mjs',
  'scripts/ci/verify-council-live-runtime.mjs',
  'scripts/security/security-red-team-runner.mjs',
  'scripts/security/record-security-findings.mjs',
  'scripts/ci/test-security-red-team-contract.mjs',
  'docs/agents/SECURITY-RED-TEAM-BOTS.json',
  '.github/workflows/security-red-team.yml',
]);


export const BOT_RUNTIME_PROTOCOL = 'FLIXO-UNIFIED-BOT-RUNTIME-v1';
export const BOT_RUNTIME_ENGINE_VERSION = 'UNIFIED-BOT-ENGINE-v1';
export const BOT_RUNTIME_SHARED_CAPABILITIES = Object.freeze([
  'PROMPT_UNDERSTANDING',
  'CONSTRAINT_REASONING',
  'EXACT_SHA_BINDING',
  'FAILURE_FINGERPRINTING',
  'ROOT_CAUSE_ANALYSIS',
  'ADVERSARIAL_CHALLENGE',
  'HISTORICAL_LEARNING',
  'KNOWLEDGE_SYNTHESIS',
  'DEPENDENCY_TRACE',
  'REGRESSION_PLANNING',
  'HANDOFF_PROVENANCE',
  'STALE_EVIDENCE_REJECTION',
]);

export const BOT_RUNTIME_ROLES = Object.freeze({
  READ_ONLY: Object.freeze({
    mutationAuthority: false,
    certificationAuthority: false,
    reportOnly: true,
    capabilities: BOT_RUNTIME_SHARED_CAPABILITIES,
  }),
  REPAIR: Object.freeze({
    mutationAuthority: true,
    certificationAuthority: false,
    reportOnly: false,
    capabilities: BOT_RUNTIME_SHARED_CAPABILITIES,
  }),
  ADVERSARIAL: Object.freeze({
    mutationAuthority: false,
    certificationAuthority: false,
    reportOnly: true,
    capabilities: Object.freeze([...BOT_RUNTIME_SHARED_CAPABILITIES, 'COUNTEREXAMPLE_HUNT']),
  }),
  HISTORIAN: Object.freeze({
    mutationAuthority: false,
    certificationAuthority: false,
    reportOnly: true,
    capabilities: Object.freeze([...BOT_RUNTIME_SHARED_CAPABILITIES, 'KNOWLEDGE_CUSTODY']),
  }),
  MASTER_GATE: Object.freeze({
    mutationAuthority: false,
    certificationAuthority: false,
    reportOnly: true,
    capabilities: Object.freeze([...BOT_RUNTIME_SHARED_CAPABILITIES, 'INDEPENDENT_JUDGMENT', 'PROOF_ARBITRATION']),
  }),
  MASTER_REPAIR: Object.freeze({
    mutationAuthority: true,
    certificationAuthority: false,
    reportOnly: false,
    boundedMutationOnly: true,
    canReadRepository: true,
    canWriteExecutionSource: true,
    canWriteTests: false,
    canWriteMain: false,
    canWriteControlPlane: false,
    transactionalWrites: true,
    requiresChair1: true,
    requiresIndependentVerification: true,
    capabilities: Object.freeze([
      ...BOT_RUNTIME_SHARED_CAPABILITIES,
      'COUNTEREXAMPLE_HUNT',
      'INDEPENDENT_JUDGMENT',
      'PROOF_ARBITRATION',
      'PATCH_SIMULATION',
      'PATCH_CORRECTNESS_PROOF',
      'ADAPTIVE_REPAIR_PORTFOLIO',
      'TEN_X_REPAIR',
      'REPOSITORY_READ',
      'REPOSITORY_INTELLIGENCE_GRAPH',
      'DEPENDENCY_IMPACT_ANALYSIS',
      'NO_REPAIR_DECISION',
      'BOUNDED_SOURCE_WRITE',
      'PATCH_TRANSACTION',
      'ROLLBACK_EXECUTION',
      'PERSISTENT_REPAIR_RECEIPT',
    ]),
  }),
});

const BOT_RUNTIME_IDS = Object.freeze({
  'ACTION-REPAIR': 'MASTER_REPAIR',
  'ACTION-REPAIR-2': 'ADVERSARIAL',
  'ACTION-HISTORIAN-3': 'HISTORIAN',
  'ACTION-TWIN-1': 'ADVERSARIAL',
  'ACTION-TWIN-2': 'ADVERSARIAL',
  'ACTION-INDEX': 'HISTORIAN',
  'ACTION-WISE': 'READ_ONLY',
  'ACTION-RCA-3': 'ADVERSARIAL',
  'ACTION-IMPACT-4': 'ADVERSARIAL',
  'ACTION-SECURITY-5': 'ADVERSARIAL',
  'ACTION-REGRESSION-6': 'ADVERSARIAL',
  'ACTION-SHA-7': 'ADVERSARIAL',
  'ACTION-CONVERGENCE-8': 'ADVERSARIAL',
  'ACTION-WAKE': 'READ_ONLY',
  'ACTION-MASTER': 'MASTER_GATE',
  'AUTO_REPAIR_BOT': 'REPAIR',
  'PROGRAMMER-TWIN-A': 'ADVERSARIAL',
  'PROGRAMMER-TWIN-B': 'ADVERSARIAL',
  'READ-INVESTIGATOR': 'READ_ONLY',
  'READ-ADVERSARY': 'ADVERSARIAL',
  'CODE-SCOUT': 'READ_ONLY',
  'ERROR-INVESTIGATOR': 'READ_ONLY',
  'REPAIR-INTELLIGENCE': 'READ_ONLY',
  'MASTER-REPAIR-GATE': 'MASTER_GATE',
});

function normalizeBotId(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\\s+/gu, '_');
}

export function getUnifiedBotRuntime(botId) {
  const id = normalizeBotId(botId);
  const roleName = BOT_RUNTIME_IDS[id];
  if (!roleName) throw new Error('BOT_RUNTIME_ID_UNREGISTERED=' + id);
  const role = BOT_RUNTIME_ROLES[roleName];
  return Object.freeze({
    protocol: BOT_RUNTIME_PROTOCOL,
    engineVersion: BOT_RUNTIME_ENGINE_VERSION,
    botId: id,
    role: roleName,
    sharedCapabilities: BOT_RUNTIME_SHARED_CAPABILITIES,
    capabilities: role.capabilities,
    mutationAuthority: role.mutationAuthority,
    certificationAuthority: role.certificationAuthority,
    reportOnly: role.reportOnly,
    exactShaRequired: true,
    staleEvidenceRejected: true,
    canReadRepository: role.canReadRepository === true,
    canWriteExecutionSource: role.canWriteExecutionSource === true,
    canWriteTests: role.canWriteTests === true,
    canWriteMain: role.canWriteMain === true,
    canWriteControlPlane: role.canWriteControlPlane === true,
    transactionalWrites: role.transactionalWrites === true,
  });
}

export function assertUnifiedBotRuntime(botId, expectedRole = null) {
  const runtime = getUnifiedBotRuntime(botId);
  if (expectedRole && runtime.role !== expectedRole) throw new Error('BOT_RUNTIME_ROLE_MISMATCH=' + runtime.botId + ':' + expectedRole + ':actual=' + runtime.role);
  return runtime;
}

export function validateUnifiedBotRuntimeRegistry() {
  const failures = [];
  if (BOT_RUNTIME_PROTOCOL !== 'FLIXO-UNIFIED-BOT-RUNTIME-v1') failures.push('PROTOCOL_INVALID');
  if (BOT_RUNTIME_ENGINE_VERSION !== 'UNIFIED-BOT-ENGINE-v1') failures.push('ENGINE_VERSION_INVALID');
  if (BOT_RUNTIME_SHARED_CAPABILITIES.length < 10) failures.push('SHARED_CAPABILITIES_TOO_SMALL');
  for (const [id, role] of Object.entries(BOT_RUNTIME_IDS)) {
    if (!BOT_RUNTIME_ROLES[role]) failures.push('ROLE_UNRESOLVED=' + id);
    else {
      const runtime = getUnifiedBotRuntime(id);
      if (runtime.mutationAuthority && !['REPAIR','MASTER_REPAIR'].includes(role)) failures.push('UNAUTHORIZED_MUTATION_ROLE=' + id);
      if (role === 'MASTER_REPAIR') {
        if (!runtime.canReadRepository || !runtime.canWriteExecutionSource || !runtime.transactionalWrites) failures.push('MASTER_REPAIR_IO_CAPABILITY_MISSING=' + id);
        if (runtime.canWriteTests || runtime.canWriteMain || runtime.canWriteControlPlane) failures.push('MASTER_REPAIR_BOUNDARY_BREACH=' + id);
      }
      if (runtime.certificationAuthority) failures.push('BOT_CERTIFICATION_AUTHORITY_LEAK=' + id);
      if (!runtime.exactShaRequired || !runtime.staleEvidenceRejected) failures.push('IDENTITY_GUARD_MISSING=' + id);
    }
  }
  return Object.freeze({ ok: failures.length === 0, failures });
}
