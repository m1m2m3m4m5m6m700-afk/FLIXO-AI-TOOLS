import { test, expect } from '@playwright/test';

test.describe('AI vocal instrumental remover contract', () => {
  test('route exposes local separation controls', async ({ page }) => {
    await page.goto('/en/ai-vocal-instrumental-remover');
    await expect(page.getByRole('heading', { name: 'AI Vocal & Instrumental Remover' })).toBeVisible();
    await expect(page.getByRole('button', { name: /separate vocals/i })).toBeDisabled();
    await expect(page.getByRole('combobox')).toHaveValue('webgpu');
  });
});
