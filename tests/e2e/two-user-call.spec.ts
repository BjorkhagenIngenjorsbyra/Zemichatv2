/**
 * Two-User Call E2E Test
 *
 * Verifies the full voice call flow between two real browser sessions:
 *   1. User1 initiates a voice call
 *   2. User2 sees the incoming call overlay
 *   3. User2 answers
 *   4. Both show connected state with duration timer
 *   5. User1 ends the call
 *   6. Both return to normal state
 *
 * Requires Chromium fake-media flags (configured in playwright.config.ts)
 * so Agora can create audio tracks without real microphones.
 *
 * If Agora credentials are invalid, the test skips gracefully.
 */
import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { loginUser } from './helpers/login';
import { deleteTestCallLogs, deleteTestMessages } from './helpers/cleanup';

dotenv.config({ path: '.env.e2e' });

const BASE_URL = 'http://localhost:5173';
const CHAT_ID = process.env.E2E_CHAT_ID!;

test('user1 initiates voice call → user2 answers → connected → end call', async ({ browser }) => {
  const testStart = new Date().toISOString();

  // --- Login both users in parallel ---
  const [user1, user2] = await Promise.all([
    loginUser(browser, process.env.E2E_USER1_EMAIL!, process.env.E2E_USER1_PASSWORD!, BASE_URL),
    loginUser(browser, process.env.E2E_USER2_EMAIL!, process.env.E2E_USER2_PASSWORD!, BASE_URL),
  ]);

  try {
    // --- Capture console errors for debugging ---
    user1.page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[User1 console.error] ${msg.text()}`);
    });
    user2.page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[User2 console.error] ${msg.text()}`);
    });

    // --- Both users navigate to the shared chat ---
    // User2 first — so CallProvider's Realtime subscription is active before the call
    await user2.page.goto(`${BASE_URL}/chat/${CHAT_ID}`);
    await user2.page.waitForLoadState('networkidle');
    // Wait for Realtime subscription to establish
    await user2.page.waitForTimeout(3_000);

    await user1.page.goto(`${BASE_URL}/chat/${CHAT_ID}`);
    await user1.page.waitForLoadState('networkidle');

    // --- User1: click the voice call button ---
    // CallButton with aria-label matching voice call (first .call-button in header)
    const voiceCallButton = user1.page.locator('.call-button').first();
    await voiceCallButton.waitFor({ state: 'visible', timeout: 10_000 });
    await voiceCallButton.click();

    // --- User1: verify call view overlay appears ---
    const user1CallView = user1.page.locator('.call-view');
    await expect(user1CallView).toBeVisible({ timeout: 10_000 });

    // Check for Agora error — if credentials are bad, skip gracefully
    const calleeStatus = user1.page.locator('.callee-status');
    try {
      // Wait briefly to see if an error appears
      await user1.page.waitForTimeout(3_000);
      const hasError = await user1.page.locator('.callee-status.error').isVisible();
      if (hasError) {
        const errorText = await calleeStatus.textContent();
        test.skip(true, `Agora not configured — call error: ${errorText}`);
        return;
      }
    } catch {
      // No error — continue with test
    }

    // --- User2: wait for incoming call overlay ---
    const incomingOverlay = user2.page.locator('.incoming-call-overlay');
    await expect(incomingOverlay).toBeVisible({ timeout: 30_000 });

    // Verify caller name is visible
    const callerName = user2.page.locator('.caller-name');
    await expect(callerName).toBeVisible();

    // --- User2: answer the call ---
    const answerButton = user2.page.locator('.action-button.answer');
    await answerButton.click();

    // --- Both: verify connected state (duration timer shows digits) ---
    const durationPattern = /\d+:\d{2}/;

    const user1Status = user1.page.locator('.call-status');
    await expect(user1Status).toHaveText(durationPattern, { timeout: 15_000 });

    const user2CallView = user2.page.locator('.call-view');
    await expect(user2CallView).toBeVisible({ timeout: 10_000 });
    const user2Status = user2.page.locator('.call-status');
    await expect(user2Status).toHaveText(durationPattern, { timeout: 15_000 });

    // Wait a few seconds so the timer ticks
    await user1.page.waitForTimeout(3_000);

    // --- User1: end the call ---
    const endCallButton = user1.page.locator('.control-button.end-call');
    await endCallButton.click();

    // --- Both: verify call view disappears ---
    await expect(user1CallView).toBeHidden({ timeout: 10_000 });
    await expect(user2CallView).toBeHidden({ timeout: 10_000 });
  } finally {
    // --- Cleanup ---
    await deleteTestCallLogs(CHAT_ID, testStart);
    await deleteTestMessages(CHAT_ID, testStart);
    await user1.context.close();
    await user2.context.close();
  }
});
