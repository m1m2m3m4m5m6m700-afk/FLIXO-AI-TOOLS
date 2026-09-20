#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.resolve(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.resolve(root, file));

const expected = {
  'scripts/ci/agent-coordination.mjs': ['task-create', 'task-claim', 'task-release', 'task-complete', 'visible', 'ingest-handoff', 'COORDINATION_CONFLICT', 'AGENT_VISIBILITY', 'TASK_COMPLETION_REQUIRES_VERIFIED_AGENT_STATUS', 'getAgentMessage', 'COORDINATION_MESSAGE_NOT_READ', 'COORDINATION_MESSAGE_SHA_STALE', 'consumeAgentMessage', 'COORDINATION_WRITE_LOCK', 'COORDINATION_STATE_VERSION_CONFLICT', 'COORDINATION_TRANSACTION_MISMATCH', 'writeJsonAtomic', 'transactionId', 'COORDINATION_MUTATION_BRANCH_BLOCKED', 'HANDOFF_STALE_EXIT_SHA', 'HANDOFF_SCOPE_EXPANSION_BLOCKED', 'COORDINATION_GOVERNANCE_DRIFT', 'STALE_SESSION_KILL_SWITCH', 'AGENT_COORDINATION_FAST_READ_PATH', 'COORDINATION_READ_SHA_STALE', 'COORDINATION_READ_STATE_MISMATCH', 'TASK_OWNER_ROLE_REQUIRED', 'TASK_OWNER_ROLE_MISMATCH', 'TASK_WORK_PACKAGE_REQUIRED', 'TASK_WORK_ITEMS_REQUIRED', 'TASK_PROOF_OBLIGATIONS_REQUIRED'],
  'scripts/ci/agent-communication.mjs': ['validateMessage', 'ingest', 'markRead', 'markConsumed', 'AGENT_MESSAGE_IDEMPOTENCY_COLLISION', 'AGENT_MESSAGE_STALE_REQUIRES_REVALIDATION'],
  'scripts/ci/test-agent-communication.mjs': ['AGENT_COMMUNICATION_TEST=PASS', 'MESSAGE_IDEMPOTENCY=PASS', 'STALE_MESSAGE_FAIL_CLOSED=PASS'],
  'scripts/ci/test-agent-coordination.mjs': ['AGENT_COORDINATION_ATOMIC_TEST=PASS', 'COORDINATION_SINGLE_WINNER=PASS', 'COORDINATION_REVISION=PASS', 'STALE_SESSION_KILL_SWITCH=PASS', 'HANDOFF_ADMISSION_PARITY=PASS', 'HANDOFF_STALE_FAIL_CLOSED=PASS'],
  '.github/workflows/agent-communication-relay.yml': ['issue_comment', 'Immediate agent message receive', 'agent-communication.mjs', 'IMMEDIATE_EVENT_RECEIPT', 'github.event.issue.number == 759', 'PRESIDENT WAKE', 'council-wake-dispatch.mjs'],
    'scripts/ci/council-wake-dispatch.mjs': ['ROLE_ROUTES', 'COUNCIL_WAKE_STALE_SHA', 'EXTERNAL_AGENT_WAKE_REQUIRED', 'WORKFLOW_DISPATCH'],
  'scripts/ci/test-council-wake-dispatch.mjs': ['COUNCIL_WAKE_SCOUT_ROUTE=PASS', 'COUNCIL_WAKE_INVESTIGATOR_ROUTE=PASS', 'COUNCIL_WAKE_EXTERNAL_ROUTE=PASS', 'COUNCIL_WAKE_FAIL_CLOSED=PASS'],
  'scripts/ci/agent-session.mjs': ['login', 'event', 'logout', 'message-receive', 'message-consume', '--from-session=<previous-session>', '--task=<task-id>', 'AGENT_MESSAGE_NOT_EXECUTION_READY', 'P0_COMMUNICATION_FIRST', 'VERIFIED', 'BLOCKED', 'FINAL_SUMMARY_REQUIRED_BEFORE_SESSION_CLOSE', 'AGENT_EVENT_SUMMARY_REQUIRED', 'VERIFIED_LOGOUT_REQUIRES_ACTIVITY_LOG', 'docs/agents/ledger', 'CONTINUATION_STALE_EXIT_SHA', 'AGENT_SESSION_STALE_ENTRY_SHA', 'AGENT_SESSION_GOVERNANCE_DRIFT'],
  'docs/AGENT-HANDOFF-REPORT-SCHEMA.md': ['completedWork', 'failedWork', 'remainingWork', 'executionPlanNext', 'handoffToNextAgent'],
  'docs/AGENT-COLLABORATION-PROTOCOL.md': ['Multi-Agent', 'handoff', 'scope', 'RCA', 'Assistant/controller', 'Execution Agent', 'Evidence over assertion', 'Stop-and-escalate', 'Challenge-before-mutation', 'Independent review', 'Decision trace', 'Parallel execution protocol', 'Conflict arbitration', 'Quality dimensions', 'Council President', 'Council Deputy', 'Council Investigator', 'large Work Package', 'PRESIDENT → DEPUTY → INVESTIGATOR'],
  'docs/agents/ledger/README.md': ['Agent Visibility Ledger', 'docs/agents/ledger/<sessionId>.json', 'taskId', 'finalStatus', 'finalSummary', 'visibilityState'],
  'docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json': ['ASSISTANT_AGENT_COOPERATION_CONTRACT', 'assistantController', 'councilPresident', 'councilDeputy', 'councilInvestigator', 'codeScout', 'executionAgent', 'reviewAgent', 'testAgent', 'securityAgent', 'performanceAgent', 'certificationAuthority', 'messageEnvelope', 'no_implicit_authority', 'parallelism', 'arbitration', 'architecture', 'quality', 'efficiency', 'recovery', 'security', 'release', 'communication_first', 'event_driven_delivery', 'message_idempotency', 'message_freshness'],
  'docs/READ-ONLY-CODE-SCOUT-PROTOCOL.md': ['READ', 'WRITE', 'FORBIDDEN', 'NO_SOURCE_MUTATION', 'code-scout-latest.json', 'execution agents'],
};

