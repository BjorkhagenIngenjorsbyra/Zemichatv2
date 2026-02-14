import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const OWNER_STATE = path.resolve('tests/e2e/.auth/owner.json');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    // Simulate a real Android phone viewport (Pixel 7: 412×915)
    ...devices['Pixel 7'],
    hasTouch: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    // Auth setup — logs in via the UI and saves session cookies/storage
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Main tests — reuse authenticated session, mobile viewport
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        storageState: OWNER_STATE,
      },
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
