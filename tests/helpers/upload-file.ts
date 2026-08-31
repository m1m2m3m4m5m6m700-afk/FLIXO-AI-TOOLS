import { expect, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type UploadFixture = {
  name: string;
  mimeType: string;
  content: string | Buffer;
};

export type UploadTarget = {
  selector?: string;
  label?: string;
};

export async function uploadFixture(
  page: Page,
  fixture: UploadFixture | UploadFixture[],
  target: UploadTarget = { selector: '#image-file' },
): Promise<void> {
  const fixtures = Array.isArray(fixture) ? fixture : [fixture];
  const input = target.selector
    ? page.locator(target.selector)
    : page.getByLabel(target.label!, { exact: true });

  await expect(input).toHaveCount(1);
  await expect(input).toBeAttached();
  await expect(input).toBeEnabled();

  const fixtureDir = path.join(process.cwd(), 'test-results', 'g3-upload-fixtures');
  await fs.mkdir(fixtureDir, { recursive: true });
  const filePaths = await Promise.all(fixtures.map(async (item) => {
    const filePath = path.join(fixtureDir, item.name);
    await fs.writeFile(filePath, item.content);
    return filePath;
  }));

  // G3 Upload Adapter boundary: implementation details stay here.
  await input.setInputFiles(filePaths);
  await expect.poll(async () => input.evaluate((element) => element.files?.length ?? 0)).toBe(fixtures.length);
  await expect.poll(async () => input.evaluate((element) => element.files ? Array.from(element.files).map(file => file.name) : [])).toEqual(fixtures.map(item => item.name));
}
