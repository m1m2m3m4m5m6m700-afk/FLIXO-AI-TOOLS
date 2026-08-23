import { expect, test } from '@playwright/test';

test('Arabic QuickFlow product-ready page renders RTL deterministic plan', async ({ page }) => {
  await page.goto('/ar/quickflow/product-ready');
  await expect(page.locator('main[dir="rtl"][lang="ar"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'جاهزة للمتجر' })).toBeVisible();
  await expect(page.getByText('إزالة الخلفية')).toBeVisible();
  await expect(page.getByText('ضغط الصورة')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تشغيل المسار' })).toBeDisabled();
});
