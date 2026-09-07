import { expect, test } from '@playwright/test';

const HYDRATION_WARNING = /hydration|server-rendered html|did not match|content does not match/iu;

test.describe('document locale engine contract', () => {
  test('keeps SSR locale stable through hydration and route transitions', async ({ page }) => {
    const hydrationWarnings: string[] = [];
    page.on('console', (message) => {
      if (HYDRATION_WARNING.test(message.text())) hydrationWarnings.push(message.text());
    });
    page.on('pageerror', (error) => {
      if (HYDRATION_WARNING.test(error.message)) hydrationWarnings.push(error.message);
    });

    await page.goto('/ar/aspect-ratio-calculator', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('body')).toHaveAttribute('data-flixo-locale', 'ar');

    await page.goto('/en/aspect-ratio-calculator', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('body')).toHaveAttribute('data-flixo-locale', 'en');

    await page.goto('/ar/image-compressor', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('body')).toHaveAttribute('data-flixo-locale', 'ar');
    expect(hydrationWarnings).toEqual([]);
  });
});
