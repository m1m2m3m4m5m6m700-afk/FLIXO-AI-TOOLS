import assert from 'node:assert/strict';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { getCapability } from '../src/lib/agent/capability-registry.ts';
import { cancelPreparedExecution, confirmPreparedExecution, executePreparedExecution, prepareExecution } from '../src/lib/agent/execution-integrator.ts';
import { assertApprovalNotReplayed } from '../src/lib/agent/flixo-bot-task-bridge.ts';
const validPlan={workflowName:'Direct Tool',confidence:0.95,catalogFingerprint:TOOL_CATALOG.fingerprint,steps:[{toolId:'image-compressor',params:{quality:0.8}}]};
const prepared=prepareExecution(validPlan,{taskId:'integrator-task',traceId:'integrator-trace'});
assert.equal(prepared.task.state,'AWAITING_CONFIRMATION');
assert.equal(prepared.task.confirmationRequired,true);
assert.equal(getCapability('image-compressor')?.state,'EXECUTABLE');
assert.throws(()=>prepareExecution({...validPlan,catalogFingerprint:'a'.repeat(64)}),/different canonical tool catalog|stale/i);
assert.throws(()=>prepareExecution({...validPlan,steps:[{toolId:'photo-colorizer',params:{}}]}),/not executable/i);
assert.throws(()=>prepareExecution({...validPlan,steps:[{toolId:'image-compressor',params:{quality:9}}]}),/schema validation|unsupported parameters/i);
assert.equal(cancelPreparedExecution(prepared).task.state,'CANCELLED');
const confirmed=await confirmPreparedExecution(prepared);
assert.equal(confirmed.task.state,'EXECUTING');
await assert.rejects(executePreparedExecution(prepared,new File([new Uint8Array([1])],'sample.png',{type:'image/png'}),()=>undefined),/explicit confirmation/i);
await assert.rejects(executePreparedExecution(confirmed,new File([],'empty.png',{type:'image/png'}),()=>undefined),/input file is empty/i);
assert.doesNotThrow(() => assertApprovalNotReplayed([], 'run-replay-fixture', 'approval-replay-fixture'));
assert.throws(() => assertApprovalNotReplayed([
  { kind: 'SYSTEM', payload: { type: 'FLIXO_BOT_APPROVAL_ACCEPTED', runId: 'run-replay-fixture', approvalId: 'approval-replay-fixture' } },
], 'run-replay-fixture', 'approval-replay-fixture'), /FLIXO_BOT_APPROVAL_REPLAY/);
assert.doesNotThrow(() => assertApprovalNotReplayed([
  { kind: 'SYSTEM', payload: { type: 'FLIXO_BOT_APPROVAL_ACCEPTED', runId: 'run-replay-fixture', approvalId: 'different-approval' } },
], 'run-replay-fixture', 'approval-replay-fixture'));
console.log('Execution integrator contract tests passed.');
