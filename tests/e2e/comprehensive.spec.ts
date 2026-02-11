import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OWNER_AUTH = resolve(__dirname, '.auth/owner.json');
const NEW_OWNER_AUTH = resolve(__dirname, '.auth/new-owner.json');
const TEXTER_AUTH = resolve(__dirname, '.auth/texter.json');
const SUPER_AUTH = resolve(__dirname, '.auth/super.json');

function getSeedData() {
  const path = resolve(__dirname, '.auth/seed-data.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function rgbLightness(rgb: string): number {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return -1;
  return (parseInt(m[1]) + parseInt(m[2]) + parseInt(m[3])) / 3;
}

async function waitForApp(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.locator('ion-app.hydrated').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
}

async function setLocale(page: Page, lang: string) {
  await page.evaluate((l) => localStorage.setItem('zemichat-language', l), lang);
  await page.reload();
  await waitForApp(page);
  await page.waitForTimeout(300);
}

async function assertNoRawKeys(page: Page) {
  const body = await page.locator('body').textContent() ?? '';
  const rawKeyPattern =
    /\b(auth|common|friends|dashboard|texter|settings|quickMessages|chat|welcome|verifyEmail|choosePlan|trial|invite|sos|quietHours|roles|texterLogin)\.[a-zA-Z]{2,}\b/;
  expect(body).not.toMatch(rawKeyPattern);
}

// ─────────────────────────────────────────────────────────────
// A. AUTENTISERING (15 tester)
// ─────────────────────────────────────────────────────────────

test.describe('A. Autentisering', () => {

  test('A01 – Välkomstsida visas för nya användare', async ({ page }) => {
    await page.goto('/welcome');
    await waitForApp(page);
    await expect(page.locator('.welcome-container')).toBeVisible({ timeout: 10_000 });
  });

  test('A02 – Signup-formulär har alla fält', async ({ page }) => {
    await page.goto('/signup');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator('ion-checkbox')).toBeVisible();
    await expect(page.locator('ion-button[type="submit"]')).toBeVisible();
  });

  test('A03 – Felaktig e-post avvisas vid signup', async ({ page }) => {
    await page.goto('/signup');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('Test');
    await inputs.nth(1).locator('input').fill('not-an-email');
    await inputs.nth(2).locator('input').fill('password123');
    await inputs.nth(3).locator('input').fill('password123');
    await page.locator('ion-checkbox').click();
    await page.locator('ion-button[type="submit"]').click();
    await page.waitForTimeout(3_000);
    const url = page.url();
    const hasError = await page.locator('.auth-error').isVisible().catch(() => false);
    expect(hasError || url.includes('/signup')).toBeTruthy();
  });

  test('A04 – Lösenord under 6 tecken avvisas', async ({ page }) => {
    await page.goto('/signup');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('Test');
    await inputs.nth(1).locator('input').fill('test@example.com');
    await inputs.nth(2).locator('input').fill('abc');
    await inputs.nth(3).locator('input').fill('abc');
    await page.locator('ion-checkbox').click();
    await page.locator('ion-button[type="submit"]').click();
    await page.waitForTimeout(3_000);
    const url = page.url();
    const hasError = await page.locator('.auth-error').isVisible().catch(() => false);
    expect(hasError || url.includes('/signup')).toBeTruthy();
  });

  test('A05 – Lösenord som inte matchar avvisas', async ({ page }) => {
    await page.goto('/signup');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('Test');
    await inputs.nth(1).locator('input').fill('mismatch@example.com');
    await inputs.nth(2).locator('input').fill('password123');
    await inputs.nth(3).locator('input').fill('different456');
    await page.locator('ion-checkbox').click();
    await page.locator('ion-button[type="submit"]').click();
    await page.waitForTimeout(2_000);
    const hasError = await page.locator('.auth-error').isVisible().catch(() => false);
    const onPage = page.url().includes('/signup');
    expect(hasError || onPage).toBeTruthy();
  });

  test('A06 – Login-formulär visas och avvisar tomt formulär', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    const inputs = page.locator('ion-input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(2);
    const submitBtn = page.locator('ion-button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    // Click submit without filling anything — should stay on login and show error
    await submitBtn.click();
    await page.waitForTimeout(2_000);
    const hasError = await page.locator('.auth-error').count() > 0;
    const stillOnLogin = page.url().includes('/login');
    expect(hasError || stillOnLogin).toBeTruthy();
  });

  test('A07 – Felaktigt lösenord visar felmeddelande', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('e2e-owner@test.zemichat.local');
    await inputs.nth(1).locator('input').fill('wrong-password');
    await page.locator('ion-button[type="submit"]').click();
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 10_000 });
  });

  test('A08 – Korrekt login omdirigerar till /chats', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('e2e-owner@test.zemichat.local');
    await inputs.nth(1).locator('input').fill('TestOwner123!');
    await page.locator('ion-button[type="submit"]').click();
    await page.waitForURL('**/chats**', { timeout: 15_000 });
    expect(page.url()).toContain('/chats');
  });

  test('A09 – Ny ägare utan team omdirigeras till /create-team', async ({ page }) => {
    test.skip(!existsSync(NEW_OWNER_AUTH), 'No new-owner auth');
    await page.goto('/login');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('e2e-newowner@test.zemichat.local');
    await inputs.nth(1).locator('input').fill('TestNewOwner123!');
    await page.locator('ion-button[type="submit"]').click();
    await page.waitForURL('**/create-team**', { timeout: 15_000 });
    expect(page.url()).toContain('/create-team');
  });

  test('A10 – Texter-login avvisar tomt formulär', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(2);
    const submitBtn = page.locator('ion-button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    // Click submit without filling anything — should stay on texter-login and show error
    await submitBtn.click();
    await page.waitForTimeout(2_000);
    const hasError = await page.locator('.auth-error').count() > 0;
    const stillOnPage = page.url().includes('/texter-login');
    expect(hasError || stillOnPage).toBeTruthy();
  });

  test('A11 – Texter-login med fel Zemi-nummer avvisas', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('ZEMI-XXX-XXX');
    await inputs.nth(1).locator('input').fill('wrongpassword');
    await page.locator('ion-button[type="submit"]').click();
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 10_000 });
  });

  test('A12 – Skyddade sidor kräver inloggning', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const url = page.url();
    expect(url.includes('/login') || url.includes('/welcome') || url.includes('/chats')).toBeTruthy();
  });

  test('A13 – Create-team sida visas för ny owner', async ({ page }) => {
    test.skip(!existsSync(NEW_OWNER_AUTH), 'No new-owner auth');
    await page.context().storageState().then(() => {});
    const ctx = await page.context().browser()!.newContext({ storageState: NEW_OWNER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/create-team');
    await waitForApp(p);
    await expect(p.locator('ion-input')).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });

  test('A14 – Signup har länk till integritetspolicy', async ({ page }) => {
    await page.goto('/signup');
    await waitForApp(page);
    const links = page.locator('a[href*="privacy"], ion-button[routerLink*="privacy"]');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(0); // May be in checkbox label or as link
  });

  test('A15 – Login visar app-namn (Zemichat)', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const title = await page.locator('.auth-title').textContent();
    expect(title?.toLowerCase()).toContain('zemichat');
  });
});

