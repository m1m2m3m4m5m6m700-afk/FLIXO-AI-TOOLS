import { expect, test } from '@playwright/test';
import { planWithOptionalAI } from '@/lib/ai/optional-planner';

test.describe('optional AI planner', () => {
  test('uses deterministic planning when AI is not configured', async () => {
    const result = await planWithOptionalAI('compress my image');
    expect(result.source).toBe('deterministic');
    expect(result.plan).not.toBeNull();
  });

  test('falls back when the provider returns an invalid plan', async () => {
    const result = await planWithOptionalAI('compress my image', async () => ({ invalid: true }));
    expect(result.source).toBe('deterministic');
    expect(result.plan).not.toBeNull();
  });

  test('accepts a valid provider plan', async () => {
    const result = await planWithOptionalAI('compress my image', async () => ({
      workflowName: 'AI Compression',
      confidence: 0.91,
      steps: [{ toolId: 'image-compressor' }],
    }));
    expect(result.source).toBe('ai');
    expect(result.plan?.steps[0]?.toolId).toBe('image-compressor');
  });
});
