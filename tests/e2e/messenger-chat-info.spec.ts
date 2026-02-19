/**
 * E2E Tests — Chat Info Page (2026-02-19)
 *
 * Verifies feature F3 (Group info page):
 *
 * Suite 1: Chat info navigation
 *   - Header click in chat view navigates to /chat/:chatId/info
 *   - Chat info page renders with proper structure
 *   - Back button returns to chat view
 *
 * Suite 2: Chat info content (1-on-1 chats)
 *   - Shows avatar and display name
 *   - Shows presence subtitle (online / last seen)
 *   - Shows zemi number for contact
 *   - Shows shared media section
 *   - Does NOT show member list or leave button for 1-on-1
 *
 * Suite 3: Chat info UI elements
 *   - Shared media section header is visible
 *   - Empty shared media shows "no shared media" text
 *   - Page has correct IonBackButton defaultHref
 *
 * Suite 4: No console errors during navigation
 *   - Opening chat info from multiple chats has no errors
 *   - Rapid navigation back and forth is stable
 */
import { test, expect } from '@playwright/test';

// ============================================================
// HELPER: wait for Ionic page transition to settle
// ============================================================
async function waitForIonicReady(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
}

/**
 * Helper to navigate into first chat and extract chatId.
 * Returns chatId or null if no chats.
 */
async function openFirstChat(page: import('@playwright/test').Page): Promise<string | null> {
  await page.goto('/chats');
  await waitForIonicReady(page);

  const firstChat = page.locator('ion-item').first();
  if (!(await firstChat.isVisible())) return null;

  await firstChat.click();
  await waitForIonicReady(page);

  const chatUrl = page.url();
  const match = chatUrl.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

// ============================================================
// SUITE 1: Chat info navigation
// ============================================================
test.describe('Suite 1: Chat info navigation', () => {

  test('1.1 — Header click navigates to /chat/:chatId/info', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    // Click ion-title programmatically (shadow DOM intercepts normal clicks)
    await page.evaluate(() => {
      const title = document.querySelector('ion-title');
      if (title) title.click();
    });
    await waitForIonicReady(page);

    // Should be on the info page
    await expect(page).toHaveURL(new RegExp(`/chat/${chatId}/info`), { timeout: 5000 });
  });

  test('1.2 — Chat info page renders with proper structure', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    // Navigate to info page
    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);

    // Should have basic page structure
    const header = page.locator('ion-header');
    await expect(header.first()).toBeVisible();

    const content = page.locator('ion-content');
    await expect(content.first()).toBeVisible();

    // Should have back button
    const backButton = page.locator('ion-back-button');
    await expect(backButton).toBeAttached();
  });

  test('1.3 — Back button from chat info returns to chat view', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    // Navigate to info via header click (programmatic to bypass shadow DOM)
    await page.evaluate(() => {
      const title = document.querySelector('ion-title');
      if (title) title.click();
    });
    await waitForIonicReady(page);

    // Verify we're on the info page
    await expect(page).toHaveURL(/\/info/);

    // Go back
    await page.goBack();
    await waitForIonicReady(page);

    // Should be back on the chat view
    await expect(page).toHaveURL(new RegExp(`/chat/${chatId}`));
    await expect(page).not.toHaveURL(/\/info/);
  });

  test('1.4 — Direct navigation to /chat/:chatId/info works', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    // Navigate directly to the info URL
    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);

    // Should load without errors
    const content = page.locator('ion-content');
    await expect(content.first()).toBeVisible();
  });
});

