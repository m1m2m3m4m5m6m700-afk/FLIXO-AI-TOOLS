import { expect, test } from '@playwright/test';

test('case-converter: loads all requested modes', async ({ page }) => {
  await page.goto('/en/case-converter');
  await expect(page.getByRole('heading', { level: 1, name: 'Case Converter' })).toBeVisible();
  for (const label of ['UPPERCASE', 'lowercase', 'Title Case', 'Sentence case', 'camelCase', 'PascalCase', 'snake_case', 'kebab-case', 'CONSTANT_CASE']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
});

test('case-converter: converts common identifier cases', async ({ page }) => {
  await page.goto('/en/case-converter');
  const input = page.getByLabel('Text input');
  const output = page.getByLabel('Converted output');
  await input.fill('hello world example');

  await page.getByRole('button', { name: 'camelCase' }).click();
  await expect(output).toHaveValue('helloWorldExample');
  await page.getByRole('button', { name: 'PascalCase' }).click();
  await expect(output).toHaveValue('HelloWorldExample');
  await page.getByRole('button', { name: 'snake_case' }).click();
  await expect(output).toHaveValue('hello_world_example');
  await page.getByRole('button', { name: 'kebab-case' }).click();
  await expect(output).toHaveValue('hello-world-example');
  await page.getByRole('button', { name: 'CONSTANT_CASE' }).click();
  await expect(output).toHaveValue('HELLO_WORLD_EXAMPLE');
});

test('case-converter: preserves Unicode letters for Arabic', async ({ page }) => {
  await page.goto('/en/case-converter');
  await page.getByLabel('Text input').fill('مرحبا بالعالم');
  await page.getByRole('button', { name: 'UPPERCASE' }).click();
  await expect(page.getByLabel('Converted output')).toHaveValue('مرحبا بالعالم');
});

test('case-converter: clear resets input and output', async ({ page }) => {
  await page.goto('/en/case-converter');
  await page.getByLabel('Text input').fill('Hello world');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByLabel('Text input')).toHaveValue('');
  await expect(page.getByLabel('Converted output')).toHaveValue('');
});
