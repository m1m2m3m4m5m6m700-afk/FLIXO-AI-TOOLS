#!/usr/bin/env node
import assert from 'node:assert/strict'; import fs from 'node:fs';
const s=fs.readFileSync('scripts/ci/agent-session.mjs','utf8'); const r=fs.readFileSync('docs/agents/ledger/README.md','utf8');
assert.match(s,/workPackageId/);assert.match(s,/ONE_TASK_ONE_WORK_PACKAGE/);assert.match(s,/AGENT_CHANGE_EVENT_REQUIRES_FILES/);assert.match(s,/AGENT_TEST_EVENT_REQUIRES_EVIDENCE/);assert.match(s,/AGENT_FINDING_EVENT_REQUIRES_FINDINGS/);assert.match(s,/AGENT_BLOCKER_EVENT_REQUIRES_BLOCKERS/);assert.match(r,/workPackageId/);console.log('AGENT_WORK_PACKAGE_CONTRACT_TEST=PASS');