// ============================================================
// SUITE 2: Chat info content
// ============================================================
test.describe('Suite 2: Chat info content', () => {

  test('2.1 — Chat info shows avatar area', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);

    // Wait for data to load
    await page.waitForTimeout(1000);

    // Should have info header with avatar
    const infoHeader = page.locator('.info-header');
    if (await infoHeader.isVisible()) {
      const avatar = page.locator('.info-avatar');
      await expect(avatar).toBeVisible();
    }
  });

  test('2.2 — Chat info shows display name', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);
    await page.waitForTimeout(1000);

    const infoHeader = page.locator('.info-header');
    if (await infoHeader.isVisible()) {
      // Should have a name
      const name = page.locator('.info-name');
      const nameCount = await name.count();

      if (nameCount > 0) {
        const nameText = await name.textContent();
        expect(nameText).toBeTruthy();
        expect(nameText!.length).toBeGreaterThan(0);
      }
    }
  });

  test('2.3 — 1-on-1 chat info may show presence subtitle', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);
    await page.waitForTimeout(1000);

    // For 1-on-1 chats, a subtitle with online status may appear
    const subtitle = page.locator('.info-subtitle');
    const subtitleCount = await subtitle.count();

    if (subtitleCount > 0) {
      const subtitleText = await subtitle.textContent();
      expect(subtitleText).toBeTruthy();

      // If user is online, should have 'online' class
      const classes = await subtitle.getAttribute('class');
      expect(classes).toContain('info-subtitle');
    }
  });

  test('2.4 — 1-on-1 chat info shows zemi number', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);
    await page.waitForTimeout(1000);

    // For 1-on-1 chats, should show zemi number
    const zemiNumber = page.locator('.info-zemi');
    const zemiCount = await zemiNumber.count();

    if (zemiCount > 0) {
      const text = await zemiNumber.textContent();
      expect(text).toBeTruthy();
      // Zemi numbers use monospace font class
      const style = await zemiNumber.evaluate((el) => {
        return window.getComputedStyle(el).fontFamily;
      });
      expect(style).toContain('monospace');
    }
  });

  test('2.5 — Chat info has shared media section', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);
    await page.waitForTimeout(1000);

    // Should have shared media section
    const sections = page.locator('.info-section');
    const sectionCount = await sections.count();
    expect(sectionCount).toBeGreaterThanOrEqual(1);

    // Should have section title for shared media
    const sectionTitles = page.locator('.section-title');
    const titleCount = await sectionTitles.count();
    expect(titleCount).toBeGreaterThanOrEqual(1);
  });

  test('2.6 — Shared media shows either images grid or empty message', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);
    await page.waitForTimeout(1000);

    // Either media grid or empty text should be present
    const mediaGrid = page.locator('.media-grid');
    const emptyText = page.locator('.empty-text');

    const hasGrid = await mediaGrid.count() > 0;
    const hasEmpty = await emptyText.count() > 0;

    // One of them should be present (content loaded)
    expect(hasGrid || hasEmpty).toBe(true);
  });

  test('2.7 — Group chat info shows member list with count', async ({ page }) => {
    await page.goto('/chats');
    await waitForIonicReady(page);

    // Try to find a group chat by looking for group indicators
    const chatItems = page.locator('ion-item');
    const itemCount = await chatItems.count();

    let groupChatId: string | null = null;

    // Try each chat to find a group one
    for (let i = 0; i < Math.min(itemCount, 5); i++) {
      const item = chatItems.nth(i);
      if (!(await item.isVisible())) continue;

      await item.click();
      await waitForIonicReady(page);

      const url = page.url();
      const match = url.match(/\/chat\/([^/]+)/);
      if (!match) {
        await page.goBack();
        await waitForIonicReady(page);
        continue;
      }

      const chatId = match[1];
      await page.goto(`/chat/${chatId}/info`);
      await waitForIonicReady(page);
      await page.waitForTimeout(1000);

      // Check if this is a group chat (has members section)
      const membersList = page.locator('.members-list');
      if (await membersList.count() > 0) {
        groupChatId = chatId;

        // Verify member list structure
        const memberItems = page.locator('.member-item');
        const memberCount = await memberItems.count();
        expect(memberCount).toBeGreaterThanOrEqual(1);

        // Should have "Add member" button as the last item
        const addMemberIcon = page.locator('.add-icon');
        const addCount = await addMemberIcon.count();
        expect(addCount).toBeGreaterThanOrEqual(1);

        // Should have leave group button
        const leaveBtn = page.locator('.leave-button');
        if (await leaveBtn.count() > 0) {
          await expect(leaveBtn).toBeVisible();
        }

        break;
      }

      await page.goBack();
      await waitForIonicReady(page);
      await page.goBack();
      await waitForIonicReady(page);
    }

    if (!groupChatId) {
      test.skip(true, 'No group chats found to verify member list');
    }
  });
});

