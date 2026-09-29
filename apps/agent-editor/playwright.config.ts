import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      SITE_URL: "https://flixoai.m1m2m3m4m5m6m700.workers.dev",
      VITE_SITE_URL: "https://flixoai.m1m2m3m4m5m6m700.workers.dev",
      VITE_RUNTIME_ORIGIN: "http://127.0.0.1:3001",
      VITE_TEST_ORIGIN: "http://127.0.0.1:3001",
      FLIXO_ENABLE_MOCK_LLM: "true",
    },
  },
});
