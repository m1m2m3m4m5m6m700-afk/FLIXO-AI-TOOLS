#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.resolve(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.resolve(root, file));
const fail = (code, detail = '') => failures.push(detail ? `${code}=${detail}` : code);

const requiredFiles = [
  'AGENTS.md',
  'المهام.md',
  'PROJECTS.md',
  'docs/AGENT-COLLABORATION-PROTOCOL.md',
  'docs/AGENT-HANDOFF-REPORT-SCHEMA.md',
  'docs/AGENT-COORDINATION-CONTROL-PLANE.md',
  'docs/PROTOCOL-HIERARCHY.md',
  'docs/PROTOCOL-REGISTRY.json',
  'scripts/ci/agent-session.mjs',
  'scripts/ci/agent-execution-control.mjs',
  'scripts/ci/repair-protocol.mjs',
  'scripts/ci/agent-coordination.mjs',
  'scripts/ci/agent-communication.mjs',
  'scripts/ci/test-agent-communication.mjs',
  'scripts/ci/test-agent-admission.mjs',
  'scripts/ci/auto-repair-engine.mjs',
  'scripts/ci/auto-repair-proof.mjs',
  'scripts/validate-ci-contract.mjs',
];
for (const file of requiredFiles) if (!exists(file)) fail('MISSING_PROTOCOL_FILE', file);

const requiredAgentsMarkers = [
  'READ-BEFORE-ACTION', 'AGENT LOGIN', 'OWNERSHIP', 'EXECUTION LEDGER',
  'ROOT-CAUSE-FIRST REPAIR PROTOCOL', 'ROOT-CAUSE ANALYSIS', 'TARGETED REGRESSION',
  'ZERO-FALSE-GREEN', 'COORDINATION CONTROL PLANE', 'HANDOFF / LOGOUT',
  'diagnostics/agents/handoffs/<session-id>.json', 'MANDATORY ENTRY TITLE',
  'trigger → propagation path → violated invariant → responsible source → observable symptom',
  'mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure',
  'docs/PROTOCOL-REGISTRY.json',
  '`PROJECTS.md` → `المهام.md` → `AGENTS.md`',
  'TASK GATE', 'Task Agent preparation-only',
];
if (exists('AGENTS.md')) {
  const text = read('AGENTS.md');
  for (const marker of requiredAgentsMarkers) if (!text.includes(marker)) fail('AGENTS_MISSING', marker);
  if (!text.includes('--from-session=<previous-session>')) fail('AGENTS_MISSING', 'continuation-login');
}

const taskGatewayMarkers = [
  '# FLIXO-AI-TOOLS — سجل التنفيذ الموحد',
  'TASK-LEDGER v3.0 — GREEN-FIRST / EXECUTABLE',
  '## 0) MASTER EXECUTION PROMPT',
  '## 1) P0 — GREEN-RECOVERY-001',
  'STATUS = IN_PROGRESS / BLOCKING',
  'FINGERPRINT → RCA → REPRODUCE → REPAIR → TARGETED REGRESSION → FULL CI',
  '## 2) P0 — AGENT EXECUTION CONTROL',
  '## 3) P0 — ERROR INTELLIGENCE',
  '## 4) P1 — FOUNDATION AFTER GREEN',
  '## 8) DEPENDENCY GRAPH',
  '## 9) DONE / GREEN CONTRACT',
  '## 10) ANTI-COMPLEXITY',
  '## 13) EXCEPTIONAL IDEAS REVIEW',
];

if (exists('المهام.md')) {
  const text = read('المهام.md');
  for (const marker of taskGatewayMarkers) if (!text.includes(marker)) fail('TASK_GATE_MISSING', marker);
}

const requiredProtocolMarkers = [
  'Mandatory entry contract', 'Agent login', 'Central coordination control plane',
  'Ownership lock', 'Action ledger', 'Mandatory session handoff report', 'Handoff',
  'Evidence and provenance', 'Failure and RCA', 'Conflict protocol', 'Certification separation',
  'Logout', 'Enforcement', '--from-session=<previous-session>', 'Root-Cause-First Repair Protocol',
  'causal defect', 'trigger → propagation path → violated invariant → responsible source → observable symptom',
  'targeted regression', 'affected dependency/contract graph', 'Communication-first execution invariant',
  'mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure',
  'symptom-only workaround', 'new deterministic failure',
];
if (exists('docs/AGENT-COLLABORATION-PROTOCOL.md')) {
  const text = read('docs/AGENT-COLLABORATION-PROTOCOL.md');
  for (const marker of requiredProtocolMarkers) if (!text.includes(marker)) fail('PROTOCOL_MISSING', marker);
}

