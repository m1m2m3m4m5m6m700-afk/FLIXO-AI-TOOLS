#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildWakePlan, PRESIDENT_WAKE_MARKER } from './council-wake-dispatch.mjs';
const sha = 'a'.repeat(40);
const base = [
  PRESIDENT_WAKE_MARKER,
  '# PRESIDENT WAKE — SCOUT',
  '',
  'ENTRY SHA: ' + sha,
  'CANONICAL PR: #759',
  'TOPOLOGY: execution → main ONLY',
  'ROLE: SCOUT',
  'WORK PACKAGE: CODE-SCOUT-CURRENT-TRUTH-001',
].join('\n');
const president = buildWakePlan({ comment: base.replace('ROLE: SCOUT', 'ROLE: PRESIDENT').replace('WORK PACKAGE: CODE-SCOUT-CURRENT-TRUTH-001', 'WORK PACKAGE: COUNCIL-P0-001'), currentExecutionSha: sha });
assert.equal(president.mode, 'WORKFLOW_DISPATCH');
assert.equal(president.workflow, 'council-priority-wake.yml');
assert.equal(president.machineRole, 'assistantController');
assert.equal(president.priority, 'P0');
assert.equal(president.preemption, 'SAFE_BOUNDARY');
assert.equal(president.councilOperation, true);
console.log('COUNCIL_WAKE_PRESIDENT_P0_ROUTE=PASS');
const scout = buildWakePlan({ comment: base, currentExecutionSha: sha, repository: 'test/repo' });
assert.equal(scout.mode, 'WORKFLOW_DISPATCH');
assert.equal(scout.workflow, 'code-read-only-scout.yml');
assert.equal(scout.machineRole, 'codeScout');
assert.equal(scout.workflowInput.expected_sha, undefined);
console.log('COUNCIL_WAKE_SCOUT_ROUTE=PASS');
const investigator = buildWakePlan({ comment: base.replace('ROLE: SCOUT', 'ROLE: INVESTIGATOR').replace('WORK PACKAGE: CODE-SCOUT-CURRENT-TRUTH-001', 'WORK PACKAGE: ROOT-CAUSE-SPINE-001'), currentExecutionSha: sha });
assert.equal(investigator.workflow, 'ultra-investigator.yml');
assert.equal(investigator.workflowInput.expected_sha, sha);
console.log('COUNCIL_WAKE_INVESTIGATOR_ROUTE=PASS');
const external = buildWakePlan({ comment: base.replace('ROLE: SCOUT', 'ROLE: EXECUTION').replace('WORK PACKAGE: CODE-SCOUT-CURRENT-TRUTH-001', 'WORK PACKAGE: RED-RECOVERY-COMMUNICATION-001'), currentExecutionSha: sha });
assert.equal(external.mode, 'EXTERNAL_AGENT_WAKE_REQUIRED');
assert.equal(external.workflow, null);
console.log('COUNCIL_WAKE_EXTERNAL_ROUTE=PASS');
assert.throws(() => buildWakePlan({ comment: base, currentExecutionSha: 'b'.repeat(40) }), /COUNCIL_WAKE_STALE_SHA/);
assert.throws(() => buildWakePlan({ comment: base.replace(PRESIDENT_WAKE_MARKER, ''), currentExecutionSha: sha }), /COUNCIL_WAKE_MARKER_MISSING/);
assert.throws(() => buildWakePlan({ comment: base.replace('WORK PACKAGE: CODE-SCOUT-CURRENT-TRUTH-001', 'WORK PACKAGE: X'), currentExecutionSha: sha }), /COUNCIL_WAKE_WORK_PACKAGE_INVALID/);
console.log('COUNCIL_WAKE_FAIL_CLOSED=PASS');
