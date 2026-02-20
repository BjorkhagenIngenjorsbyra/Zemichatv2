/**
 * Two-User Messaging E2E Test
 *
 * Verifies the full message flow between two real browser sessions:
 *   1. User1 sends a message
 *   2. User2 sees unread badge on chat list
 *   3. User2 opens the chat and sees the message
 *   4. User2 goes back — badge is cleared
 */
import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { loginUser } from './helpers/login';
import { deleteTestMessages, resetUnreadCounts } from './helpers/cleanup';

dotenv.config({ path: '.env.e2e' });

const BASE_URL = 'http://localhost:5173';
const CHAT_ID = process.env.E2E_CHAT_ID!;

test('user1 sends message → user2 sees badge → opens chat → badge clears', async ({ browser }) => {
  const testStart = new Date().toISOString();
  const uniqueText = `E2E-msg-${Date.now()}`;

  // --- Login both users in parallel ---
  const [user1, user2] = await Promise.all([
    loginUser(browser, process.env.E2E_USER1_EMAIL!, process.env.E2E_USER1_PASSWORD!, BASE_URL),
    loginUser(browser, process.env.E2E_USER2_EMAIL!, process.env.E2E_USER2_PASSWORD!, BASE_URL),
  ]);

  try {
    // --- User2: stay on /chats (chat list) ---
    await user2.page.goto(`${BASE_URL}/chats`);
    await user2.page.waitForLoadState('networkidle');

    // --- User1: navigate to the shared chat and send a message ---
    await user1.page.goto(`${BASE_URL}/chat/${CHAT_ID}`);
    await user1.page.waitForLoadState('networkidle');

    const messageInput = user1.page.locator('textarea[data-testid="message-input"]');
    await messageInput.waitFor({ state: 'visible', timeout: 15_000 });
    await messageInput.fill(uniqueText);

    const sendButton = user1.page.locator('[data-testid="send-button"]');
    await sendButton.click();

    // Verify the message appears in user1's view
    const user1Messages = user1.page.locator('[data-testid="messages-container"]');
    await expect(user1Messages.getByText(uniqueText)).toBeVisible({ timeout: 10_000 });

    // --- User2: wait for unread badge on the chat item ---
    const chatItem = user2.page.locator(`[data-testid="chat-item-${CHAT_ID}"]`);
    const badge = chatItem.locator('.unread-badge');

    // Poll with page reloads — Realtime may take a moment
    let badgeSeen = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await expect(badge).toBeVisible({ timeout: 5_000 });
        badgeSeen = true;
        break;
      } catch {
        // Reload chat list and try again
        await user2.page.reload();
        await user2.page.waitForLoadState('networkidle');
      }
    }
    expect(badgeSeen).toBe(true);

    // --- User2: open the chat → verify message is visible ---
    await chatItem.click();
    await user2.page.waitForURL((url) => url.pathname.includes(`/chat/${CHAT_ID}`), { timeout: 10_000 });

    const user2Messages = user2.page.locator('[data-testid="messages-container"]');
    await expect(user2Messages.getByText(uniqueText)).toBeVisible({ timeout: 10_000 });

    // --- User2: go back to chat list → badge should be cleared ---
    await user2.page.goBack();
    await user2.page.waitForURL((url) => url.pathname.includes('/chats'), { timeout: 10_000 });
    await user2.page.waitForLoadState('networkidle');

    // Badge should be gone or show 0
    const badgeAfter = user2.page.locator(`[data-testid="chat-item-${CHAT_ID}"] .unread-badge`);
    await expect(badgeAfter).toBeHidden({ timeout: 10_000 });
  } finally {
    // --- Cleanup ---
    await deleteTestMessages(CHAT_ID, testStart);
    await resetUnreadCounts(CHAT_ID);
    await user1.context.close();
    await user2.context.close();
  }
});