const taskAgentSource = exists('scripts/ci/task-agent.mjs') ? read('scripts/ci/task-agent.mjs') : '';
if (taskAgentSource) {
  for (const marker of ["actor: 'taskAgent'", "preparedOnly: true", "executionMode: 'PREPARATION_ONLY'", "mutationPolicy: 'NO_DIRECT_MUTATION'", "executionAuthority: 'TASK_PREPARATION_ONLY'", "TASK-AGENT-PREPARATION-v3", "applyAuthority: 'EXECUTION_AGENT_OR_REPAIR_AGENT'"]) if (!taskAgentSource.includes(marker)) fail('TASK_AGENT_PREPARATION_CONTRACT_MISSING', marker);
  if (taskAgentSource.includes("TASK_AGENT_DIRECT_EXECUTION") || taskAgentSource.includes("TASK_AGENT_ON_EXECUTION_BRANCH_ONLY")) fail('TASK_AGENT_DIRECT_MUTATION_MARKER_PRESENT');
}
const repairProtocolSource = exists('scripts/ci/repair-protocol.mjs') ? read('scripts/ci/repair-protocol.mjs') : '';
if (repairProtocolSource.includes("mutationAgents: ['repairAgent','implementation','executionAgent','taskAgent']")) fail('TASK_AGENT_MUTATION_AUTHORITY_PRESENT');
if (repairProtocolSource.includes("mutationAgents: ['repairAgent','executionAgent']") === false) fail('REPAIR_MUTATION_AUTHORITY_SET_INVALID');

const repairProtocol = exists('scripts/ci/repair-protocol.mjs') ? read('scripts/ci/repair-protocol.mjs') : '';
const repairEngine = exists('scripts/ci/auto-repair-engine.mjs') ? read('scripts/ci/auto-repair-engine.mjs') : '';
const proofContract = exists('scripts/ci/auto-repair-proof.mjs') ? read('scripts/ci/auto-repair-proof.mjs') : '';
const repairMarkers = [
  'schemaVersion: 6',
  "protocol: 'AUTONOMOUS-REPAIR-PROTOCOL-v4'",
  'evidence.reproductionCommands = evidence.reproductionSelection.commands',
  'diagnosisGate',
  "evidence.outcome = 'proposal-only'",
  'reproductionWasFailing',
  'reproductionRecovered',
  'rootCauseProof',
  'recurrenceProof',
  'firstPass',
  'secondPass',
  'evidence.repairProof = proof',
  'root-cause-proof-reproductionRecovered',
  'diagnosis-proof+root-cause-proof+recurrence-proof+typecheck+static+build',
  'evidence.preventionRule',
  'evidence.escalation',
];
const centralMarkers = ['REPAIR_PROTOCOL', "protocolVersion: '1.0.0'", 'CONTROL_PLANE', 'FAILURE_CAPTURE', 'TARGETED_RETEST', 'RESUME_REMAINING_TESTS', 'ONE_COMMIT_PER_COMPLETED_REPAIR_SESSION', 'protectedPaths', 'validateCommitBoundary', 'validatePostCommitBoundary', 'assertAgentAdmission', 'REPAIR_PROTOCOL_SESSION_REQUIRED', 'REPAIR_PROTOCOL_SELF_MUTATION_BLOCKED'];
for (const marker of centralMarkers) if (repairProtocol && !repairProtocol.includes(marker)) fail('REPAIR_PROTOCOL_CORE_MISSING', marker);
for (const requiredImport of [
  ['scripts/ci/agent-session.mjs', "from './repair-protocol.mjs'"],
  ['scripts/ci/agent-execution-control.mjs', "from './repair-protocol.mjs'"],
  ['scripts/ci/task-agent.mjs', "from './repair-protocol.mjs'"],
  ['scripts/ci/auto-repair-engine.mjs', "from './repair-protocol.mjs'"],
]) { const source = exists(requiredImport[0]) ? read(requiredImport[0]) : ''; if (!source.includes(requiredImport[1])) fail('REPAIR_PROTOCOL_NOT_CONSUMED', requiredImport[0]); }
for (const marker of repairMarkers) if (repairEngine && !repairEngine.includes(marker)) fail('REPAIR_PROTOCOL_MISSING', marker);
for (const marker of ['validateRepairProof', 'preventionRuleFor', 'escalationReason', 'target-sha-missing', 'recurrence-proof-second-pass']) if (proofContract && !proofContract.includes(marker)) fail('REPAIR_PROOF_CONTRACT_MISSING', marker);
if (repairEngine && !repairEngine.includes('if (!verified)')) fail('REPAIR_PROTOCOL_MISSING', 'fail-closed-verification');
if (repairEngine && repairEngine.includes("evidence.outcome = 'verified-repair';") && !repairEngine.includes('const verified = proof.ok')) fail('REPAIR_PROTOCOL_MISSING', 'verified-repair-gate');
const policySource = exists('scripts/ci/auto-repair-policy.mjs') ? read('scripts/ci/auto-repair-policy.mjs') : '';
if (!policySource.includes("'scripts/ci/repair-protocol.mjs'")) fail('REPAIR_PROTOCOL_PROTECTION_MISSING');
if (repairProtocol && !repairProtocol.includes("'scripts/ci/control-plane-registry.mjs'")) fail('REPAIR_PROTOCOL_CORE_MISSING', 'protected-control-plane-registry');

