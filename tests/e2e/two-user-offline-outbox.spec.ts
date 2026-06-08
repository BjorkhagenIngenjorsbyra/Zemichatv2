/**
 * Offline-first / outbox E2E (B1c) — runs against the LOCAL Supabase stack.
 *
 * Drives the real app UI like a human:
 *   1. Owner opens a chat and sends a message online (sanity).
 *   2. Goes OFFLINE and sends another message — it must not be lost.
 *   3. Comes back ONLINE — the queued message is delivered automatically
 *      (the outbox flushes on reconnect) and appears in the conversation.
 *
 * Requires: local Supabase seeded with the RLS test world + dev server on :5173
 * pointed at local (.env.local). Runs under the `two-user` project (manages its
 * own auth; no production login).
 */
import { test, expect } from '@playwright/test';
import { loginUser } from './helpers/login';

const BASE_URL = 'http://localhost:5173';

// Seeded local test world (src/tests/rls/helpers/global-setup.ts)
const OWNER_EMAIL = 'user-aaaa0001@test.local';
const PASSWORD = 'test-password-123!';
const CHAT_ID = 'cccc0004-0000-0000-0000-000000000004'; // Owner ↔ Texter chat

test('offline message is queued and delivered when connectivity returns', async ({ browser }) => {
  const owner = await loginUser(browser, OWNER_EMAIL, PASSWORD, BASE_URL);

  try {
    await owner.page.goto(`${BASE_URL}/chat/${CHAT_ID}`);
    await owner.page.waitForLoadState('networkidle');

    const input = owner.page.locator('textarea[data-testid="message-input"]');
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    const messages = owner.page.locator('[data-testid="messages-container"]');
    const send = owner.page.locator('[data-testid="send-button"]');

    // 1. Online sanity send
    const onlineText = `e2e-online-${Date.now()}`;
    await input.fill(onlineText);
    await send.click();
    await expect(messages.getByText(onlineText)).toBeVisible({ timeout: 10_000 });

    // 2. Go offline and send — must not be lost
    const offlineText = `e2e-offline-${Date.now()}`;
    await owner.context.setOffline(true);
    await input.fill(offlineText);
    await send.click();
    // Input clears (the send was accepted and queued, not rejected)
    await expect(input).toHaveValue('', { timeout: 5_000 });

    // 3. Reconnect — the outbox should flush and deliver the queued message
    await owner.context.setOffline(false);
    await expect(messages.getByText(offlineText)).toBeVisible({ timeout: 30_000 });
  } finally {
    await owner.context.close();
  }
});
