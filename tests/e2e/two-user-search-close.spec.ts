/**
 * Deterministic check: does the chat-search overlay close via its X button?
 * Settles whether the AI explorer's recurring "can't close search" finding is a
 * real app bug or an explorer-interaction artifact. Runs vs LOCAL Supabase.
 */
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';
const CHAT_ID = 'cccc0004-0000-0000-0000-000000000004';

test('chat search overlay opens and closes via the X button', async ({ browser }) => {
  const u = await loginUser(browser, 'user-aaaa0001@test.local', 'test-password-123!', BASE_URL);
  try {
    await u.page.goto(`${BASE_URL}/chat/${CHAT_ID}`);
    await u.page.waitForLoadState('networkidle');

    // Open search
    await u.page.locator('[data-testid="open-chat-search"]').click();
    const searchbar = u.page.locator('ion-modal ion-searchbar');
    await expect(searchbar).toBeVisible({ timeout: 8000 });

    // Close via the X button
    await u.page.locator('[data-testid="close-chat-search"]').click();
    await expect(searchbar).toBeHidden({ timeout: 8000 });
  } finally {
    await u.context.close();
  }
});
