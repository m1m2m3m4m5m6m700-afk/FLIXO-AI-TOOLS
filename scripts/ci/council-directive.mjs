export const COUNCIL_DIRECTIVE_VERSION = '1.0.0';

export const COUNCIL_DIRECTIVE = Object.freeze({
  version: COUNCIL_DIRECTIVE_VERSION,
  sourceOfWork: 'المهام.md',
  integrationLane: 'execution -> main',
  sourceOfTruth: 'main',
  repairBranch: 'execution',
  greenAuthority: 'Daily·FLIXO Green Gate',
  exactShaRequired: true,
  failClosedOnStaleEvidence: true,
  llmDirectExecution: false,
  thirdBranchAllowed: false,
  branchCreationAllowed: false,
  taskRegistryCount: 1,
  repeatedRedRequiresNewStrategyOrEvidence: true,
  requiredRepairCycle: Object.freeze(['fingerprint','RCA','root-fix','targeted-regression','related-regression','protected-regression','required-CI','exact-SHA-verification','handoff','learning']),
  roles: Object.freeze({
    coordinator: 'observe current SHA/workflow/task ledger/owners/dependencies and coordinate handoff',
    rca: 'failure -> fingerprint -> RCA -> causal source -> repair task',
    repair: 'minimal root fix on execution; never mutate main',
    verification: 'targeted -> related -> protected -> required CI -> exact-SHA validation',
    security: 'classify internal vs external and preserve external blockers as blockers',
    challenge: 'challenge causality, freshness, scope, authority and regression evidence',
    learning: 'record strategy, outcome, SHA, evidence, anti-pattern and next strategy',
  }),
  forbidden: Object.freeze(['fake-green','retry-until-green','test-weakening','symptom-only-repair','stale-evidence-as-proof','third-branch','branch-creation','force-reset-main','parallel-task-registry','llm-direct-execution']),
  closure: Object.freeze(['cause-proven','root-fixed','targeted-pass','related-pass','protected-pass','required-ci-pass','security-pass','exact-sha','handoff-complete','task-complete']),
});

export function assertCouncilDirective(directive = COUNCIL_DIRECTIVE) {
  if (!directive || directive.version !== COUNCIL_DIRECTIVE_VERSION) throw new Error('COUNCIL_DIRECTIVE_VERSION_INVALID');
  if (directive.sourceOfWork !== 'المهام.md' || directive.integrationLane !== 'execution -> main') throw new Error('COUNCIL_DIRECTIVE_AUTHORITY_INVALID');
  if (directive.sourceOfTruth !== 'main' || directive.repairBranch !== 'execution') throw new Error('COUNCIL_DIRECTIVE_BRANCH_BOUNDARY_INVALID');
  if (directive.greenAuthority !== 'Daily·FLIXO Green Gate' || directive.exactShaRequired !== true) throw new Error('COUNCIL_DIRECTIVE_GREEN_AUTHORITY_INVALID');
  if (directive.llmDirectExecution !== false || directive.thirdBranchAllowed !== false || directive.branchCreationAllowed !== false) throw new Error('COUNCIL_DIRECTIVE_EXECUTION_BOUNDARY_INVALID');
  if (directive.taskRegistryCount !== 1 || directive.repeatedRedRequiresNewStrategyOrEvidence !== true) throw new Error('COUNCIL_DIRECTIVE_COORDINATION_INVALID');
  return true;
}
