import { defineConfig, devices } from '@playwright/test';

const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const isS4RuntimeGate = process.env.S4_RUNTIME_GATE === 'true';
const isS4ExternalServer = process.env.S4_EXTERNAL_SERVER === 'true';
const useProductionServer = isCi || process.env.PLAYWRIGHT_SERVER === 'production';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCi,
  workers: isS4RuntimeGate ? 1 : isCi ? 2 : undefined,
  retries: isS4RuntimeGate ? 0 : isCi ? 2 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: isCi
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3000',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        firefoxUserPrefs: {
          'webgl.disabled': false,
          'webgl.force-enabled': true,
          'layers.acceleration.force-enabled': true,
          'gfx.webrender.all': true,
          'gfx.webrender.software': true,
        },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'], actionTimeout: 20_000 } },
  ],
  webServer: {
    command: useProductionServer
      ? 'npm run build && npm run preview -- --host 127.0.0.1 --port 3000'
      : 'npm run dev',
    url: 'http://127.0.0.1:3000',
    timeout: 120_000,
    reuseExistingServer: !isCi || isS4ExternalServer,
  },
});
