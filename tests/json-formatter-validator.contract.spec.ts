import { expect, test } from '@playwright/test';

test('json formatter: validates, prettifies, and minifies valid JSON', async ({ page }) => {
  await page.goto('/en/json-formatter-validator');
  await expect(page.getByRole('heading', { name: 'JSON Formatter & Validator' })).toBeVisible();
  await page.getByLabel('JSON input').fill('{"name":"FLIXO","tools":[1,2,3]}');
  await expect(page.getByText('Valid JSON')).toBeVisible();
  await page.getByRole('button', { name: 'Prettify' }).click();
  await expect(page.getByLabel('JSON output')).toHaveValue(/\n/);
  await page.getByRole('button', { name: 'Minify' }).click();
  await expect(page.getByLabel('JSON output')).toHaveValue('{"name":"FLIXO","tools":[1,2,3]}');
});

test('json formatter: invalid JSON reports location', async ({ page }) => {
  await page.goto('/en/json-formatter-validator');
  await page.getByLabel('JSON input').fill('{"name":"FLIXO",}');
  await expect(page.getByText(/Invalid JSON — line 1, column/)).toBeVisible();
});

test('json formatter: tree, YAML, and CSV outputs are available', async ({ page }) => {
  await page.goto('/en/json-formatter-validator');
  await page.getByLabel('JSON input').fill('{"name":"FLIXO","count":2}');
  await page.getByRole('button', { name: 'Tree View' }).click();
  await expect(page.getByLabel('JSON tree')).toContainText('name');
  await page.getByRole('button', { name: 'YAML' }).click();
  await expect(page.getByLabel('JSON output')).toContainText('name: FLIXO');
  await page.getByRole('button', { name: 'CSV' }).click();
  await expect(page.getByLabel('JSON output')).toContainText('name');
});
