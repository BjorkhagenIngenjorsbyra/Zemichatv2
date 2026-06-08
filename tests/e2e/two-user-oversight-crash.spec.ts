/**
 * Regression: opening Owner oversight (/oversight) must not crash the app.
 *
 * A texter's chat can include a member the owner cannot SELECT via RLS (e.g. a
 * cross-team friend). The oversight service used to map that member to a null
 * user, and OwnerOversight then threw "Cannot read properties of null (reading
 * 'display_name')". The uncaught error blanked the React tree and dropped the
 * whole app to the bootstrap fallback ("Could not start. Please restart the
 * app."). Runs vs LOCAL Supabase. Found by the AI explorer (owner round).
 */
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';

test('Owner oversight renders without crashing the app', async ({ browser }) => {
  const u = await loginUser(browser, 'user-aaaa0001@test.local', 'test-password-123!', BASE_URL);
  const pageErrors: string[] = [];
  u.page.on('pageerror', (e) => pageErrors.push(e.message));
  try {
    await u.page.goto(`${BASE_URL}/oversight`);
    await u.page.waitForTimeout(3000);

    // The bootstrap fallback must not appear.
    await expect(u.page.getByText('Could not start')).toHaveCount(0);
    // No uncaught render error.
    expect(pageErrors, `unexpected page errors: ${pageErrors.join('; ')}`).toHaveLength(0);
  } finally {
    await u.context.close();
  }
});
