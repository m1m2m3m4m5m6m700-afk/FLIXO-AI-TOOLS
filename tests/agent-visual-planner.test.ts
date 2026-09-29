import { describe, expect, it } from 'vitest';
import { validateVisualEditPlan } from '../src/lib/agent/visual-planner';

describe('visual planner contract', () => {
  const goal = { target: ['sky'], acceptanceCriteria: ['sky is more blue'], preserve: ['buildings'] };
  it('accepts canonical executable capabilities', () => {
    expect(() => validateVisualEditPlan({ id: 'p1', goal, steps: [{ id: 's1', capabilityId: 'image-effects', parameters: { saturation: 0.1 } }] })).not.toThrow();
  });
  it('rejects duplicate step ids', () => {
    expect(() => validateVisualEditPlan({ id: 'p1', goal, steps: [{ id: 's1', capabilityId: 'image-effects', parameters: {} }, { id: 's1', capabilityId: 'image-effects', parameters: {} }] })).toThrow('VISUAL_PLAN_STEP_ID_INVALID');
  });
  it('fails closed for unknown capabilities', () => {
    expect(() => validateVisualEditPlan({ id: 'p1', goal, steps: [{ id: 's1', capabilityId: 'unknown-capability', parameters: {} }] })).toThrow('VISUAL_PLAN_CAPABILITY_UNKNOWN');
  });
});
