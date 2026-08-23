import assert from 'node:assert/strict';
import { buildQuickFlowPlan } from '../src/lib/quickflow.ts';
import { buildOptionalAiPlan } from '../src/lib/ai-planner.ts';
import { TOOLS_REGISTRY } from '../src/config/tools.ts';

const deterministicPlan = buildQuickFlowPlan('compress image', TOOLS_REGISTRY);
assert.ok(deterministicPlan);

const disabled = await buildOptionalAiPlan({
  intent: 'compress image',
  deterministicPlan,
  enabled: false,
  planner: async () => null,
});
assert.deepEqual(disabled, deterministicPlan);

const missingPlanner = await buildOptionalAiPlan({
  intent: 'compress image',
  deterministicPlan,
  enabled: true,
});
assert.deepEqual(missingPlanner, deterministicPlan);

let called = false;
const refined = await buildOptionalAiPlan({
  intent: 'compress image',
  deterministicPlan,
  enabled: true,
  planner: async ({ deterministicPlan: plan }) => {
    called = true;
    return { ...plan, intent: `${plan.intent} refined` };
  },
});
assert.equal(called, true);
assert.equal(refined?.intent, 'compress image refined');

const failed = await buildOptionalAiPlan({
  intent: 'compress image',
  deterministicPlan,
  enabled: true,
  planner: async () => {
    throw new Error('provider unavailable');
  },
});
assert.deepEqual(failed, deterministicPlan);

const noPlan = await buildOptionalAiPlan({
  intent: 'unknown',
  deterministicPlan: null,
  enabled: true,
  planner: async () => deterministicPlan,
});
assert.equal(noPlan, null);

console.log('Optional AI planner contract tests passed.');