const hierarchyMarkers = [
  'FLIXO Protocol Hierarchy & Anti-Bloat Contract v1', '## Precedence', '## Canonical Protocol Families',
  '## Change-Scope Integrity', '## Dependency-Graph Closure', '## Evidence Freshness & Provenance',
  '## Protocol Conflict Resolution', '## Protocol Addition Gate',
  'recurring failure class proven → existing controls insufficient → invariant named → authoritative enforcement boundary named → regression/enforcement test defined → duplication/conflict analysis passed',
  'docs/PROTOCOL-REGISTRY.json',
];
if (exists('docs/PROTOCOL-HIERARCHY.md')) {
  const text = read('docs/PROTOCOL-HIERARCHY.md');
  for (const marker of hierarchyMarkers) if (!text.includes(marker)) fail('HIERARCHY_MISSING', marker);
}

const registryPath = 'docs/PROTOCOL-REGISTRY.json';
let registry = null;
if (exists(registryPath)) {
  try { registry = JSON.parse(read(registryPath)); }
  catch (error) { fail('PROTOCOL_REGISTRY_INVALID_JSON', error instanceof Error ? error.message : String(error)); }
}
if (registry) {
  if (registry.schemaVersion !== 1 || registry.authority !== 'FLIXO_PROTOCOL_REGISTRY') fail('PROTOCOL_REGISTRY_HEADER_INVALID');
  if (!Array.isArray(registry.precedence) || registry.precedence.length < 2) fail('PROTOCOL_REGISTRY_PRECEDENCE_INVALID');
  if (!Array.isArray(registry.protocols)) fail('PROTOCOL_REGISTRY_PROTOCOLS_INVALID');
  else {
    if (registry.protocols.length !== 20) fail('PROTOCOL_REGISTRY_COUNT', String(registry.protocols.length));
    const ids = registry.protocols.map((p) => p?.id);
    const names = registry.protocols.map((p) => p?.name);
    if (new Set(ids).size !== ids.length) fail('PROTOCOL_REGISTRY_DUPLICATE_IDS');
    if (new Set(names).size !== names.length) fail('PROTOCOL_REGISTRY_DUPLICATE_NAMES');
    for (const protocol of registry.protocols) {
      for (const field of ['id', 'name', 'class', 'status', 'enforcement', 'invariant']) if (typeof protocol?.[field] !== 'string' || !protocol[field].trim()) fail('PROTOCOL_REGISTRY_FIELD_MISSING', `${protocol?.id ?? 'unknown'}.${field}`);
      if (protocol?.status !== 'MANDATORY') fail('PROTOCOL_REGISTRY_NON_MANDATORY', protocol?.id ?? 'unknown');
    }
    const expectedIds = Array.from({ length: 20 }, (_, index) => `P${String(index + 1).padStart(2, '0')}`);
    if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) fail('PROTOCOL_REGISTRY_IDS_INVALID');
  }
}

const requiredHandoffMarkers = ['Canonical path', 'Required fields', 'Continuation', 'completedWork', 'failedWork', 'remainingWork', 'executionPlanNext', 'blockers', 'handoffToNextAgent', 'inheritedExitSha'];
if (exists('docs/AGENT-HANDOFF-REPORT-SCHEMA.md')) {
  const text = read('docs/AGENT-HANDOFF-REPORT-SCHEMA.md');
  for (const marker of requiredHandoffMarkers) if (!text.includes(marker)) fail('HANDOFF_SCHEMA_MISSING', marker);
}

