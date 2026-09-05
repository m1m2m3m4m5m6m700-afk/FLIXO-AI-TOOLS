import { test, expect } from '@playwright/test';

test('hash generator renders and produces SHA-256', async ({ page }) => {
  await page.goto('/en/hash-generator');
  await expect(page.getByRole('heading', { name: 'Hash Generator' })).toBeVisible();
  await page.getByLabel('Text to hash').fill('hello');
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByLabel('Hash result')).toHaveText('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  await page.locator('select').selectOption('SHA-512');
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByLabel('Hash result')).toHaveText('9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043');
});
