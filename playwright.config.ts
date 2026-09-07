import { defineConfig, devices } from '@playwright/test';

const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const isS4RuntimeGate = process.env.S4_RUNTIME_GATE === 'true';
const isS4ExternalServer = process.env.S4_EXTERNAL_SERVER === 'true';
const useProductionServer = !isCi && process.env.PLAYWRIGHT_SERVER === 'production';
const testOrigin = process.env.VITE_TEST_ORIGIN || 'https://canonical.test';
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === 'true';

const capabilityExcludedTests = /@(webgl|fullscreen)/u;
const seedSpec = /seed\.spec\.ts$/u;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCi,
  workers: isS4RuntimeGate ? 4 : isCi ? 3 : undefined,
  retries: isS4RuntimeGate ? 0 : isCi ? 2 : 0,
  timeout: isS4RuntimeGate ? 30_000 : 45_000,
  expect: { timeout: isS4RuntimeGate ? 7_000 : 10_000 },
  preserveOutput: isS4RuntimeGate ? 'failures-only' : 'always',
  reporter: isS4RuntimeGate
    ? [['github'], ['json', { outputFile: 'playwright-report/results.json' }]]
    : isCi
      ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]]
      : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'playwright-report/results.json' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3000',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: isS4RuntimeGate ? 10_000 : 15_000,
  },
  projects: [
    {
      name: 'chromium',
      grepInvert: capabilityExcludedTests,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      grepInvert: capabilityExcludedTests,
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
    {
      name: 'webkit',
      grepInvert: capabilityExcludedTests,
      use: { ...devices['Desktop Safari'], actionTimeout: isS4RuntimeGate ? 12_000 : 20_000 },
    },
    {
      name: 'chromium-seed-webgl',
      testMatch: seedSpec,
      grep: /@webgl/u,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-angle=swiftshader'],
        },
      },
    },
    {
      name: 'chromium-seed-fullscreen',
      testMatch: seedSpec,
      grep: /@fullscreen/u,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  ...(isS4ExternalServer
    ? {}
    : {
        webServer: {
          command: useProductionServer
            ? 'npm run build && npm run preview -- --host 127.0.0.1 --port 3000'
            : 'npm run build:runtime && npm run preview -- --host 127.0.0.1 --port 3000',
          url: 'http://127.0.0.1:3000',
          timeout: 120_000,
          reuseExistingServer,
          env: {
            ...process.env,
            ...(useProductionServer
              ? {}
              : {
                  VITE_RUNTIME_ORIGIN: process.env.VITE_RUNTIME_ORIGIN || testOrigin,
                  VITE_TEST_ORIGIN: process.env.VITE_TEST_ORIGIN || testOrigin,
                }),
          },
        },
      }),
});