const requiredCoordinationMarkers = ['coordination-state.json', 'coordination-locks.json', 'task-packets', 'task-create', 'task-claim', 'task-release', 'task-complete', 'ingest-handoff', 'COORDINATION_CONFLICT'];
if (exists('scripts/ci/agent-coordination.mjs')) {
  const text = read('scripts/ci/agent-coordination.mjs');
  for (const marker of requiredCoordinationMarkers) if (!text.includes(marker)) fail('COORDINATION_TOOL_MISSING', marker);
}

const packageJson = exists('package.json') ? JSON.parse(read('package.json')) : { scripts: {} };
if (typeof packageJson.scripts?.['validate:agent-protocol'] !== 'string') fail('PACKAGE_SCRIPT_MISSING', 'validate:agent-protocol');
if (typeof packageJson.scripts?.['validate:agent-coordination'] !== 'string') fail('PACKAGE_SCRIPT_MISSING', 'validate:agent-coordination');
if (typeof packageJson.scripts?.['agent:coordination'] !== 'string') fail('PACKAGE_SCRIPT_MISSING', 'agent:coordination');
if (typeof packageJson.scripts?.['test:agent-admission'] !== 'string') fail('PACKAGE_SCRIPT_MISSING', 'test:agent-admission');

const ciContract = exists('scripts/validate-ci-contract.mjs') ? read('scripts/validate-ci-contract.mjs') : '';
if (ciContract && !/scripts\/ci\/validate-agent-protocol\.mjs/u.test(ciContract)) fail('CI_CONTRACT_NOT_WIRED', 'validate-agent-protocol');
if (ciContract && !/scripts\/ci\/validate-agent-coordination\.mjs/u.test(ciContract)) fail('CI_CONTRACT_NOT_WIRED', 'validate-agent-coordination');

const stateFile = 'diagnostics/agents/coordination-state.json';
const lockFile = 'diagnostics/agents/coordination-locks.json';
if (exists(stateFile)) {
  const state = JSON.parse(read(stateFile));
  if (state.schemaVersion !== 1 || state.authority !== 'AGENT_COORDINATION_CONTROL_PLANE') fail('COORDINATION_STATE_INVALID');
  if (!state.tasks || !state.activeSessions) fail('COORDINATION_STATE_SHAPE_INVALID');
}
if (exists(lockFile)) {
  const locks = JSON.parse(read(lockFile));
  if (locks.schemaVersion !== 1 || locks.authority !== 'AGENT_SCOPE_LOCKS') fail('COORDINATION_LOCKS_INVALID');
  if (!locks.locks) fail('COORDINATION_LOCKS_SHAPE_INVALID');
}

const result = {
  schemaVersion: 10,
  authority: 'CI_PROTOCOL_GUARD',
  status: failures.length ? 'FAIL' : 'PASS',
  entryGate: 'PROJECTS.md → المهام.md → AGENTS.md',
  taskGateway: 'المهام.md',
  protocol: 'docs/AGENT-COLLABORATION-PROTOCOL.md',
  protocolHierarchy: 'docs/PROTOCOL-HIERARCHY.md',
  protocolRegistry: 'docs/PROTOCOL-REGISTRY.json',
  approvedProtocolCount: registry?.protocols?.length ?? 0,
  rootCauseRepairProtocol: 'ROOT-CAUSE-FIRST REPAIR PROTOCOL',
  repairProof: 'centralized auto-repair-proof + root-cause-proof + recurrence-proof',
  repairProtocol: 'scripts/ci/repair-protocol.mjs',
  handoffSchema: 'docs/AGENT-HANDOFF-REPORT-SCHEMA.md',
  coordinationControlPlane: 'scripts/ci/agent-coordination.mjs',
  sessionTool: 'scripts/ci/agent-session.mjs',
  handoffPath: 'diagnostics/agents/handoffs/<sessionId>.json',
  statePath: stateFile,
  lockPath: lockFile,
  enforcement: 'scripts/validate-ci-contract.mjs → task gateway + protocol registry + hierarchy + collaboration + coordination + root-cause-first + centralized repair-proof validators',
  failures,
};
fs.mkdirSync(path.resolve(root, 'diagnostics/agents'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/agents/protocol-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
