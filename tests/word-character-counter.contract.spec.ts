import { expect, test } from '@playwright/test';

test('word-character-counter: exposes the main workflow', async ({ page }) => {
  await page.goto('/en/word-character-counter');
  await expect(page.getByRole('heading', { level: 1, name: 'Word & Character Counter' })).toBeVisible();
  await expect(page.getByLabel('Text input')).toBeVisible();
});

test('word-character-counter: calculates English statistics and keyword density', async ({ page }) => {
  await page.goto('/en/word-character-counter');
  await page.getByLabel('Text input').fill('Hello world. Hello again!');
  await expect(page.getByTestId('stat-words')).toHaveText('4');
  await expect(page.getByTestId('stat-characters')).toHaveText('25');
  await expect(page.getByTestId('stat-characters-without-spaces')).toHaveText('21');
  await expect(page.getByTestId('stat-sentences')).toHaveText('2');
  await expect(page.getByTestId('stat-paragraphs')).toHaveText('1');
  await expect(page.getByRole('cell', { name: 'hello' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '50%' })).toBeVisible();
});

test('word-character-counter: handles Arabic text and paragraphs', async ({ page }) => {
  await page.goto('/en/word-character-counter');
  await page.getByLabel('Text input').fill('مرحبا بالعالم. مرحبا من جديد.\n\nهذا فقرة ثانية.');
  await expect(page.getByTestId('stat-words')).toHaveText('8');
  await expect(page.getByTestId('stat-sentences')).toHaveText('3');
  await expect(page.getByTestId('stat-paragraphs')).toHaveText('2');
});

test('word-character-counter: clear resets every metric', async ({ page }) => {
  await page.goto('/en/word-character-counter');
  await page.getByLabel('Text input').fill('One two three.');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByTestId('stat-words')).toHaveText('0');
  await expect(page.getByTestId('stat-characters')).toHaveText('0');
  await expect(page.getByTestId('stat-sentences')).toHaveText('0');
});
