/**
 * Auth Setup — logs in as Owner and saves authenticated session state.
 *
 * Credentials are read from environment variables:
 *   TEST_OWNER_EMAIL    — Owner account email
 *   TEST_OWNER_PASSWORD — Owner account password
 *
 * Run with:  TEST_OWNER_EMAIL=x TEST_OWNER_PASSWORD=y npx playwright test
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const OWNER_STATE = path.resolve('tests/e2e/.auth/owner.json');

setup('authenticate as owner', async ({ page }) => {
  const email = process.env.TEST_OWNER_EMAIL;
  const password = process.env.TEST_OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing TEST_OWNER_EMAIL or TEST_OWNER_PASSWORD env vars.\n' +
      'Run: TEST_OWNER_EMAIL=you@example.com TEST_OWNER_PASSWORD=secret npx playwright test'
    );
  }

  // 1. Navigate to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // 2. Fill email — Ionic wraps inputs in shadow DOM, so we target the native input
  const emailInput = page.locator('form[data-testid="login-form"] ion-input[type="email"] input');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(email);

  // 3. Fill password
  const passwordInput = page.locator('form[data-testid="login-form"] ion-input[type="password"] input');
  await passwordInput.fill(password);

  // 4. Tap "Logga in" button (submit)
  const submitBtn = page.locator('form[data-testid="login-form"] ion-button[type="submit"]');
  await submitBtn.click();

  // 5. Wait for navigation away from login — we should land on /chats or /dashboard
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });

  // 6. Save authenticated state
  await page.context().storageState({ path: OWNER_STATE });
});
