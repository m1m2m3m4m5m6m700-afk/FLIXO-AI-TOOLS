import { test, expect } from '@playwright/test';

test('regex tester exposes live match results', async ({ page }) => {
  await page.goto('/en/regex-tester');
  await expect(page.getByRole('heading', { name: 'Regex Tester & Debugger' })).toBeVisible();
  await page.getByLabel('Regex pattern').fill('\\d+');
  await page.getByLabel('Regex input').fill('abc 123 xyz 45');
  await expect(page.getByText('2 matches')).toBeVisible();
  await expect(page.getByText('index 4')).toBeVisible();
});

test('regex tester reports invalid expressions', async ({ page }) => {
  await page.goto('/en/regex-tester');
  await page.getByLabel('Regex pattern').fill('[');
  await expect(page.getByRole('alert')).toBeVisible();
});