for (const [file, markers] of Object.entries(expected)) {
  if (!exists(file)) { failures.push(`MISSING=${file}`); continue; }
  const text = read(file);
  for (const marker of markers) if (!text.includes(marker)) failures.push(`MISSING_MARKER=${file}:${marker}`);
}

if (exists('docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json')) {
  try {
    const contract = JSON.parse(read('docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json'));
    if (contract?.schemaVersion !== 5) failures.push('COOPERATION_SCHEMA_INVALID');
    if (contract?.authority !== 'ASSISTANT_AGENT_COOPERATION_CONTRACT') failures.push('COOPERATION_AUTHORITY_INVALID');
    const rules = ['command','truth','evidence','delegation','checkpoint','challenge','independent_review','feedback','handoff','stop','verification','learning','decision_trace','fresh_state','parallelism','arbitration','architecture','quality','efficiency','recovery','security','release','no_implicit_authority'];
    for (const key of rules) if (typeof contract?.protocols?.[key] !== 'string' || !contract.protocols[key].trim()) failures.push(`COOPERATION_RULE_MISSING=${key}`);
    for (const key of ['messageId','actor','recipient','intent','taskId','scope','entrySha','risk','dependencies','expectedEvidence','stopConditions','proofObligations','createdAt']) if (!contract?.messageEnvelope?.required?.includes(key)) failures.push(`COOPERATION_ENVELOPE_MISSING=${key}`);
    for (const key of ['status','exitSha','changedFiles','commands','evidenceRefs','remainingWork','openRcas','nextAction','decisionTrace','verificationState','ownershipState','messageId','messageStatus']) if (!contract?.messageEnvelope?.completion?.includes(key)) failures.push(`COOPERATION_COMPLETION_MISSING=${key}`);
    for (const role of ['assistantController','codeScout','executionAgent','reviewAgent','testAgent','securityAgent','performanceAgent','certificationAuthority']) if (typeof contract?.roles?.[role] !== 'string') failures.push(`COOPERATION_ROLE_MISSING=${role}`);
    if (!/no.*mutation|read.*repository state/i.test(contract?.roles?.codeScout ?? '')) failures.push('CODE_SCOUT_MUTATION_BOUNDARY_MISSING');
    for (const tier of ['LOW','MEDIUM','HIGH','CRITICAL']) if (typeof contract?.decisionGates?.[tier] !== 'string') failures.push(`COOPERATION_RISK_GATE_MISSING=${tier}`);
    if (!Array.isArray(contract?.collaborationFlow) || contract.collaborationFlow.length < 10) failures.push('COLLABORATION_FLOW_INCOMPLETE');
    if (contract?.investigation?.canonicalReport !== 'diagnostics/investigation/code-scout-latest.json') failures.push('SCOUT_REPORT_PATH_INVALID');
    if (!Array.isArray(contract?.messageLifecycle) || JSON.stringify(contract.messageLifecycle) !== JSON.stringify(['RECEIVED','READ','CONSUMED','STALE','BLOCKED_CONFLICT'])) failures.push('MESSAGE_LIFECYCLE_INVALID');
    if (contract?.communication?.ingress !== 'Canonical Council PR #759') failures.push('COMMUNICATION_INGRESS_INVALID');
    if (contract?.communication?.dispatcher !== '.github/workflows/agent-communication-relay.yml') failures.push('COMMUNICATION_DISPATCHER_INVALID');
    if (contract?.roles?.councilPresident !== 'assistantController: presidential control, assignment and integration decisions; no mutation or certification') failures.push('COUNCIL_PRESIDENT_ROLE_INVALID');
    if (!String(contract?.roles?.councilDeputy ?? '').includes('verification')) failures.push('COUNCIL_DEPUTY_ROLE_INVALID');
    if (!String(contract?.roles?.councilInvestigator ?? '').includes('analysis')) failures.push('COUNCIL_INVESTIGATOR_ROLE_INVALID');
    if (contract?.communication?.relay !== '.github/workflows/agent-communication-relay.yml') failures.push('COMMUNICATION_RELAY_INVALID');
    if (contract?.communication?.implementation !== 'scripts/ci/agent-communication.mjs') failures.push('COMMUNICATION_IMPLEMENTATION_INVALID');
  } catch { failures.push('COOPERATION_JSON_INVALID'); }
}

