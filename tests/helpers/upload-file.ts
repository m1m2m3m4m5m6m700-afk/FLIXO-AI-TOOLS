import { expect, type Page } from '@playwright/test';

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

  // G3 Upload Adapter boundary: keep Playwright file injection in one helper.
  // Use in-memory payloads so browser tests do not depend on a transient filesystem
  // path or a second I/O boundary between the fixture and the <input type=file>.
  await input.setInputFiles(
    fixtures.map((item) => ({
      name: item.name,
      mimeType: item.mimeType,
      buffer: Buffer.isBuffer(item.content) ? item.content : Buffer.from(item.content),
    })),
  );

  await expect.poll(async () => input.evaluate((element) => element.files?.length ?? 0)).toBe(fixtures.length);
  await expect.poll(async () => input.evaluate((element) => element.files ? Array.from(element.files).map((file) => file.name) : [])).toEqual(fixtures.map((item) => item.name));
}
