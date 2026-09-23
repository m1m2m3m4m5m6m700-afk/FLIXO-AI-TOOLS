#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (file) => fs.readFileSync(file, 'utf8');
const run = (script) => {
  execFileSync(process.execPath, [script], {
    stdio: 'inherit',
    env: process.env,
  });
};

const contract = JSON.parse(read('docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json'));
const chair = read('scripts/ci/chair-bound-execution.mjs');
const guard = read('scripts/ci/guard-communication.mjs');
const session = read('scripts/ci/agent-session.mjs');
const handoff = read('docs/AGENT-HANDOFF-REPORT-SCHEMA.md');

assert.match(
  contract.protocols.mutation_ownership,
  /any authorized agent may explicitly take Chair-1 under the exact current SHA/u,
);
assert.match(
  contract.protocols.mutation_ownership,
  /MUST continue its assigned task/u,
);
assert.match(
  contract.protocols.mutation_ownership,
  /submit the complete result through Chair-1 Guard/u,
);
assert.match(chair, /export function takeChair1/u);
assert.match(chair, /canContinueTask:true/u);
assert.match(chair, /canMutateAfterPreemption:false/u);
assert.match(session, /CONTINUITY_HANDOFF_ONLY/u);
assert.match(session, /CHAIR_PREEMPTION_CONTINUITY_ACTIVE/u);
assert.match(guard, /acknowledgePendingPush/u);
assert.match(guard, /PUSH_PENDING/u);
assert.match(guard, /changeDetailsPresent/u);
assert.doesNotMatch(guard, /requestFullDetails|recordFullDetails/u);
assert.doesNotMatch(guard, /REJECTED|NEEDS_MORE_EVIDENCE|DETAILS_REQUESTED|DETAILS_COMPLETE/u);
assert.match(handoff, /PUSH_PENDING_ACK_ONLY/u);
assert.match(handoff, /Chair 1 then reads the full report/u);

const exactHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.match(exactHead, /^[0-9a-f]{40}$/u);

const suites = [
  'scripts/ci/test-chair-bound-execution.mjs',
  'scripts/ci/test-agent-coordination.mjs',
  'scripts/ci/test-agent-isolated-workspace.mjs',
  'scripts/ci/test-chair1-change-accumulator.mjs',
  'scripts/ci/test-execution-head-authority.mjs',
  'scripts/ci/test-guard-communication.mjs',
  'scripts/ci/test-agent-guard-change-handoff.mjs',
];

for (const suite of suites) run(suite);

console.log(`CANONICAL_GOVERNANCE_GREEN=PASS SHA=${exactHead}`);
console.log(`CANONICAL_GOVERNANCE_SUITES=${suites.length}`);
