/**
 * Regression (PRD 8.4): the Team Owner sees the ORIGINAL text of an edited
 * message in oversight, not just the "edited" label. The seed has an edited
 * message in chatSuperToTexter with old_content 'Original content before edit'.
 * Runs vs LOCAL Supabase.
 */
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';
const SUPER_TEXTER_CHAT = 'cccc0003-0000-0000-0000-000000000003';

test('owner sees original text of edited message in oversight', async ({ browser }) => {
  const owner = await loginUser(browser, 'user-aaaa0001@test.local', 'test-password-123!', BASE_URL);
  try {
    await owner.page.goto(`${BASE_URL}/oversight/chat/${SUPER_TEXTER_CHAT}`);
    await owner.page.waitForLoadState('networkidle');
    await owner.page.waitForTimeout(1500);
    await expect(owner.page.getByText('Original content before edit')).toBeVisible({ timeout: 8000 });
  } finally {
    await owner.context.close();
  }
});
