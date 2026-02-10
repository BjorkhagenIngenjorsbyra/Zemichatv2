import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  projects: [
    // Auth setup - creates storageState files for authenticated tests
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Main tests - depend on setup for auth storageState
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
