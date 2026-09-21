#!/usr/bin/env node
import fs from 'node:fs';

export const PRESIDENT_WAKE_MARKER = '<!-- FLIXO_AGENT_COUNCIL_WAKE -->';
export const COUNCIL_PRIORITY = 'P0';
export const ROLE_ROUTES = Object.freeze({
  PRESIDENT: Object.freeze({ machineRole: 'assistantController', mode: 'WORKFLOW_DISPATCH', workflow: 'council-priority-wake.yml' }),
  DEPUTY: Object.freeze({ machineRole: 'verification', mode: 'EXTERNAL_AGENT_WAKE_REQUIRED', workflow: null }),
  INVESTIGATOR: Object.freeze({ machineRole: 'analysis', mode: 'WORKFLOW_DISPATCH', workflow: 'ultra-investigator.yml', input: 'expected_sha' }),
  SCOUT: Object.freeze({ machineRole: 'codeScout', mode: 'WORKFLOW_DISPATCH', workflow: 'code-read-only-scout.yml' }),
  TASK: Object.freeze({ machineRole: 'taskAgent', mode: 'EXTERNAL_AGENT_WAKE_REQUIRED', workflow: null }),
  PERFORMANCE: Object.freeze({ machineRole: 'performanceAgent', mode: 'WORKFLOW_DISPATCH', workflow: 'root-cause-diagnostics.yml' }),
  EXECUTION: Object.freeze({ machineRole: 'executionAgent', mode: 'EXTERNAL_AGENT_WAKE_REQUIRED', workflow: null }),
  TEST: Object.freeze({ machineRole: 'testAgent', mode: 'WORKFLOW_DISPATCH', workflow: 'test-matrix-contract.yml' }),
  SECURITY: Object.freeze({ machineRole: 'securityAgent', mode: 'WORKFLOW_DISPATCH', workflow: 'repository-security-baseline.yml' }),
  REVIEW: Object.freeze({ machineRole: 'reviewAgent', mode: 'EXTERNAL_AGENT_WAKE_REQUIRED', workflow: null }),
  CERTIFICATION: Object.freeze({ machineRole: 'certificationAuthority', mode: 'EXTERNAL_AGENT_WAKE_REQUIRED', workflow: null }),
});
const SHA_RE = /^[a-f0-9]{40}$/u;
const WP_RE = /^[A-Z][A-Z0-9_-]{3,80}$/u;
const extract = (body, pattern, name) => {
  const match = String(body ?? '').match(pattern);
  if (!match) throw new Error('COUNCIL_WAKE_' + name + '_MISSING');
  return match[1].trim();
};
export function buildWakePlan({ comment, currentExecutionSha, repository = '' } = {}) {
  const body = String(comment ?? '');
  if (!body.includes(PRESIDENT_WAKE_MARKER)) throw new Error('COUNCIL_WAKE_MARKER_MISSING');
  const entrySha = extract(body, /ENTRY SHA:\s*([a-f0-9]{40})/iu, 'ENTRY_SHA');
  const role = extract(body, /ROLE:\s*([A-Z]+)/u, 'ROLE').toUpperCase();
  const workPackageId = extract(body, /WORK PACKAGE:\s*([A-Z][A-Z0-9_-]{3,80})/u, 'WORK_PACKAGE');
  if (!SHA_RE.test(entrySha)) throw new Error('COUNCIL_WAKE_ENTRY_SHA_INVALID');
  if (!SHA_RE.test(String(currentExecutionSha ?? ''))) throw new Error('COUNCIL_WAKE_CURRENT_SHA_INVALID');
  if (entrySha !== currentExecutionSha) throw new Error('COUNCIL_WAKE_STALE_SHA');
  if (!WP_RE.test(workPackageId)) throw new Error('COUNCIL_WAKE_WORK_PACKAGE_INVALID');
  const route = ROLE_ROUTES[role];
  if (!route) throw new Error('COUNCIL_WAKE_ROLE_UNSUPPORTED=' + role);
  return Object.freeze({
    schemaVersion: 1,
    authority: 'FLIXO_COUNCIL_WAKE_DISPATCH',
    repository,
    entrySha,
    role,
    machineRole: route.machineRole,
    workPackageId,
    mode: route.mode,
    workflow: route.workflow,
    priority: COUNCIL_PRIORITY,
    preemption: 'SAFE_BOUNDARY',
    workflowInput: route.input === 'expected_sha' ? { expected_sha: entrySha } : {},
    exactSha: true,
    requiresPresidentControl: true,
    councilOperation: true,
    externalAgentRequired: route.mode === 'EXTERNAL_AGENT_WAKE_REQUIRED',
  });
}
const arg = (name) => {
  const prefix = '--' + name + '=';
  const token = process.argv.find((item) => item.startsWith(prefix));
  return token ? token.slice(prefix.length) : '';
};
if (process.argv[1]?.endsWith('/council-wake-dispatch.mjs')) {
  try {
    const commentFile = arg('comment-file');
    const currentExecutionSha = arg('current-execution-sha');
    if (!commentFile || !currentExecutionSha) throw new Error('COUNCIL_WAKE_INPUT_REQUIRED');
    const plan = buildWakePlan({ comment: fs.readFileSync(commentFile, 'utf8'), currentExecutionSha, repository: arg('repository') });
    console.log(JSON.stringify(plan, null, 2));
  } catch (error) {
    console.error('COUNCIL_WAKE_GATE_BLOCK=' + String(error?.message ?? error));
    process.exit(1);
  }
}
