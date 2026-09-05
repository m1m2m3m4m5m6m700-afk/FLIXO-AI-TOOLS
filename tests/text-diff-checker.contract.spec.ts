import { expect, test } from '@playwright/test';

test('text-diff-checker: exposes the main workflow', async ({ page }) => {
  await page.goto('/en/text-diff-checker');
  await expect(page.getByRole('heading', { level: 1, name: 'Text Diff Checker' })).toBeVisible();
  await expect(page.getByLabel('Original text')).toBeVisible();
  await expect(page.getByLabel('Modified text')).toBeVisible();
});

test('text-diff-checker: reports additions and removals', async ({ page }) => {
  await page.goto('/en/text-diff-checker');
  await page.getByLabel('Original text').fill('hello world');
  await page.getByLabel('Modified text').fill('hello brave world');
  await expect(page.getByTestId('diff-summary')).toHaveText(/Added [1-9]/);
  await expect(page.getByTestId('diff-summary')).toHaveText(/Removed 0/);
});

test('text-diff-checker: reports removals', async ({ page }) => {
  await page.goto('/en/text-diff-checker');
  await page.getByLabel('Original text').fill('alpha beta gamma');
  await page.getByLabel('Modified text').fill('alpha gamma');
  await expect(page.getByTestId('diff-summary')).toHaveText(/Removed [1-9]/);
});

test('text-diff-checker: supports whitespace toggle and side-by-side mode', async ({ page }) => {
  await page.goto('/en/text-diff-checker');
  await page.getByLabel('Original text').fill('hello   world');
  await page.getByLabel('Modified text').fill('hello world');
  await page.getByLabel('Ignore whitespace').check();
  await page.getByRole('button', { name: 'Side-by-side' }).click();
  await expect(page.getByLabel('Original diff')).toBeVisible();
  await expect(page.getByLabel('Modified diff')).toBeVisible();
});

test('text-diff-checker: identical texts produce no changes', async ({ page }) => {
  await page.goto('/en/text-diff-checker');
  await page.getByLabel('Original text').fill('same text');
  await page.getByLabel('Modified text').fill('same text');
  await expect(page.getByTestId('diff-summary')).toHaveText('Added 0 · Removed 0 · Unchanged 9');
});
