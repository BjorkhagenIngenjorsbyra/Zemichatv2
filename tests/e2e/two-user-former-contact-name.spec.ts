/**
 * Regression: when the other party's live profile is hidden by RLS (e.g. a
 * former friend), the chat header still attributes the conversation using the
 * snapshotted name — "Tidigare kontakt (Name)" — so there's evidence of who you
 * talked to, without loosening RLS. super1 cannot SELECT super2's users row, but
 * the chat_members snapshot retains super2's name. Runs vs LOCAL Supabase.
 */
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';
const SUPER_SUPER_CHAT = 'cccc0002-0000-0000-0000-000000000002';

test('chat header shows snapshotted name for an RLS-hidden contact', async ({ browser }) => {
  const u = await loginUser(browser, 'user-aaaa0002@test.local', 'test-password-123!', BASE_URL);
  try {
    await u.page.goto(`${BASE_URL}/chat/${SUPER_SUPER_CHAT}`);
    await u.page.waitForLoadState('networkidle');
    await u.page.waitForTimeout(1500);

    // The header attributes the chat as a former contact WITH the snapshotted
    // name (locale-independent: "(Erik Lund)"), never the bare unnamed
    // placeholder. Title text is e.g. "Former contact (Erik Lund)" / "Tidigare
    // kontakt (Erik Lund)" depending on locale.
    const title = u.page.locator('ion-title').first();
    await expect(title).toContainText('(Erik Lund)', { timeout: 8000 });
    await expect(u.page.getByText('Utan namn')).toHaveCount(0);
    await expect(u.page.getByText(/^Unnamed$/)).toHaveCount(0);
  } finally {
    await u.context.close();
  }
});
