import { defineConfig } from "@playwright/test";

const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, channel: "chrome", serviceWorkers: "block", trace: "retain-on-failure", viewport: { width: 390, height: 844 } },
  webServer: {
    // The server also serves the built client, so the tests exercise the real thing.
    command: "npx tsx ../server/src/index.ts",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PORT: String(PORT), DATABASE_PATH: "./test-results/e2e.db", NODE_ENV: "test", SESSION_SECRET: "e2e-secret" },
  },
});
