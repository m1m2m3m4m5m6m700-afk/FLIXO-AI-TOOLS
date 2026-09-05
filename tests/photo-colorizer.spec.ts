import { expect, test } from '@playwright/test';

test('photo-colorizer is not publicly available while the tool is not ready', async ({ page }) => {
  await page.goto('/en/photo-colorizer');
  await expect(page.getByRole('heading', { level: 1, name: 'Tool not found' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
});
