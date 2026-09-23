import { test, expect } from '../fixtures/universal-runtime-evidence';

test.describe('FLIXO logo resilience', () => {
  test('global logo renders the canonical cache-busted asset', async ({ page }) => {
    await page.goto('/');
    const logo = page.getByRole('img', { name: 'FLIXO AI Tools' }).first();

    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', /flixo-logo\.webp\?v=20260922$/);
    await expect.poll(async () => logo.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });

  test('global logo falls back to PNG when the WebP asset fails', async ({ page }) => {
    await page.route('**/flixo-logo.webp?v=20260922', (route) => route.abort());

    await page.goto('/');
    const logo = page.getByRole('img', { name: 'FLIXO AI Tools' }).first();

    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', /flixo-favicon\.png\?v=20260922$/);
    await expect.poll(async () => logo.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });
});
