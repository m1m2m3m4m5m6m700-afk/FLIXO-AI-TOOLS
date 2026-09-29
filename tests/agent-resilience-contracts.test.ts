import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resetProviderCircuits, recordProviderFailure, recordProviderSuccess, isProviderCircuitOpen } from '../src/lib/agent/model-resilience.ts';
import { validateToolPlan } from '../src/lib/agent/tool-plan-validator.ts';
import { createTraceId, sanitizeTraceMetadata } from '../src/lib/agent/execution-observability.ts';
import { createExecutionIdentity, sameExecution } from '../src/lib/agent/idempotency.ts';
import { planFromIntent } from '../src/lib/ai/planner.ts';

test('bounded provider circuit opens and resets', () => {
  resetProviderCircuits();
  recordProviderFailure('openai', 1);
  assert.equal(isProviderCircuitOpen('openai', 2), false);
  recordProviderFailure('openai', 3);
  assert.equal(isProviderCircuitOpen('openai', 4), true);
  recordProviderSuccess('openai');
  assert.equal(isProviderCircuitOpen('openai', 5), false);
});

test('tool plan validation separates semantic and value failures', () => {
  const plan = planFromIntent('compress image');
  assert.ok(plan);
  assert.equal(validateToolPlan('compress image', plan).valid, true);
  assert.equal(validateToolPlan('convert image to png', plan).semantic, false);
  assert.equal(validateToolPlan('compress image', { ...plan, steps: [{ ...plan.steps[0], params: { quality: 999 } }] }).values, false);
});

test('trace metadata is allowlisted', () => {
  const traceId = createTraceId('request');
  const metadata = sanitizeTraceMetadata({ provider: 'openai', status: 'failure', payload: 'excluded' });
  assert.deepEqual(metadata, { provider: 'openai', status: 'failure' });
  assert.match(traceId, /^flixo-[0-9a-f]+$/);
});

test('idempotency is stable', () => {
  const a = createExecutionIdentity('same-key', 'name=image.png;size=10');
  const b = createExecutionIdentity('same-key', 'name=image.png;size=10');
  const c = createExecutionIdentity('different-key', 'name=image.png;size=10');
  assert.equal(sameExecution(a, b), true);
  assert.equal(sameExecution(a, c), false);
});