if (exists('.github/workflows/agent-master-activation.yml') && read('.github/workflows/agent-master-activation.yml').includes('issue comment 761')) failures.push('LEGACY_761_ACTIVATION_DETECTED');
if (exists('.github/workflows/repair-agent-intake.yml') && /gh\\s+issue\\s+comment\\s+759/.test(read('.github/workflows/repair-agent-intake.yml'))) failures.push('LEGACY_GH_ISSUE_COMMENT_IN_INTAKE');
if (exists('.github/workflows/agent-master-activation.yml') && /gh\\s+issue\\s+comment\\s+759/.test(read('.github/workflows/agent-master-activation.yml'))) failures.push('LEGACY_GH_ISSUE_COMMENT_IN_ACTIVATION');
const councilRuntime = exists('supabase/functions/flixo-council-runtime/index.ts') ? read('supabase/functions/flixo-council-runtime/index.ts') : '';
const councilPushRelay = exists('.github/workflows/council-wake-push-relay.yml') ? read('.github/workflows/council-wake-push-relay.yml') : '';
if (councilPushRelay && councilRuntime && !councilRuntime.includes('workflow === "FLIXO Council Wake Push Relay"')) failures.push('COUNCIL_PUSH_RELAY_OIDC_ALLOWLIST_MISSING');
if (exists('.github/workflows/repository-security-baseline.yml') && !/actions\\/checkout@[a-f0-9]{40}/u.test(read('.github/workflows/repository-security-baseline.yml'))) failures.push('SECURITY_BASELINE_CHECKOUT_NOT_IMMUTABLE');
if (exists('scripts/ci/validate-council-rpc-contract.mjs') && exists('db/council-external-accounts.sql') && !read('db/council-external-accounts.sql').includes('create or replace function public.council_claim_dispatch')) failures.push('COUNCIL_RPC_CONTRACT_MISSING');