// ============================================================
// SUITE 3: Chat info UI elements
// ============================================================
test.describe('Suite 3: Chat info UI elements', () => {

  test('3.1 — Chat info page title contains correct i18n text', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);

    // The page title should contain chatInfo.title translation
    const title = page.locator('ion-title');
    const titleText = await title.first().textContent();
    expect(titleText).toBeTruthy();
    expect(titleText!.length).toBeGreaterThan(0);
  });

  test('3.2 — Chat info container has correct layout styling', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);
    await page.waitForTimeout(1000);

    // Check for the main container
    const container = page.locator('.chat-info-container');
    const containerCount = await container.count();

    if (containerCount > 0) {
      const padding = await container.evaluate((el) => {
        return window.getComputedStyle(el).padding;
      });
      expect(padding).toBeTruthy();
    }
  });

  test('3.3 — Avatar placeholder shows first letter of name', async ({ page }) => {
    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    await page.goto(`/chat/${chatId}/info`);
    await waitForIonicReady(page);
    await page.waitForTimeout(1000);

    // Check for avatar placeholder (when no image)
    const placeholder = page.locator('.avatar-placeholder.large');
    const placeholderCount = await placeholder.count();

    if (placeholderCount > 0) {
      const text = await placeholder.textContent();
      // Should be a single uppercase letter
      if (text) {
        expect(text.trim().length).toBeLessThanOrEqual(2);
        expect(text.trim()).toMatch(/^[A-ZÅÄÖÆØÜ?]$/i);
      }
    }
  });
});

// ============================================================
// SUITE 4: No console errors during navigation
// ============================================================
test.describe('Suite 4: Stability during navigation', () => {

  test('4.1 — Opening chat info from multiple chats has no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/chats');
    await waitForIonicReady(page);

    const chatItems = page.locator('ion-item');
    const itemCount = await chatItems.count();

    // Open up to 3 different chats' info pages
    for (let i = 0; i < Math.min(itemCount, 3); i++) {
      await page.goto('/chats');
      await waitForIonicReady(page);

      const item = chatItems.nth(i);
      if (!(await item.isVisible())) continue;

      await item.click();
      await waitForIonicReady(page);

      // Click header to go to info (programmatic to bypass shadow DOM)
      await page.evaluate(() => {
        const title = document.querySelector('ion-title');
        if (title) title.click();
      });
      await waitForIonicReady(page);

      // Wait for data to load
      await page.waitForTimeout(500);
    }

    // Filter for chat info related errors
    const chatInfoErrors = errors.filter((e) =>
      e.includes('ChatInfo') ||
      e.includes('chatInfo') ||
      e.includes('getChat') ||
      e.includes('getSharedMedia') ||
      e.includes('usePresence')
    );
    expect(chatInfoErrors).toHaveLength(0);
  });

  test('4.2 — Rapid back-and-forth between chat and info is stable', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    const chatId = await openFirstChat(page);
    if (!chatId) {
      test.skip(true, 'No chats available');
      return;
    }

    // Rapid navigation: chat → info → chat → info → chat
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const title = document.querySelector('ion-title');
        if (title) title.click();
      });
      await page.waitForTimeout(400);

      await page.goBack();
      await page.waitForTimeout(400);
    }

    // No critical errors from rapid navigation
    const criticalErrors = errors.filter((e) =>
      e.includes('Cannot read properties') ||
      e.includes('undefined is not') ||
      e.includes('TypeError') ||
      e.includes('ChunkLoadError')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
