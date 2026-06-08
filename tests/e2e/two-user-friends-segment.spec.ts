/**
 * Deterministic check: does the Friends "Förfrågningar" (Requests) segment
 * actually switch the view? Settles whether the AI explorer's recurring
 * "Förfrågningar tab doesn't respond" finding (seen from both the owner and
 * texter perspectives) is a real bug or an explorer-interaction artifact with
 * ion-segment-button. Runs vs LOCAL Supabase.
 */
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';

test('Friends Requests segment switches the view', async ({ browser }) => {
  // texter1 has a pending incoming request (super2 → texter1) in the seed.
  const u = await loginUser(browser, 'user-aaaa0003@test.local', 'test-password-123!', BASE_URL);
  try {
    await u.page.goto(`${BASE_URL}/friends`);
    await u.page.waitForLoadState('networkidle');

    // Default tab is "Mina vänner" → requests container not shown.
    await expect(u.page.locator('[data-testid="requests-container"]')).toHaveCount(0);

    // Switch to the Requests segment.
    await u.page.locator('[data-testid="segment-requests"]').click();

    // The requests view must now be rendered.
    await expect(u.page.locator('[data-testid="requests-container"]')).toBeVisible({ timeout: 8000 });
  } finally {
    await u.context.close();
  }
});
