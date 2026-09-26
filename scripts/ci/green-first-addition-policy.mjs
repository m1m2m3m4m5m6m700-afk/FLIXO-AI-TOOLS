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
const ADD_MARKER = /\[ADD:([A-Za-z0-9][A-Za-z0-9._-]*)\]/u;
const WP_MARKER = /\[WP:([A-Za-z0-9][A-Za-z0-9._-]*)\]/u;

export function evaluateGreenFirstPolicy({ parentGreen, subject, changedFiles = [] }) {
  const normalizedSubject = String(subject ?? '').trim();
  const repairId = normalizedSubject.match(REPAIR_MARKER)?.[1] ?? null;
  const addId = normalizedSubject.match(ADD_MARKER)?.[1] ?? null;
  const workPackageId = normalizedSubject.match(WP_MARKER)?.[1] ?? null;
  if (parentGreen) return Object.freeze({ state: 'OPEN', allowed: true, reason: 'PARENT_CANONICAL_GREEN', parentGreen: true, repairId, addId, workPackageId, changedFiles });
  if (!workPackageId || (!repairId && !addId)) return Object.freeze({ state: 'BLOCKED', allowed: false, reason: 'RED_SCOPE_REQUIRES_EXPLICIT_CLASSIFICATION', message: 'RED-state work remains bounded and must declare [REPAIR:<ID>] or [ADD:<ID>] together with [WP:<ID>]. Canonical verification, security, certification, exact-SHA and mutation controls remain mandatory.', parentGreen: false, repairId, addId, workPackageId, changedFiles });
  const state = repairId ? 'REPAIR_SCOPE' : 'ADDITIVE_SCOPE';
  return Object.freeze({ state, allowed: true, reason: repairId ? 'RED_REPAIR_EXCEPTION' : 'RED_BOUNDED_ADDITION', message: repairId ? 'Explicitly classified repair scope is permitted while canonical GREEN is pending.' : 'Explicitly classified additive scope is permitted while canonical GREEN is pending under the existing verification and mutation controls.', parentGreen: false, repairId, addId, workPackageId, changedFiles });
}

const run = (args, options = {}) => execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024, ...options }).trim();
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
export const REQUIRED_GREEN_WORKFLOW_PATHS = Object.freeze({
  'FLIXO Test System': '.github/workflows/ci.yml',
  'FLIXO WP0 Trust Baseline': '.github/workflows/wp0-trust-baseline.yml',
  'FLIXO Test Impact': '.github/workflows/test-impact.yml',
  'FLIXO Test Impact Execution': '.github/workflows/test-impact-execution.yml',
  'Repository Security Baseline': '.github/workflows/repository-security-baseline.yml',
  'Claude Security Review': '.github/workflows/claude-security-review.yml',
});
const latestWorkflow = (name) => {
  const workflowPath = REQUIRED_GREEN_WORKFLOW_PATHS[name];
  if (!workflowPath) return null;
  const workflowRuns = runGhJson('repos/' + repository + '/actions/workflows/' + workflowPath + '/runs?head_sha=' + parentSha + '&per_page=5').workflow_runs ?? [];
  return workflowRuns
    .filter(r => r?.name === name && r?.head_sha === parentSha)
    .sort((a,b) => String(a?.updated_at ?? '').localeCompare(String(b?.updated_at ?? '')))
    .at(-1) ?? null;
};
const checkRuns = runGhJson('repos/' + repository + '/commits/' + parentSha + '/check-runs?per_page=100').check_runs ?? [];
const latestCheck = (name) => checkRuns
  .filter(r => r?.name === name && r?.head_sha === parentSha)
  .sort((a,b) => String(a?.completed_at ?? a?.started_at ?? '').localeCompare(String(b?.completed_at ?? b?.started_at ?? '')))
  .at(-1);
const workflowFailures = REQUIRED_GREEN_WORKFLOWS.flatMap(name => { const r = latestWorkflow(name); if (!r) return ['WORKFLOW_MISSING=' + name]; if (r.status !== 'completed' || r.conclusion !== 'success') return ['WORKFLOW_NOT_GREEN=' + name + ':' + r.status + ':' + r.conclusion]; return []; });
const checkFailures = REQUIRED_GREEN_CHECKS.flatMap(name => { const r = latestCheck(name); if (!r) return ['CHECK_MISSING=' + name]; if (r.status !== 'completed' || r.conclusion !== 'success') return ['CHECK_NOT_GREEN=' + name + ':' + r.status + ':' + r.conclusion]; return []; });
const parentGreen = workflowFailures.length === 0 && checkFailures.length === 0;
const decision = evaluateGreenFirstPolicy({ parentGreen, subject, changedFiles });
console.log(JSON.stringify({ schemaVersion: 2, policy: 'BOUNDED_SCOPE_DURING_CANONICAL_GREEN_PENDING', headSha: currentHead, parentSha, parentGreen, requiredWorkflows: REQUIRED_GREEN_WORKFLOWS, requiredChecks: REQUIRED_GREEN_CHECKS, workflowFailures, checkFailures, decision: decision.state, allowed: decision.allowed, repairId: decision.repairId, addId: decision.addId, workPackageId: decision.workPackageId, changedFiles }, null, 2));
if (!decision.allowed) process.exitCode = 1;