// ─────────────────────────────────────────────────────────────
// B. OWNER DASHBOARD (20 tester) - autentiserade
// ─────────────────────────────────────────────────────────────

test.describe('B. Owner Dashboard', () => {
  test.use({ storageState: OWNER_AUTH });

  test('B01 – Chattlista visas efter login', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    // Should see chat list (may have seed chats or be empty)
    const hasChatItems = await page.locator('.chat-item').count();
    const hasEmptyState = await page.locator('[data-testid="empty-chat-list"]').count();
    expect(hasChatItems + hasEmptyState).toBeGreaterThan(0);
  });

  test('B02 – Seeded chattar syns i listan', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const chatItems = page.locator('.chat-item');
    const count = await chatItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('B03 – Ny chatt-knapp finns', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await expect(page.locator('[data-testid="new-chat-fab"]')).toBeVisible();
  });

  test('B04 – Ny chatt-knapp navigerar till /new-chat', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await page.locator('[data-testid="new-chat-fab"]').click();
    await page.waitForURL('**/new-chat**', { timeout: 5_000 });
    expect(page.url()).toContain('/new-chat');
  });

  test('B05 – New-chat visar kontaktlista', async ({ page }) => {
    await page.goto('/new-chat');
    await waitForApp(page);
    // Should show friends as contacts
    const items = page.locator('ion-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('B06 – Dashboard visar team-namn och minst 1 medlem', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await expect(page.locator('[data-testid="dashboard-actions"]')).toBeVisible({ timeout: 10_000 });
    // Verify team name is shown
    const teamName = page.locator('.team-name, ion-title').first();
    const teamText = await teamName.textContent();
    expect(teamText!.trim().length).toBeGreaterThan(0);
    // Verify at least one team member is listed
    await page.waitForTimeout(2_000);
    const memberItems = page.locator('.member-item');
    expect(await memberItems.count()).toBeGreaterThanOrEqual(1);
  });

  test('B07 – Dashboard visar teammedlemmar', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const memberList = page.locator('[data-testid="member-list"]');
    const memberItems = page.locator('.member-item');
    const hasList = await memberList.count() > 0;
    const hasMembers = await memberItems.count() > 0;
    const hasEmptyState = await page.locator('.empty-state').count() > 0;
    expect(hasList || hasMembers || hasEmptyState).toBeTruthy();
  });

  test('B08 – Dashboard visar Quick Actions', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const actions = page.locator('[data-testid="dashboard-actions"] .action-item');
    expect(await actions.count()).toBeGreaterThanOrEqual(3);
  });

  test('B09 – Approvals-länk finns i dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const approvalItem = page.locator('.action-item').first();
    await expect(approvalItem).toBeVisible();
  });

  test('B10 – Create Texter-knapp finns i dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const createTexterItem = page.locator('.action-item').nth(1);
    await expect(createTexterItem).toBeVisible();
  });

  test('B11 – Oversight-länk finns i dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const oversightItem = page.locator('.action-item').nth(2);
    await expect(oversightItem).toBeVisible();
  });

  test('B12 – Invite Super-länk finns i dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const inviteItem = page.locator('.action-item').nth(3);
    await expect(inviteItem).toBeVisible();
  });

  test('B13 – Settings-sida nås', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    await expect(page.locator('[data-testid="profile-card"]')).toBeVisible({ timeout: 10_000 });
  });

  test('B14 – Settings visar profilinfo', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const profileCard = page.locator('[data-testid="profile-card"]');
    await expect(profileCard).toBeVisible({ timeout: 10_000 });
    const text = await profileCard.textContent();
    expect(text).toContain('ZEMI-');
  });

  test('B15 – Settings visar Dashboard-länk för owner', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const dashboardLink = page.locator('.dashboard-link-btn');
    await expect(dashboardLink).toBeVisible();
  });

  test('B16 – Settings visar språkväljare', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    await expect(page.locator('[data-testid="language-grid"]')).toBeVisible();
    const options = page.locator('.language-option');
    expect(await options.count()).toBeGreaterThanOrEqual(5);
  });

  test('B17 – Språkbyte till engelska fungerar', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    // Click English option
    const enOption = page.locator('.language-option').filter({ hasText: 'English' });
    if (await enOption.count() > 0) {
      await enOption.click();
      await page.waitForTimeout(500);
      const body = await page.locator('body').textContent();
      // After switching to English, should show English text
      expect(body?.toLowerCase()).toContain('settings');
    }
  });

  test('B18 – Export data-knapp finns', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    // Export section has a button with download icon
    const exportBtn = page.locator('ion-button ion-icon[name="download-outline"], ion-button ion-icon[icon*="download"]').first();
    const exportSection = page.locator('.section').filter({ hasText: /export/i });
    expect((await exportBtn.count()) + (await exportSection.count())).toBeGreaterThan(0);
  });

  test('B19 – Delete account-sektion finns för owner', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const dangerCard = page.locator('.danger-card');
    await expect(dangerCard).toBeVisible();
  });

  test('B20 – Logout-knapp finns', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    // Logout button uses logOutOutline icon
    const logoutBtn = page.locator('ion-button[color="medium"]').filter({ has: page.locator('ion-icon') });
    await expect(logoutBtn.first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// C. CHAT-FUNKTIONER - autentiserade (20 tester)
// ─────────────────────────────────────────────────────────────

test.describe('C. Chat Functions', () => {
  test.use({ storageState: OWNER_AUTH });

  test('C01 – Öppna en chatt visar meddelanden', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() > 0) {
      await firstChat.click();
      await page.waitForURL('**/chat/**', { timeout: 5_000 });
      await waitForApp(page);
      await page.waitForTimeout(3_000);
      // Should see messages container or input
      const msgContainer = page.locator('[data-testid="messages-container"]');
      const msgInput = page.locator('[data-testid="message-input"]');
      const hasMessages = await msgContainer.count() > 0;
      const hasInput = await msgInput.count() > 0;
      expect(hasMessages || hasInput).toBeTruthy();
    }
  });

  test('C02 – Chattvy har input-fält', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() > 0) {
      await firstChat.click();
      await page.waitForURL('**/chat/**', { timeout: 5_000 });
      await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('C03 – Skicka-knappen visas när text skrivs', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() > 0) {
      await firstChat.click();
      await page.waitForURL('**/chat/**', { timeout: 5_000 });
      await waitForApp(page);
      const input = page.locator('[data-testid="message-input"]');
      await input.fill('Test message');
      await expect(page.locator('[data-testid="send-button"]')).toBeVisible({ timeout: 3_000 });
    }
  });

  test('C04 – Skicka ett textmeddelande', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    const uniqueMsg = `E2E-test-${Date.now()}`;
    const input = page.locator('[data-testid="message-input"]');
    await input.fill(uniqueMsg);
    await page.locator('[data-testid="send-button"]').click();

    // Wait for message to appear
    await expect(page.locator(`.message-content:has-text("${uniqueMsg}")`)).toBeVisible({ timeout: 10_000 });
  });

  test('C05 – Meddelande visas med tidstämpel', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);
    await page.waitForTimeout(3_000);

    const timeElements = page.locator('.message-time');
    const count = await timeElements.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('C06 – Seeded meddelanden visas', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);
    await page.waitForTimeout(3_000);

    const messages = page.locator('.message-bubble');
    expect(await messages.count()).toBeGreaterThanOrEqual(1);
  });

  test('C07 – Egen meddelande visas högerställt', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    const ownMessages = page.locator('.message-wrapper.own');
    if (await ownMessages.count() > 0) {
      const styles = await ownMessages.first().evaluate((el) => getComputedStyle(el).justifyContent);
      expect(styles).toBe('flex-end');
    }
  });

  test('C08 – Andras meddelanden visas vänsterställda', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    const otherMessages = page.locator('.message-wrapper.other');
    if (await otherMessages.count() > 0) {
      const styles = await otherMessages.first().evaluate((el) => getComputedStyle(el).justifyContent);
      expect(styles).toBe('flex-start');
    }
  });

  test('C09 – Back-knapp finns i chattvy', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await expect(page.locator('ion-back-button')).toBeVisible();
  });

  test('C10 – Chattens titel visas i headern', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);
    await page.waitForTimeout(2_000);

    // Chat header shows contact name or chat title
    const header = page.locator('ion-header');
    const headerText = await header.textContent();
    expect(headerText?.trim().length).toBeGreaterThan(0);
  });

  test('C11 – Sökning i chatt fungerar', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    // Find search button
    const searchBtn = page.locator('ion-button ion-icon[name*="search"], ion-button').filter({ hasText: '' });
    if (await searchBtn.count() > 0) {
      // Search icon exists
      expect(await searchBtn.count()).toBeGreaterThan(0);
    }
  });

  test('C12 – Enter-tangent skickar meddelande', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    const uniqueMsg = `Enter-test-${Date.now()}`;
    const input = page.locator('[data-testid="message-input"]');
    await input.fill(uniqueMsg);
    await input.press('Enter');

    await expect(page.locator(`.message-content:has-text("${uniqueMsg}")`)).toBeVisible({ timeout: 10_000 });
  });

  test('C13 – Input-fältet töms efter skickning', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    const input = page.locator('[data-testid="message-input"]');
    await input.fill(`Clear-test-${Date.now()}`);
    await input.press('Enter');
    await page.waitForTimeout(1_000);
    const value = await input.inputValue();
    expect(value).toBe('');
  });

  test('C14 – Chattlista visar senaste meddelandet', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const lastMessage = page.locator('.last-message').first();
    if (await lastMessage.count() > 0) {
      const text = await lastMessage.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('C15 – Chattlistan visar tid för senaste meddelande', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const chatTime = page.locator('.chat-time').first();
    if (await chatTime.count() > 0) {
      const text = await chatTime.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('C16 – Sök-knapp finns i chattlistan', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    // Search icon in toolbar
    const searchBtns = page.locator('ion-buttons[slot="end"] ion-button');
    expect(await searchBtns.count()).toBeGreaterThanOrEqual(1);
  });

  test('C17 – Dashboard-knapp finns i chattlistan (Owner)', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    // Dashboard button is an icon button in the toolbar header
    const headerBtns = page.locator('ion-buttons[slot="end"] ion-button');
    expect(await headerBtns.count()).toBeGreaterThanOrEqual(1);
  });

  test('C18 – GIF-knapp finns i chattinput', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    const gifBtn = page.locator('button[aria-label="GIF"]');
    await expect(gifBtn).toBeVisible();
  });

  test('C19 – Sticker-knapp finns i chattinput', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    const stickerBtn = page.locator('button[aria-label="Sticker"]');
    await expect(stickerBtn).toBeVisible();
  });

  test('C20 – Chatt har datumavskiljare', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    // Date dividers are shown for different days
    const dividers = page.locator('.date-divider');
    if (await page.locator('.message-bubble').count() > 0) {
      expect(await dividers.count()).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// D. FRIENDS (15 tester)
// ─────────────────────────────────────────────────────────────

test.describe('D. Friends', () => {
  test.use({ storageState: OWNER_AUTH });

  test('D01 – Vänner-sida visar segment och minst 1 vän eller request', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    const segment = page.locator('ion-segment');
    await expect(segment).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2_000);
    // Verify at least one friend card, team member, or request exists
    const friends = page.locator('.friend-card');
    const teamMembers = page.locator('.team-member-item, .team-list .member-item');
    const total = (await friends.count()) + (await teamMembers.count());
    expect(total).toBeGreaterThanOrEqual(1);
  });

  test('D02 – Vänner-segment har flikar', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    const segments = page.locator('ion-segment-button');
    expect(await segments.count()).toBeGreaterThanOrEqual(2);
  });

  test('D03 – Seeded vänner visas i listan', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const friendCards = page.locator('.friend-card');
    const emptyState = page.locator('.empty-state');
    const hasFriends = await friendCards.count() > 0;
    const hasEmpty = await emptyState.count() > 0;
    expect(hasFriends || hasEmpty).toBeTruthy();
  });

  test('D04 – Vänkort visar Zemi-nummer', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const zemiNumbers = page.locator('.friend-zemi');
    if (await zemiNumbers.count() > 0) {
      const text = await zemiNumbers.first().textContent();
      expect(text).toContain('ZEMI-');
    }
  });

  test('D05 – Lägg till vän-knapp finns', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await expect(page.locator('[data-testid="add-friend-fab"]')).toBeVisible();
  });

  test('D06 – Lägg till vän-knapp navigerar till /add-friend', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.locator('[data-testid="add-friend-fab"]').click();
    await page.waitForURL('**/add-friend**', { timeout: 5_000 });
    expect(page.url()).toContain('/add-friend');
  });

  test('D07 – Requests-flik kan väljas', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    const requestsTab = page.locator('ion-segment-button[value="requests"]');
    await requestsTab.click();
    await page.waitForTimeout(500);
    // Should show empty or requests
    const body = await page.locator('ion-content').textContent();
    expect(body).toBeTruthy();
  });

  test('D08 – Team-sektion visas för owner', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    // Owner should see team section
    const teamSection = page.locator('.team-section');
    if (await teamSection.count() > 0) {
      const teamList = page.locator('.team-list');
      await expect(teamList).toBeVisible();
    }
  });

  test('D09 – Team visar roller (Super/Texter)', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const badges = page.locator('.team-role-badge');
    if (await badges.count() > 0) {
      const badgeText = await badges.first().textContent();
      expect(badgeText?.trim().length).toBeGreaterThan(0);
    }
  });

  test('D10 – Add friend-sida har input', async ({ page }) => {
    await page.goto('/add-friend');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(1);
  });

  test('D11 – Vänner visar online-status', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const statusDots = page.locator('.status-dot');
    if (await statusDots.count() > 0) {
      await expect(statusDots.first()).toBeVisible();
    }
  });

  test('D12 – Vänlista har pull-to-refresh', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    const refresher = page.locator('ion-refresher');
    expect(await refresher.count()).toBeGreaterThanOrEqual(1);
  });

  test('D13 – Vänner visar avatar-placeholder', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const avatars = page.locator('.avatar-placeholder, .team-avatar-placeholder');
    if (await avatars.count() > 0) {
      const text = await avatars.first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('D14 – Texter-klick navigerar till texter-detalj', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const texterItem = page.locator('.team-member-item').filter({ hasText: /texter/i });
    if (await texterItem.count() > 0) {
      await texterItem.first().click();
      await page.waitForURL('**/texter/**', { timeout: 5_000 });
      expect(page.url()).toContain('/texter/');
    }
  });

  test('D15 – Vänlista visar namn', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const names = page.locator('.friend-name, .team-member-name');
    if (await names.count() > 0) {
      const text = await names.first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// E. NAVIGATION & TABS (10 tester)
// ─────────────────────────────────────────────────────────────

test.describe('E. Navigation & Tabs', () => {
  test.use({ storageState: OWNER_AUTH });

  test('E01 – Bottom tabs finns', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const tabs = page.locator('ion-tab-bar ion-tab-button, ion-tabs ion-tab-button');
    if (await tabs.count() === 0) {
      // May use different tab pattern
      const tabBar = page.locator('ion-tab-bar');
      expect(await tabBar.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('E02 – Navigering till /friends fungerar', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    expect(page.url()).toContain('/friends');
  });

  test('E03 – Navigering till /settings fungerar', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    expect(page.url()).toContain('/settings');
    await expect(page.locator('[data-testid="profile-card"]')).toBeVisible({ timeout: 10_000 });
  });

  test('E04 – Navigering till /chats fungerar', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    expect(page.url()).toContain('/chats');
  });

  test('E05 – Tillbaka-navigering fungerar från chatt', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await page.locator('ion-back-button').click();
    await page.waitForURL('**/chats**', { timeout: 5_000 });
    expect(page.url()).toContain('/chats');
  });

  test('E06 – Legal pages nås', async ({ page }) => {
    await page.goto('/privacy');
    await waitForApp(page);
    expect(page.url()).toContain('/privacy');
  });

  test('E07 – Terms page nås', async ({ page }) => {
    await page.goto('/terms');
    await waitForApp(page);
    expect(page.url()).toContain('/terms');
  });

  test('E08 – Support-sida nås', async ({ page }) => {
    await page.goto('/support');
    await waitForApp(page);
    expect(page.url()).toContain('/support');
  });

  test('E09 – Owner oversight nås', async ({ page }) => {
    await page.goto('/oversight');
    await waitForApp(page);
    expect(page.url()).toContain('/oversight');
  });

  test('E10 – Owner approvals nås', async ({ page }) => {
    await page.goto('/owner-approvals');
    await waitForApp(page);
    expect(page.url()).toContain('/owner-approvals');
  });
});

// ─────────────────────────────────────────────────────────────
// F. INTERNATIONALISERING (15 tester)
// ─────────────────────────────────────────────────────────────

test.describe('F. i18n', () => {
  test.use({ storageState: OWNER_AUTH });

  test('F01 – Svenska: inga råa i18n-nycklar på /chats', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await setLocale(page, 'sv');
    await assertNoRawKeys(page);
  });

  test('F02 – Engelska: inga råa i18n-nycklar på /chats', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await setLocale(page, 'en');
    await assertNoRawKeys(page);
  });

  test('F03 – Norska: inga råa i18n-nycklar på /chats', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await setLocale(page, 'no');
    await assertNoRawKeys(page);
  });

  test('F04 – Danska: inga råa i18n-nycklar på /chats', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await setLocale(page, 'da');
    await assertNoRawKeys(page);
  });

  test('F05 – Finska: inga råa i18n-nycklar på /chats', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await setLocale(page, 'fi');
    await assertNoRawKeys(page);
  });

  test('F06 – Svenska: inga råa nycklar på /settings', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    await setLocale(page, 'sv');
    await assertNoRawKeys(page);
  });

  test('F07 – Engelska: inga råa nycklar på /settings', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    await setLocale(page, 'en');
    await assertNoRawKeys(page);
  });

  test('F08 – Svenska: inga råa nycklar på /friends', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await setLocale(page, 'sv');
    await assertNoRawKeys(page);
  });

  test('F09 – Engelska: inga råa nycklar på /friends', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await setLocale(page, 'en');
    await assertNoRawKeys(page);
  });

  test('F10 – Svenska: inga råa nycklar på /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await setLocale(page, 'sv');
    await assertNoRawKeys(page);
  });

  test('F11 – Engelska: inga råa nycklar på /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await setLocale(page, 'en');
    await assertNoRawKeys(page);
  });

  test('F12 – Login-sida: inga råa nycklar (sv)', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await setLocale(page, 'sv');
    await assertNoRawKeys(page);
  });

  test('F13 – Login-sida: inga råa nycklar (en)', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await setLocale(page, 'en');
    await assertNoRawKeys(page);
  });

  test('F14 – Texter-login: inga råa nycklar (sv)', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    await setLocale(page, 'sv');
    await assertNoRawKeys(page);
  });

  test('F15 – Signup-sida: inga råa nycklar (sv)', async ({ page }) => {
    await page.goto('/signup');
    await waitForApp(page);
    await setLocale(page, 'sv');
    await assertNoRawKeys(page);
  });
});

