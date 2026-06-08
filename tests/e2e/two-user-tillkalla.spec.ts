/**
 * Tillkalla Vuxen E2E (checklist #13) — runs against the LOCAL Supabase stack.
 *
 * Verifies the renamed feature from the UI:
 *   - A Texter sees the Tillkalla Vuxen symbol button inside a chat and can
 *     trigger it (confirm dialog → confirm).
 *   - An Owner does NOT see the button (texter-only).
 *
 * The data-layer effect (alert insert, unblockable, owner oversight) is covered
 * by the simulation suite (invariants.sim.test). Runs under the `two-user` project.
 */
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';
const PASSWORD = 'test-password-123!';
const OWNER_EMAIL = 'user-aaaa0001@test.local';
const TEXTER_EMAIL = 'user-aaaa0003@test.local'; // texter1 (auth email login works)
const CHAT_ID = 'cccc0004-0000-0000-0000-000000000004'; // Owner ↔ Texter chat

test('Texter can raise Tillkalla Vuxen from a chat; Owner cannot see the button', async ({ browser }) => {
  const texter = await loginUser(browser, TEXTER_EMAIL, PASSWORD, BASE_URL);
  const owner = await loginUser(browser, OWNER_EMAIL, PASSWORD, BASE_URL);

  try {
    // --- Texter side: button is present and the confirm flow works ---
    await texter.page.goto(`${BASE_URL}/chat/${CHAT_ID}`);
    await texter.page.waitForLoadState('networkidle');

    const button = texter.page.locator('[data-testid="tillkalla-button"]');
    await expect(button).toBeVisible({ timeout: 15_000 });
    await button.click();

    const confirm = texter.page.locator('[data-testid="tillkalla-confirm"]');
    await expect(confirm).toBeVisible({ timeout: 5_000 });
    await confirm.click();

    // Modal closes after confirming (the alert was sent).
    await expect(confirm).toBeHidden({ timeout: 10_000 });

    // --- Owner side: the button must NOT be available (texter-only) ---
    await owner.page.goto(`${BASE_URL}/chat/${CHAT_ID}`);
    await owner.page.waitForLoadState('networkidle');
    await owner.page.waitForTimeout(1_500);
    await expect(owner.page.locator('[data-testid="tillkalla-button"]')).toHaveCount(0);
  } finally {
    await texter.context.close();
    await owner.context.close();
  }
});
