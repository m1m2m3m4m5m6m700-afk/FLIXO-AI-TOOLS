import { defineConfig, devices } from '@playwright/test';

const useProductionServer = Boolean(process.env.CI) || process.env.PLAYWRIGHT_SERVER === 'production';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 2 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]] : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], actionTimeout: 20_000 } },
  ],
  webServer: {
    command: useProductionServer ? 'npm run build && npm run preview -- --host 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
