#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

export const REQUIRED_GREEN_WORKFLOWS = Object.freeze([
  'FLIXO Test System',
  'FLIXO WP0 Trust Baseline',
  'FLIXO Test Impact',
  'FLIXO Test Impact Execution',
  'Repository Security Baseline',
  'Claude Security Review',
]);
export const REQUIRED_GREEN_CHECKS = Object.freeze(['trust-gate', 'Exact-SHA promotion proof', 'Certification']);
const REPAIR_MARKER = /\[REPAIR:([A-Za-z0-9][A-Za-z0-9._-]*)\]/u;
const WP_MARKER = /\[WP:([A-Za-z0-9][A-Za-z0-9._-]*)\]/u;

export function evaluateGreenFirstPolicy({ parentGreen, subject, changedFiles = [] }) {
  const normalizedSubject = String(subject ?? '').trim();
  const repairId = normalizedSubject.match(REPAIR_MARKER)?.[1] ?? null;
  const workPackageId = normalizedSubject.match(WP_MARKER)?.[1] ?? null;
  if (parentGreen) return Object.freeze({ state: 'OPEN', allowed: true, reason: 'PARENT_CANONICAL_GREEN', parentGreen: true, repairId, workPackageId, changedFiles });
  if (!repairId || !workPackageId) return Object.freeze({ state: 'BLOCKED', allowed: false, reason: 'RED_TEST_SYSTEM_BLOCKS_NEW_ADDITIONS', message: 'No new additive scope is allowed while the previous exact-SHA canonical test system is not fully GREEN. RED-state mutations require [REPAIR:<ID>] and [WP:<ID>] and remain under the existing repair/control-plane contracts.', parentGreen: false, repairId, workPackageId, changedFiles });
  return Object.freeze({ state: 'REPAIR_ONLY', allowed: true, reason: 'RED_REPAIR_EXCEPTION', message: 'Only explicitly classified repair mutation is permitted while the previous exact-SHA canonical test system is RED. Existing repair protocol, mutation gate and Exact-SHA verification remain authoritative.', parentGreen: false, repairId, workPackageId, changedFiles });
}

const run = (args, options = {}) => execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
const runGhJson = (endpoint) => JSON.parse(run(['gh', 'api', endpoint], { env: process.env }));
const shaOk = (value) => /^[0-9a-f]{40}$/u.test(String(value ?? ''));
const currentHead = String(process.env.GREEN_FIRST_HEAD_SHA ?? run(['git', 'rev-parse', 'HEAD'])).trim();
if (!shaOk(currentHead)) throw new Error('GREEN_FIRST_HEAD_SHA_INVALID');
const parentSha = run(['git', 'rev-parse', currentHead + '^']);
if (!shaOk(parentSha)) throw new Error('GREEN_FIRST_PARENT_SHA_INVALID');
const subject = run(['git', 'log', '-1', '--format=%s', currentHead]);
const changedFiles = run(['git', 'diff', '--name-only', parentSha, currentHead]).split('\n').map(v => v.trim()).filter(Boolean);
const repository = String(process.env.GITHUB_REPOSITORY ?? '').trim();
if (!repository) throw new Error('GREEN_FIRST_REPOSITORY_REQUIRED');
const workflowRuns = runGhJson('repos/' + repository + '/actions/runs?head_sha=' + parentSha + '&per_page=100').workflow_runs ?? [];
const checkRuns = runGhJson('repos/' + repository + '/commits/' + parentSha + '/check-runs?per_page=100').check_runs ?? [];
const latestWorkflow = (name) => workflowRuns.filter(r => r?.name === name && r?.head_sha === parentSha).sort((a,b) => String(a?.updated_at ?? '').localeCompare(String(b?.updated_at ?? ''))).at(-1);
const latestCheck = (name) => checkRuns.filter(r => r?.name === name && r?.head_sha === parentSha).sort((a,b) => String(a?.completed_at ?? a?.started_at ?? '').localeCompare(String(b?.completed_at ?? b?.started_at ?? ''))).at(-1);
const workflowFailures = REQUIRED_GREEN_WORKFLOWS.flatMap(name => { const r = latestWorkflow(name); if (!r) return ['WORKFLOW_MISSING=' + name]; if (r.status !== 'completed' || r.conclusion !== 'success') return ['WORKFLOW_NOT_GREEN=' + name + ':' + r.status + ':' + r.conclusion]; return []; });
const checkFailures = REQUIRED_GREEN_CHECKS.flatMap(name => { const r = latestCheck(name); if (!r) return ['CHECK_MISSING=' + name]; if (r.status !== 'completed' || r.conclusion !== 'success') return ['CHECK_NOT_GREEN=' + name + ':' + r.status + ':' + r.conclusion]; return []; });
const parentGreen = workflowFailures.length === 0 && checkFailures.length === 0;
const decision = evaluateGreenFirstPolicy({ parentGreen, subject, changedFiles });
console.log(JSON.stringify({ schemaVersion: 1, policy: 'NO_NEW_ADDITIONS_BEFORE_FULL_CANONICAL_GREEN', headSha: currentHead, parentSha, parentGreen, requiredWorkflows: REQUIRED_GREEN_WORKFLOWS, requiredChecks: REQUIRED_GREEN_CHECKS, workflowFailures, checkFailures, decision: decision.state, allowed: decision.allowed, repairId: decision.repairId, workPackageId: decision.workPackageId, changedFiles }, null, 2));
if (!decision.allowed) process.exitCode = 1;
