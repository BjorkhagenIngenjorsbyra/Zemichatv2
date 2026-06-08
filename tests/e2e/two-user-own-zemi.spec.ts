/**
 * Regression: the Add Friend screen shows the user's own Zemi number so they
 * know what to share. Repeatedly flagged by the AI explorer ("asked for a Zemi
 * number but never shown your own"). Runs vs LOCAL Supabase.
 */
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';

test('Add Friend shows the user\'s own Zemi number', async ({ browser }) => {
  // texter1's seeded zemi_number is ZEMI-001-003.
  const u = await loginUser(browser, 'user-aaaa0003@test.local', 'test-password-123!', BASE_URL);
  try {
    await u.page.goto(`${BASE_URL}/add-friend`);
    await u.page.waitForLoadState('networkidle');
    await expect(u.page.getByText('ZEMI-001-003')).toBeVisible({ timeout: 8000 });
  } finally {
    await u.context.close();
  }
});
