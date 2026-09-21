export const COUNCIL_DIRECTIVE_VERSION = '1.0.0';

export const COUNCIL_DIRECTIVE = Object.freeze({
  version: COUNCIL_DIRECTIVE_VERSION,
  councilPriority: 'P0',
  councilPreemption: 'SAFE_BOUNDARY',
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
  councilOperationsAreP0: true,
  repeatedRedRequiresNewStrategyOrEvidence: true,
  focusWithoutFreeze: 'stay focused on the assigned work package; do not enter FREEZE merely because execution is long or pressured; freeze only on stale/conflicting evidence, missing authority, unsafe scope, or required external blocker',
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
  operatingMessage: 'FOCUS ON THE ASSIGNED WORK PACKAGE. DO NOT ENTER FREEZE, SLEEP, IDLE, SILENT, OR ABANDONED. CONTINUE THE CURRENT CONTROLLED LIFECYCLE UNTIL VERIFIED OR AN EXPLICIT AUTHORITY DECISION ABORTS IT.',
  liveness: Object.freeze({
    protocol: 'AGENT_LIVENESS_PROTOCOL',
    heartbeatEveryMinutes: 5,
    heartbeatGraceMinutes: 2,
    leaseTtlMinutes: 15,
    progressWindowMinutes: 10,
    maxNoProgressHeartbeats: 3,
    forbiddenStates: Object.freeze(['SLEEP','IDLE','SILENT','ABANDONED']),
    staleAction: 'RECOVER_AND_CONTINUE',
    externalWaitAction: 'WAITING_EXTERNAL_WITH_HEARTBEAT',
    abortRequires: 'EXPLICIT_ABORT_AUTHORITY',
  }),
  closure: Object.freeze(['cause-proven','root-fixed','targeted-pass','related-pass','protected-pass','required-ci-pass','security-pass','exact-sha','handoff-complete','task-complete']),
});

export function assertCouncilDirective(directive = COUNCIL_DIRECTIVE) {
  if (!directive || directive.version !== COUNCIL_DIRECTIVE_VERSION) throw new Error('COUNCIL_DIRECTIVE_VERSION_INVALID');
  if (directive.sourceOfWork !== 'المهام.md' || directive.integrationLane !== 'execution -> main') throw new Error('COUNCIL_DIRECTIVE_AUTHORITY_INVALID');
  if (directive.sourceOfTruth !== 'main' || directive.repairBranch !== 'execution') throw new Error('COUNCIL_DIRECTIVE_BRANCH_BOUNDARY_INVALID');
  if (directive.greenAuthority !== 'Daily·FLIXO Green Gate' || directive.exactShaRequired !== true) throw new Error('COUNCIL_DIRECTIVE_GREEN_AUTHORITY_INVALID');
  if (directive.llmDirectExecution !== false || directive.thirdBranchAllowed !== false || directive.branchCreationAllowed !== false) throw new Error('COUNCIL_DIRECTIVE_EXECUTION_BOUNDARY_INVALID');
  if (directive.taskRegistryCount !== 1 || directive.repeatedRedRequiresNewStrategyOrEvidence !== true) throw new Error('COUNCIL_DIRECTIVE_COORDINATION_INVALID');
  if (directive.councilPriority !== 'P0' || directive.councilPreemption !== 'SAFE_BOUNDARY' || directive.councilOperationsAreP0 !== true) throw new Error('COUNCIL_DIRECTIVE_PRIORITY_INVALID');
  if (directive.liveness?.protocol !== 'AGENT_LIVENESS_PROTOCOL' || directive.liveness?.forbiddenStates?.includes('SLEEP') !== true || directive.liveness?.staleAction !== 'RECOVER_AND_CONTINUE') throw new Error('COUNCIL_DIRECTIVE_LIVENESS_INVALID');
  return true;
}
