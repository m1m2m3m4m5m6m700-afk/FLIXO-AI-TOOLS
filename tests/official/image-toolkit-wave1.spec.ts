import { expect, test } from "@playwright/test";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const tools = [
  ["image-resizer", "2"],
  ["image-hue", null],
  ["image-pixelate", null],
  ["image-padding", null],
  ["image-rounded-corners", null],
] as const;

for (const [toolId, scale] of tools) {
  test(`${toolId} produces a local image result`, async ({ page }) => {
    await page.goto(`/en/${toolId}`);
    await expect(page.locator(".image-tool-header h2")).toBeVisible();
    const input = page.locator("#image-tool-file");
    await input.setInputFiles({
      name: "fixture.png",
      mimeType: "image/png",
      buffer: Buffer.from(PNG_1X1, "base64"),
    });

    if (scale) {
      const scaleInput = page.getByLabel("Scale");
      await scaleInput.fill(scale);
    }

    await page.getByRole("button", { name: /run|execute/i }).click();
    await expect(page.locator("a[download]")).toHaveCount(2);
    await expect(page.locator("img[alt]").last()).toBeVisible();
  });
}
