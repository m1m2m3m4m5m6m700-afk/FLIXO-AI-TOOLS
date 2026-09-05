import { expect, test } from '@playwright/test';

test('QuickFlow product-ready page renders deterministic plan', async ({ page }) => {
  await page.goto('/en/quickflow/product-ready');
  await expect(page.getByRole('heading', { name: 'Product Ready' })).toBeVisible();
  await expect(page.getByText('background-remover')).toBeVisible();
  await expect(page.getByText('image-compressor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run workflow' })).toBeDisabled();
});
