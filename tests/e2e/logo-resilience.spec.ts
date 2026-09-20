import { test, expect } from '@playwright/test';

test.describe('FLIXO logo resilience', () => {
  test('global logo uses the canonical resilient image contract', async ({ page }) => {
    await page.goto('/');
    const logo = page.getByRole('img', { name: 'FLIXO AI Tools' }).first();
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', /flixo-logo\.webp\?v=20260920$/);
    await expect(logo).toHaveJSProperty('naturalWidth', expect.any(Number));
    await expect.poll(async () => logo.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });
});