const scout = exists('scripts/ci/code-read-only-scout.mjs') ? read('scripts/ci/code-read-only-scout.mjs') : '';
if (!scout) failures.push('SCOUT_SCRIPT_MISSING');
else {
  for (const marker of ["authority: 'READ_ONLY_CODE_SCOUT'", "mode: 'READ_ONLY_ANALYSIS'", "mutationPolicy: 'NO_SOURCE_MUTATION'", 'git ls-files', 'writeFileSync(OUTPUT']) if (!scout.includes(marker)) failures.push(`SCOUT_MARKER_MISSING=${marker}`);
  if (/git\s+add|git\s+commit|git\s+push|update_file|create_file|delete_file/.test(scout)) failures.push('SCOUT_FORBIDDEN_MUTATION_OPERATION_DETECTED');
}

const ledgerDir = path.resolve(root, 'docs/agents/ledger');
if (exists('docs/agents/ledger/README.md')) {
  for (const entry of fs.readdirSync(ledgerDir).filter((name) => name.endsWith('.json'))) {
    try {
      const item = JSON.parse(fs.readFileSync(path.join(ledgerDir, entry), 'utf8'));
      for (const key of ['taskId','sessionId','agentId','role','entrySha','status','visibilityState','updatedAt']) if (!(key in item)) failures.push(`VISIBILITY_LEDGER_FIELD_MISSING=${entry}:${key}`);
      if (!['OPEN','CLOSED'].includes(item.visibilityState)) failures.push(`VISIBILITY_LEDGER_STATE_INVALID=${entry}`);
      if (item.visibilityState === 'CLOSED') {
        for (const key of ['exitSha','finalStatus','finalSummary']) if (!(key in item) || !String(item[key] ?? '').trim()) failures.push(`VISIBILITY_LEDGER_FINAL_FIELD_MISSING=${entry}:${key}`);
        if (!['VERIFIED','BLOCKED'].includes(item.finalStatus)) failures.push(`VISIBILITY_LEDGER_FINAL_STATUS_INVALID=${entry}`);
      }
    } catch { failures.push(`VISIBILITY_LEDGER_INVALID_JSON=${entry}`); }
  }
}

const packageJson = exists('package.json') ? JSON.parse(read('package.json')) : { scripts: {} };
for (const key of ['validate:agent-coordination','agent:coordination','agent:communication','test:agent-communication','validate:code-scout','agent:code-scout','test:council-wake','agent:council-wake']) if (typeof packageJson.scripts?.[key] !== 'string') failures.push(`PACKAGE_SCRIPT_MISSING=${key}`);

const protocolRegistry = exists('docs/PROTOCOL-REGISTRY.json') ? JSON.parse(read('docs/PROTOCOL-REGISTRY.json')) : null;
if (!protocolRegistry) failures.push('PROTOCOL_REGISTRY_MISSING');
else {
  const p20 = protocolRegistry.protocols?.find((item) => item?.id === 'P20');
  for (const marker of ['decision provenance','independent verification','parallel work','conflicts','dependency edges','learning never grants authority']) if (!p20?.invariant?.includes(marker)) failures.push(`P20_COOPERATION_EXTENSION_MISSING=${marker}`);
}

const sha = execFileSync('git', ['rev-parse','HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const result = { schemaVersion: 7, authority: 'AGENT_COORDINATION_GUARD', status: failures.length ? 'FAIL' : 'PASS', checkedSha: sha, controlPlane: 'scripts/ci/agent-coordination.mjs', sessionTool: 'scripts/ci/agent-session.mjs', cooperationContract: 'docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json', scoutProtocol: 'docs/READ-ONLY-CODE-SCOUT-PROTOCOL.md', scout: 'scripts/ci/code-read-only-scout.mjs', protocolRegistry: 'docs/PROTOCOL-REGISTRY.json#P20', runtimeStatePolicy: 'generated-and-ignored', atomicCoordination: 'WRITE_LOCK_PLUS_OPTIMISTIC_REVISION_AND_ATOMIC_RENAME', failures };
fs.mkdirSync(path.resolve(root,'diagnostics/agents'), { recursive:true });
fs.writeFileSync(path.resolve(root,'diagnostics/agents/coordination-validation.json'), `${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result,null,2));
if (failures.length) process.exit(1);
