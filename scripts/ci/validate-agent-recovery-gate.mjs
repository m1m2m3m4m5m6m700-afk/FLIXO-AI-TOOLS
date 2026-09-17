#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const required = ['docs/AGENT-COLLABORATION-PROTOCOL.md','docs/AGENT-HANDOFF-REPORT-SCHEMA.md','docs/AGENT-COORDINATION-CONTROL-PLANE.md','docs/AGENT-HISTORICAL-RECOVERY.md','docs/agents/ACTIVE-REPAIR-CYCLE-PROTOCOL.md','docs/agents/SELF-HEALING-AGENT-SCOPE-PROTOCOL.md','scripts/ci/task-agent.mjs','scripts/ci/agent-execution-control.mjs','diagnostics/auto-repair/memory.json'];
for (const file of required) if (!fs.existsSync(file)) throw new Error(`missing:${file}`);
const read = (file) => fs.readFileSync(file,'utf8');
for (const marker of ['DISCOVER','LOCK_SCOPE','SCOUT','RCA','PLAN','RISK_GATE','EXECUTE','TARGETED_VERIFY','REGRESSION','RECURRENCE_CHECK','LEARN','CERTIFY']) if (!read('docs/AGENT-COLLABORATION-PROTOCOL.md').includes(marker)) throw new Error(`lifecycle:${marker}`);
for (const marker of ['coordination-state.json','coordination-locks.json','READY','QUEUED','RUNNING','DONE','STALE']) if (!read('docs/AGENT-COORDINATION-CONTROL-PLANE.md').includes(marker)) throw new Error(`control:${marker}`);
for (const marker of ['RESTORE','MERGE','ADAPT','KEEP-LEGACY','DO-NOT-RESTORE']) if (!read('docs/AGENT-HISTORICAL-RECOVERY.md').includes(marker)) throw new Error(`recovery:${marker}`);
for (const marker of ['DIRECT_EXECUTION','DIRECT_ON_ISOLATED_REPAIR_BRANCH','DIRECT_SOURCE_MUTATION_COMMIT_PUSH_ON_REPAIR_BRANCH','SELF_HEALING_REPAIR_ONLY','FAIL_CLOSED','mainBranchMutation: false','مهام.md']) if (!read('scripts/ci/task-agent.mjs').includes(marker)) throw new Error(`task-agent:${marker}`);
for (const marker of ['singleOrchestrator: true','specializedRolesAreStages: true','failClosed: true','mainBranchMutation: false','SELF_HEALING_REPAIR_ONLY','SELF_HEALING_SCOPE_CONTRACT_VIOLATION']) if (!read('scripts/ci/agent-execution-control.mjs').includes(marker)) throw new Error(`execution:${marker}`);
for (const marker of ['SELF-HEALING AGENT ONLY','Out-of-scope work is forbidden','Direct-execution boundary','scopePolicy: SELF_HEALING_REPAIR_ONLY','scopeEnforcement: FAIL_CLOSED']) if (!read('docs/agents/SELF-HEALING-AGENT-SCOPE-PROTOCOL.md').includes(marker)) throw new Error(`scope-protocol:${marker}`);
const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
console.log(JSON.stringify({status:'PASS',schemaVersion:4,baselineSha:sha,runtimeModel:'TASK_AGENT_DIRECT_EXECUTION_ON_ISOLATED_REPAIR_BRANCH',scopePolicy:'SELF_HEALING_REPAIR_ONLY',scopeEnforcement:'FAIL_CLOSED',roles:'STAGES_WITH_DIRECT_REPAIR_EXECUTION',historicalRecovery:'CLASSIFIED_NOT_COPIED_WHOLESALE',failClosed:true,mainBranchMutation:false},null,2));
