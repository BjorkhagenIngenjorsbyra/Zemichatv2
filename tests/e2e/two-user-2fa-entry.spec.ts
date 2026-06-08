/**
 * Regression: the two-factor authentication entry appears in Settings for an
 * Owner (opt-in) and links to setup, and is NOT shown to a Texter. Runs vs LOCAL.
 */
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';

test('2FA entry is offered to the owner but not the texter', async ({ browser }) => {
  // Owner sees the 2FA section with an Enable action.
  const owner = await loginUser(browser, 'user-aaaa0001@test.local', 'test-password-123!', BASE_URL);
  try {
    await owner.page.goto(`${BASE_URL}/settings`);
    await owner.page.waitForLoadState('networkidle');
    await owner.page.waitForTimeout(1500);
    await expect(owner.page.getByRole('button', { name: 'Enable' })).toBeVisible({ timeout: 8000 });
  } finally {
    await owner.context.close();
  }

  // Texter must not see it.
  const texter = await loginUser(browser, 'user-aaaa0003@test.local', 'test-password-123!', BASE_URL);
  try {
    await texter.page.goto(`${BASE_URL}/settings`);
    await texter.page.waitForLoadState('networkidle');
    await texter.page.waitForTimeout(1500);
    await expect(texter.page.getByRole('button', { name: 'Enable' })).toHaveCount(0);
  } finally {
    await texter.context.close();
  }
});
