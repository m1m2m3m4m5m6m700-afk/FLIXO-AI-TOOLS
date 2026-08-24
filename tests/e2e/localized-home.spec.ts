import { test, expect } from '@playwright/test';

test.describe('localized home coverage', () => {
  const cases = [
    ['en', 'ltr'], ['ar', 'rtl'], ['es', 'ltr'], ['fr', 'ltr'], ['de', 'ltr'],
    ['ru', 'ltr'], ['zh', 'ltr'], ['hi', 'ltr'], ['id', 'ltr'], ['ur', 'rtl'],
    ['ja', 'ltr'], ['pt', 'ltr'], ['it', 'ltr'], ['ko', 'ltr'], ['nl', 'ltr'],
    ['pl', 'ltr'], ['tr', 'ltr'], ['vi', 'ltr'], ['th', 'ltr'], ['sv', 'ltr'],
  ] as const;

  for (const [locale, dir] of cases) {
    test(`${locale} home is localized and rendered`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator('main.home-shell')).toHaveAttribute('lang', locale === 'zh' ? 'zh-CN' : locale);
      await expect(page.locator('main.home-shell')).toHaveAttribute('dir', dir);
      await expect(page.locator('#home-title')).toBeVisible();
    });
  }
});