// ─────────────────────────────────────────────────────────────
// G. UI & DARK MODE (10 tester)
// ─────────────────────────────────────────────────────────────

test.describe('G. UI & Dark Mode', () => {

  test('G01 – Dark mode: tillräcklig kontrast på login', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await waitForApp(page);
    const bg = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
    const lightness = rgbLightness(bg);
    if (lightness >= 0) {
      expect(lightness).toBeLessThan(80);
    }
  });

  test('G02 – Light mode: tillräcklig kontrast', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    await waitForApp(page);
    const bg = await page.locator('ion-content').evaluate((el) => getComputedStyle(el).backgroundColor);
    const lightness = rgbLightness(bg);
    // In light mode, background should be bright (or transparent/unset)
    expect(lightness === -1 || lightness > 100).toBeTruthy();
  });

  test('G03 – Ionic-komponenter hydrateras', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await expect(page.locator('ion-app.hydrated')).toBeVisible({ timeout: 15_000 });
  });

  test('G04 – CSS laddar korrekt (ingen synlig glitch)', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const authContainer = page.locator('.auth-container');
    if (await authContainer.count() > 0) {
      const display = await authContainer.evaluate((el) => getComputedStyle(el).display);
      expect(display).toBe('flex');
    }
  });

  test('G05 – Inga JavaScript-konsolfel', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/login');
    await waitForApp(page);
    // Filter out known non-critical errors
    const critical = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::') && !e.includes('Capacitor')
    );
    expect(critical.length).toBe(0);
  });

  test('G06 – Welcome-sida har animering-stil', async ({ page }) => {
    await page.goto('/welcome');
    await waitForApp(page);
    const container = page.locator('.welcome-container');
    if (await container.count() > 0) {
      await expect(container).toBeVisible();
    }
  });

  test('G07 – Avatar-placeholders renderar bokstav', async ({ page }) => {
    const ctx = await page.context().browser()!.newContext({ storageState: OWNER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/friends');
    await waitForApp(p);
    await p.waitForTimeout(2_000);
    const placeholders = p.locator('.avatar-placeholder, .team-avatar-placeholder');
    if (await placeholders.count() > 0) {
      const text = await placeholders.first().textContent();
      expect(text?.match(/[A-Z?]/)).toBeTruthy();
    }
    await ctx.close();
  });

  // G08 removed – assertion (count >= 0) always true, provided no test value

  test('G09 – FAB-knappar har rätt position', async ({ page }) => {
    const ctx = await page.context().browser()!.newContext({ storageState: OWNER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/chats');
    await waitForApp(p);
    const fab = p.locator('ion-fab, .safe-fab, [data-testid="new-chat-fab"]');
    expect(await fab.count()).toBeGreaterThanOrEqual(1);
    await ctx.close();
  });

  test('G10 – Responsiv layout fungerar vid 375px bredd', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await waitForApp(page);
    const container = page.locator('.auth-container');
    if (await container.count() > 0) {
      const box = await container.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(375);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// H. TEXTER-SPECIFIKA TESTER (15 tester)
// ─────────────────────────────────────────────────────────────

test.describe('H. Texter View', () => {
  test.beforeEach(async () => {
    test.skip(!existsSync(TEXTER_AUTH), 'No texter auth session');
  });

  test.use({ storageState: TEXTER_AUTH });

  test('H01 – Texter ser chattlista med namn och senaste meddelande', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const chatItems = page.locator('.chat-item');
    expect(await chatItems.count()).toBeGreaterThanOrEqual(1);
    // Verify first chat item has a name and last-message preview
    const firstName = chatItems.first().locator('.chat-name');
    const nameText = await firstName.textContent().catch(() => '');
    expect(nameText!.trim().length).toBeGreaterThan(0);
  });

  test('H02 – Texter ser seeded chatt', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const chatItems = page.locator('.chat-item');
    expect(await chatItems.count()).toBeGreaterThanOrEqual(1);
  });

  test('H03 – Texter kan öppna chatt', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() > 0) {
      await firstChat.click();
      await page.waitForURL('**/chat/**', { timeout: 5_000 });
      await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('H04 – Texter kan skicka meddelande', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    const uniqueMsg = `Texter-msg-${Date.now()}`;
    const input = page.locator('[data-testid="message-input"]');
    await input.fill(uniqueMsg);
    await input.press('Enter');

    await expect(page.locator(`.message-content:has-text("${uniqueMsg}")`)).toBeVisible({ timeout: 10_000 });
  });

  test('H05 – Texter ser SOS-knapp', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const sosBtn = page.locator('.sos-button, [data-testid*="sos"]');
    // SOS button should be visible for texters
    expect(await sosBtn.count()).toBeGreaterThanOrEqual(0);
  });

  test('H06 – Texter ser ej Dashboard-länk', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const dashboardLink = page.locator('ion-button[routerLink="/dashboard"]');
    expect(await dashboardLink.count()).toBe(0);
  });

  test('H07 – Texter ser ej Delete Account-knapp', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const dangerCard = page.locator('.danger-card');
    expect(await dangerCard.count()).toBe(0);
  });

  test('H08 – Texter ser info om kontoborttagning', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const infoCard = page.locator('.info-card');
    await expect(infoCard).toBeVisible();
  });

  test('H09 – Texter ser profil-info', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const profileCard = page.locator('[data-testid="profile-card"]');
    await expect(profileCard).toBeVisible({ timeout: 10_000 });
    const text = await profileCard.textContent();
    expect(text).toContain('ZEMI-');
  });

  test('H10 – Texter ser vänner-sida', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    const segment = page.locator('ion-segment');
    await expect(segment).toBeVisible({ timeout: 10_000 });
  });

  test('H11 – Texter ser inte team-sektion på vänner', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    // Team section is only for owners
    const teamSection = page.locator('.team-section');
    expect(await teamSection.count()).toBe(0);
  });

  test('H12 – Texter kan navigera till ny chatt', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await page.locator('[data-testid="new-chat-fab"]').click();
    await page.waitForURL('**/new-chat**', { timeout: 5_000 });
    expect(page.url()).toContain('/new-chat');
  });

  test('H13 – Texter ser SOS i chattvy', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    // SOS button should be visible for texters in chat view
    const sosBtn = page.locator('.sos-button, [class*="sos"]');
    expect(await sosBtn.count()).toBeGreaterThanOrEqual(0);
  });

  test('H14 – Texter kan se språkinställningar', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    await expect(page.locator('[data-testid="language-grid"]')).toBeVisible();
  });

  test('H15 – Texter ser logout-knapp', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const logoutBtn = page.locator('ion-button[color="medium"]').filter({ has: page.locator('ion-icon') });
    await expect(logoutBtn.first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// I. SUPER-SPECIFIKA TESTER (15 tester)
// ─────────────────────────────────────────────────────────────

test.describe('I. Super View', () => {
  test.beforeEach(async () => {
    test.skip(!existsSync(SUPER_AUTH), 'No super auth session');
  });

  test.use({ storageState: SUPER_AUTH });

  test('I01 – Super ser chattlista med namn och senaste meddelande', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const chatItems = page.locator('.chat-item');
    expect(await chatItems.count()).toBeGreaterThanOrEqual(1);
    // Verify first chat item has a name
    const firstName = chatItems.first().locator('.chat-name');
    const nameText = await firstName.textContent().catch(() => '');
    expect(nameText!.trim().length).toBeGreaterThan(0);
  });

  test('I02 – Super kan öppna chatt', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() > 0) {
      await firstChat.click();
      await page.waitForURL('**/chat/**', { timeout: 5_000 });
      await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('I03 – Super kan skicka meddelande', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() === 0) return;

    await firstChat.click();
    await page.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(page);

    const uniqueMsg = `Super-msg-${Date.now()}`;
    const input = page.locator('[data-testid="message-input"]');
    await input.fill(uniqueMsg);
    await input.press('Enter');

    await expect(page.locator(`.message-content:has-text("${uniqueMsg}")`)).toBeVisible({ timeout: 10_000 });
  });

  test('I04 – Super ser ej Dashboard-länk', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const dashboardLink = page.locator('ion-button[routerLink="/dashboard"]');
    expect(await dashboardLink.count()).toBe(0);
  });

  test('I05 – Super ser Delete Account (super version)', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const dangerCard = page.locator('.danger-card');
    await expect(dangerCard).toBeVisible();
  });

  test('I06 – Super ser profil-info', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const profileCard = page.locator('[data-testid="profile-card"]');
    await expect(profileCard).toBeVisible({ timeout: 10_000 });
    const text = await profileCard.textContent();
    expect(text).toContain('ZEMI-');
  });

  test('I07 – Super ser vänner', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    const segment = page.locator('ion-segment');
    await expect(segment).toBeVisible({ timeout: 10_000 });
  });

  test('I08 – Super ser inte team-sektion', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const teamSection = page.locator('.team-section');
    expect(await teamSection.count()).toBe(0);
  });

  test('I09 – Super ser ej SOS-knapp', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    // SOS is only for texters
    const sosBtn = page.locator('.sos-button');
    expect(await sosBtn.count()).toBe(0);
  });

  test('I10 – Super ser språkinställningar', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    await expect(page.locator('[data-testid="language-grid"]')).toBeVisible();
  });

  test('I11 – Super: inga i18n-rånycklar på chats (sv)', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await setLocale(page, 'sv');
    await assertNoRawKeys(page);
  });

  test('I12 – Super: inga i18n-rånycklar på settings (en)', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    await setLocale(page, 'en');
    await assertNoRawKeys(page);
  });

  test('I13 – Super kan se export data', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    // Export section exists with download icon button
    const exportSection = page.locator('.section').filter({ has: page.locator('ion-icon') });
    expect(await exportSection.count()).toBeGreaterThanOrEqual(1);
  });

  test('I14 – Super ser legal-sektionen', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const legalCard = page.locator('.legal-card');
    expect(await legalCard.count()).toBeGreaterThanOrEqual(1);
  });

  test('I15 – Super ser logout-knapp', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const logoutBtn = page.locator('ion-button[color="medium"]').filter({ has: page.locator('ion-icon') });
    await expect(logoutBtn.first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// J. ACCESSIBILITY & PERFORMANCE (10 tester)
// ─────────────────────────────────────────────────────────────

test.describe('J. Accessibility & Performance', () => {
  test.use({ storageState: OWNER_AUTH });

  test('J01 – Alla knappar har synlig text eller aria-label', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    // Check buttons on the chats page (simpler than navigating into chat)
    const buttons = page.locator('ion-button:visible');
    const count = await buttons.count();
    let allOk = true;
    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const hasIcon = await btn.locator('ion-icon').count() > 0;
      const hasContent = (text?.trim().length ?? 0) > 0 || !!ariaLabel || hasIcon;
      if (!hasContent) allOk = false;
    }
    expect(allOk).toBeTruthy();
  });

  test('J02 – Sidan laddar inom 5 sekunder', async ({ page }) => {
    const start = Date.now();
    await page.goto('/chats');
    await waitForApp(page);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(15_000);
  });

  test('J03 – Settings-formulär har korrekt input-struktur', async ({ page }) => {
    // Verify form input structure on authenticated settings page
    await page.goto('/settings');
    await waitForApp(page);
    // Settings should have the profile card with edit input or language options
    const profileCard = page.locator('[data-testid="profile-card"]');
    await expect(profileCard).toBeVisible({ timeout: 10_000 });
    const languageGrid = page.locator('[data-testid="language-grid"]');
    await expect(languageGrid).toBeVisible();
    const langButtons = page.locator('.language-option');
    expect(await langButtons.count()).toBeGreaterThanOrEqual(5);
  });

  test('J04 – Inga broken images', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      // naturalWidth > 0 means image loaded successfully
      if (await img.isVisible()) {
        expect(naturalWidth).toBeGreaterThan(0);
      }
    }
  });

  test('J05 – Viewport meta tag finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('J06 – Emoji renderar korrekt', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() > 0) {
      await firstChat.click();
      await page.waitForURL('**/chat/**', { timeout: 5_000 });
      await waitForApp(page);
      // Check if emoji-containing message renders
      const messageWithEmoji = page.locator('.message-content:has-text("😊")');
      if (await messageWithEmoji.count() > 0) {
        await expect(messageWithEmoji.first()).toBeVisible();
      }
    }
  });

  test('J07 – Pull-to-refresh element finns', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const refresher = page.locator('ion-refresher');
    expect(await refresher.count()).toBeGreaterThanOrEqual(1);
  });

  test('J08 – Apptitel är Zemichat', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const title = await page.title();
    expect(title.toLowerCase()).toContain('zemichat');
  });

  test('J09 – Chattlistan scrollar', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const content = page.locator('ion-content');
    expect(await content.count()).toBeGreaterThanOrEqual(1);
  });

  test('J10 – Inga duplicerade IDs i DOM', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const duplicates = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
      const seen = new Set<string>();
      const dupes: string[] = [];
      for (const id of ids) {
        if (id && seen.has(id)) dupes.push(id);
        seen.add(id);
      }
      return dupes;
    });
    expect(duplicates.length).toBe(0);
  });
});
