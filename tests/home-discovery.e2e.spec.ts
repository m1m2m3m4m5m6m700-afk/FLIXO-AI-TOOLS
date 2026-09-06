import { expect, test } from "@playwright/test";

const ONE_BY_ONE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test.describe("home discovery flows", () => {
  test("search filters the ready tool grid and keeps the grid consistent", async ({ page }) => {
    await page.goto("/en");

    const grid = page.locator(".home-tools-grid");
    const cards = grid.locator(".home-tool-card");
    await expect(cards).not.toHaveCount(0);

    const before = await cards.count();

    await page.locator("#tool-search").fill("image-compress");
    await expect(cards).toHaveCount(1);
    await expect(cards).toHaveText(/Image Compressor/);
    await expect(page.getByText(/Image Compressor/).first()).toBeVisible();

    await page.locator("#tool-search").fill("definitely-no-such-tool-xyz");
    await expect(grid.locator(".home-tool-card")).toHaveCount(0);
    await expect(page.locator(".home-empty")).toBeVisible();

    await page.locator("#tool-search").fill("");
    await expect(cards).toHaveCount(before);
  });

  test("category pills filter the tool grid by family", async ({ page }) => {
    await page.goto("/en");

    const categories = page.locator(".category-pills button");
    await expect(categories).toHaveCount(4);

    for (const label of ["Images", "AI", "Other"] as const) {
      await page.locator(".category-pills button", { hasText: label }).first().click();
      await expect
        .poll(
          async () => {
            const texts = await page
              .locator(".home-tool-card .tool-card-category")
              .allTextContents();
            return texts.length > 1 && texts.every((text) => text === label) ? texts.length : -1;
          },
          { timeout: 10_000 },
        )
        .toBeGreaterThan(1);
    }

    await categories.first().click();
    await expect(page.locator(".home-tool-card").first()).toBeVisible();
  });

  test("quick tags populate the search query", async ({ page }) => {
    await page.goto("/en");

    const tags = page.locator(".quick-tags button");
    await expect(tags).toHaveCount(5);

    const firstTagText = await tags.first().textContent();
    await tags.first().click();
    await expect(page.locator("#tool-search")).toHaveValue(firstTagText ?? "");
    await expect(page.locator(".home-tool-card").first()).toBeVisible();
  });

  test("smart palette routes an intent phrase to the best tool", async ({ page }) => {
    await page.goto("/en");

    await page.locator("button.search-command-button").click();
    await expect(page.locator(".smart-palette")).toBeVisible();

    await page.locator("#smart-command-input").fill("compress my image");
    const result = page.locator(".smart-result").first();
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute("href", /image-compressor$/);

    await Promise.all([page.waitForURL(/\/en\/image-compressor$/), result.click()]);
    await expect(page.getByRole("heading", { name: "Image Compressor" }).first()).toBeVisible();
  });

  test("global command palette opens from a tool page and navigates to a tool", async ({
    page,
  }) => {
    await page.goto("/en/image-converter");

    await page.keyboard.press("Control+k");
    await expect(page.locator(".flixo-command-palette")).toBeVisible();

    await page.getByLabel("Search tools").fill("Image Compressor");
    const item = page.locator(".flixo-command-palette__item").first();
    await expect(item).toContainText("Image Compressor");

    await Promise.all([page.waitForURL(/\/en\/image-compressor$/), item.click()]);
    await expect(page.getByRole("heading", { name: "Image Compressor" }).first()).toBeVisible();
  });

  test("quick drop recommends the image tool for an uploaded PNG", async ({ page }) => {
    await page.goto("/en");

    await page.locator(".home-drop-zone input[type=file]").setInputFiles({
      name: "sample.png",
      mimeType: "image/png",
      buffer: Buffer.from(ONE_BY_ONE_PNG, "base64"),
    });

    const dropResult = page.locator(".drop-result");
    await expect(dropResult).toBeVisible();
    await expect(dropResult.locator(".primary-button")).toHaveAttribute(
      "href",
      /image-compressor$/,
    );

    await Promise.all([
      page.waitForURL(/\/en\/image-compressor$/),
      dropResult.locator(".primary-button").click(),
    ]);
    await expect(page.getByRole("heading", { name: "Image Compressor" }).first()).toBeVisible();
  });
});
