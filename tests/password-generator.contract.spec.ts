import { expect, test, type Page } from '@playwright/test';

const generatedPassword = (page: Page) =>
  page.getByRole('status', { name: 'Generated password', exact: true });

test('password-generator: loads and generates', async ({ page }) => {
  await page.goto('/en/password-generator');
  await expect(page.getByRole('heading', { name: 'Password Generator' })).toBeVisible();
  const output = generatedPassword(page);
  const first = await output.textContent();
  await page.getByRole('button', { name: 'Generate' }).click();
  const second = await output.textContent();
  expect(first).toHaveLength(20);
  expect(second).toHaveLength(20);
  expect(second).not.toBe(first);
});

test('password-generator: length and selected character sets are enforced', async ({ page }) => {
  await page.goto('/en/password-generator');
  await page.getByLabel('Length').fill('32');
  for (const label of ['uppercase', 'lowercase', 'numbers']) await page.getByLabel(label, { exact: true }).uncheck();
  await page.getByLabel('symbols', { exact: true }).check();
  await page.getByRole('button', { name: 'Generate' }).click();
  const value = await generatedPassword(page).textContent();
  const symbols = '!@#$%^&*()-_=+[]{};:,.?/|~';
  expect(value).toHaveLength(32);
  expect([...String(value)].every((character) => symbols.includes(character))).toBe(true);
});

test('password-generator: ambiguous characters can be excluded', async ({ page }) => {
  await page.goto('/en/password-generator');
  await page.getByLabel('excludeAmbiguous', { exact: true }).check();
  await page.getByRole('button', { name: 'Generate' }).click();
  const value = await generatedPassword(page).textContent();
  expect(value).not.toMatch(/[O0Il1|]/);
});
