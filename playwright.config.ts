import { defineConfig, devices } from '@playwright/test';

const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === 'true';
const testOrigin = process.env.VITE_TEST_ORIGIN || 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/official',
  fullyParallel: true,
  forbidOnly: isCi,
  workers: isCi ? 3 : undefined,
  retries: isCi ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  preserveOutput: 'failures-only',
  reporter: isCi
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || testOrigin,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  ...(reuseExistingServer
    ? {}
    : {
        webServer: {
          command: isCi ? 'npm run preview -- --host 127.0.0.1 --port 3000' : 'npm run build && npm run preview -- --host 127.0.0.1 --port 3000',
          url: 'http://127.0.0.1:3000',
          timeout: 120_000,
          reuseExistingServer,
        },
      }),
});
