test('password-generator: length and selected character sets are enforced', async ({ page }) => {
  await page.goto('/en/password-generator');
  await page.getByLabel('Length').fill('32');
  for (const label of ['uppercase', 'lowercase', 'numbers']) await page.getByLabel(label, { exact: true }).uncheck();
  await page.getByLabel('symbols', { exact: true }).check();
  await page.getByRole('button', { name: 'Generate' }).click();
  const value = await page.getByLabel('Generated password').textContent();
  expect(value).toHaveLength(32);
  expect(value).toMatch(/^[!@#$%^&*()-_=+\[\]{};:,.?/|~]+$/);
});

test('password-generator: ambiguous characters can be excluded', async ({ page }) => {
  await page.goto('/en/password-generator');
  await page.getByLabel('excludeAmbiguous', { exact: true }).check();
  await page.getByRole('button', { name: 'Generate' }).click();
  const value = await page.getByLabel('Generated password').textContent();