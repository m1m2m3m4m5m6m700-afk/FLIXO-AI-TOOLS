#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const required = ['docs/AGENT-COLLABORATION-PROTOCOL.md','docs/AGENT-HANDOFF-REPORT-SCHEMA.md','docs/AGENT-COORDINATION-CONTROL-PLANE.md','docs/AGENT-HISTORICAL-RECOVERY.md','scripts/ci/task-agent.mjs','scripts/ci/agent-execution-control.mjs','diagnostics/auto-repair/memory.json'];
for (const file of required) if (!fs.existsSync(file)) throw new Error(`missing:${file}`);
const read = (file) => fs.readFileSync(file,'utf8');
for (const marker of ['DISCOVER','LOCK_SCOPE','SCOUT','RCA','PLAN','RISK_GATE','EXECUTE','TARGETED_VERIFY','REGRESSION','RECURRENCE_CHECK','LEARN','CERTIFY']) if (!read('docs/AGENT-COLLABORATION-PROTOCOL.md').includes(marker)) throw new Error(`lifecycle:${marker}`);
for (const marker of ['coordination-state.json','coordination-locks.json','READY','QUEUED','RUNNING','DONE','STALE']) if (!read('docs/AGENT-COORDINATION-CONTROL-PLANE.md').includes(marker)) throw new Error(`control:${marker}`);
for (const marker of ['RESTORE','MERGE','ADAPT','KEEP-LEGACY','DO-NOT-RESTORE']) if (!read('docs/AGENT-HISTORICAL-RECOVERY.md').includes(marker)) throw new Error(`recovery:${marker}`);
for (const marker of ['PREPARATION_ONLY','NO_SOURCE_MUTATION_NO_COMMIT_NO_PUSH','مهام.md']) if (!read('scripts/ci/task-agent.mjs').includes(marker)) throw new Error(`task-agent:${marker}`);
for (const marker of ['singleOrchestrator: true','specializedRolesAreStages: true','failClosed: true']) if (!read('scripts/ci/agent-execution-control.mjs').includes(marker)) throw new Error(`execution:${marker}`);
const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
console.log(JSON.stringify({status:'PASS',schemaVersion:1,baselineSha:sha,runtimeModel:'TASK_AGENT_PLUS_SINGLE_ORCHESTRATOR',roles:'STAGES_NOT_STANDALONE_AGENTS',historicalRecovery:'CLASSIFIED_NOT_COPIED_WHOLESALE',failClosed:true},null,2));
