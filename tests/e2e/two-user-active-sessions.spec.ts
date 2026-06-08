/**
 * Regression: logging in records an active session, and Settings shows the
 * "Active devices" section with the current device marked. Runs vs LOCAL Supabase.
 */
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';

test('login records a session and Settings lists it', async ({ browser }) => {
  const u = await loginUser(browser, 'user-aaaa0001@test.local', 'test-password-123!', BASE_URL);
  try {
    // Give the fire-and-forget recordSession() a moment to write the row.
    await u.page.waitForTimeout(1500);
    await u.page.goto(`${BASE_URL}/settings`);
    await u.page.waitForLoadState('networkidle');
    await u.page.waitForTimeout(1500);

    await expect(u.page.getByText('Active devices')).toBeVisible({ timeout: 8000 });
    await expect(u.page.getByText('(this device)')).toBeVisible({ timeout: 8000 });
  } finally {
    await u.context.close();
  }
});
