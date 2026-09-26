import { assertApprovalNotReplayed } from '../../src/lib/agent/flixo-bot-task-bridge.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const runtime = read('src/lib/agent/flixo-bot-openai-runtime.ts');
const bridge = read('src/lib/agent/flixo-bot-task-bridge.ts');
const integrator = read('src/lib/agent/execution-integrator.ts');
const pipeline = read('src/lib/workflows/pipeline-runner.ts');
const conversation = read('src/lib/agent/conversation.ts');
const ui = read('src/components/FlixoAIAgent.tsx');
const vite = read('vite.config.ts');

assert.match(runtime, /export function approveRun\(/u);
assert.match(runtime, /approvalId: string/u);
assert.match(runtime, /export function failRun\(/u);
assert.match(runtime, /outputSha256\?\:/u);
assert.match(bridge, /runtimeStatusToTaskState/u);
assert.match(bridge, /restoreFlixoBotRunState/u);
assert.match(bridge, /cancelRuntimeExecution/u);
assert.match(bridge, /completeRuntimeExecution/u);
assert.match(integrator, /runtimeState\?\: FlixoBotRunState/u);
assert.match(integrator, /runtimeRequest\?\: string/u);
assert.match(integrator, /beginFlixoBotGatewayRuntime/u);
assert.match(integrator, /onRuntimeState\?\:/u);
assert.match(integrator, /confirmRuntimeExecution/u);
assert.match(integrator, /runWorkflowPipeline\([\s\S]*runtimeHooks/u);
assert.match(integrator, /try \{[\s\S]*authorizeExecution\([\s\S]*catch \(cause\)/u);
assert.match(integrator, /receiptChain\?\:/u);
assert.match(pipeline, /export type PipelineRuntimeHooks/u);
assert.match(pipeline, /runtimeHooks\?\.beforeTool/u);
assert.match(pipeline, /runtimeHooks\?\.afterTool/u);
assert.match(pipeline, /if \(runtimeAfterToolInvoked\) throw error/u);
assert.match(conversation, /activePlan: ExecutionPlanContract \| null/u);
assert.match(conversation, /runtimeResumeState: string \| null/u);
assert.match(ui, /restorePreparedExecution/u);
assert.match(ui, /decision\.runtime\?\.resumeState/u);
assert.match(ui, /runtimeResumeState: prepared\.runtimeState/u);
assert.match(ui, /setConversationTask\([\s\S]*planReady: false[\s\S]*plan: null[\s\S]*runtimeResumeState: null/u);
assert.match(ui, /runtimeRequest: contextualCommand/u);
assert.match(ui, /onRuntimeState/u);
assert.match(vite, /__FLIXO_BUILD_SHA__/u);
assert.match(vite, /VERCEL_GIT_COMMIT_SHA/u);

const approval = 'approval-replay-fixture';
const runId = 'run-replay-fixture';
assert.doesNotThrow(() => assertApprovalNotReplayed([], runId, approval));
assert.throws(
  () => assertApprovalNotReplayed([
    { kind: 'SYSTEM', payload: { type: 'FLIXO_BOT_APPROVAL_ACCEPTED', runId, approvalId: approval } },
  ], runId, approval),
  /FLIXO_BOT_APPROVAL_REPLAY/,
);
assert.doesNotThrow(() => assertApprovalNotReplayed([
  { kind: 'SYSTEM', payload: { type: 'FLIXO_BOT_APPROVAL_ACCEPTED', runId, approvalId: 'different' } },
], runId, approval));
console.log('FLIXO BOT execution bridge contract passed.');
