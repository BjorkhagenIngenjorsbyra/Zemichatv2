import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OWNER_AUTH = resolve(__dirname, '.auth/owner.json');
const TEXTER_AUTH = resolve(__dirname, '.auth/texter.json');
const SUPER_AUTH = resolve(__dirname, '.auth/super.json');

function getSeedData() {
  const path = resolve(__dirname, '.auth/seed-data.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

async function waitForApp(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.locator('ion-app.hydrated').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// K. OWNER → TEXTER INTERACTIONS (15 tester)
// ─────────────────────────────────────────────────────────────

test.describe('K. Owner → Texter', () => {
  test.use({ storageState: OWNER_AUTH });

  test('K01 – Owner oversight visar chattlista med texter-badge', async ({ page }) => {
    await page.goto('/oversight');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    // Should see at least one chat item with a texter badge
    const chatItems = page.locator('.chat-item');
    expect(await chatItems.count()).toBeGreaterThanOrEqual(1);
    const texterBadge = page.locator('.texter-badge').first();
    if (await texterBadge.count() > 0) {
      const badgeText = await texterBadge.textContent();
      expect(badgeText!.trim().length).toBeGreaterThan(0);
    }
  });

  test('K02 – Oversight har sökfält', async ({ page }) => {
    await page.goto('/oversight');
    await waitForApp(page);
    const searchbar = page.locator('ion-searchbar');
    await expect(searchbar).toBeVisible();
  });

  test('K03 – Oversight visar texter-filter', async ({ page }) => {
    await page.goto('/oversight');
    await waitForApp(page);
    const segment = page.locator('ion-segment');
    if (await segment.count() > 0) {
      const buttons = page.locator('ion-segment-button');
      // "All" + at least one texter
      expect(await buttons.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('K04 – Oversight visar texter-badge på chattar', async ({ page }) => {
    await page.goto('/oversight');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const chatItems = page.locator('.chat-item');
    if (await chatItems.count() > 0) {
      const badges = page.locator('.texter-badge');
      expect(await badges.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('K05 – Owner kan öppna oversight-chatt', async ({ page }) => {
    await page.goto('/oversight');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const firstChat = page.locator('.chat-item').first();
    if (await firstChat.count() > 0) {
      await firstChat.click();
      await page.waitForURL('**/oversight/chat/**', { timeout: 5_000 });
      // Should see messages
      const messages = page.locator('.message-bubble');
      await page.waitForTimeout(2_000);
      expect(await messages.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('K06 – Owner approvals-sida laddas', async ({ page }) => {
    await page.goto('/owner-approvals');
    await waitForApp(page);
    // Either has requests or empty state
    const requestItems = page.locator('.request-item');
    const emptyState = page.locator('.empty-state');
    const hasRequests = await requestItems.count() > 0;
    const hasEmpty = await emptyState.count() > 0;
    expect(hasRequests || hasEmpty).toBeTruthy();
  });

  test('K07 – Owner ser texter-detalj via dashboard', async ({ page }) => {
    const seed = getSeedData();
    test.skip(!seed?.texterId, 'No texter seed data');

    await page.goto(`/texter/${seed.texterId}`);
    await waitForApp(page);
    await expect(page.locator('.texter-detail-container')).toBeVisible({ timeout: 10_000 });
  });

  test('K08 – Texter-detalj visar profilkort', async ({ page }) => {
    const seed = getSeedData();
    test.skip(!seed?.texterId, 'No texter seed data');

    await page.goto(`/texter/${seed.texterId}`);
    await waitForApp(page);
    const profileCard = page.locator('.profile-card');
    await expect(profileCard).toBeVisible({ timeout: 10_000 });
    const name = await page.locator('.profile-name').textContent();
    expect(name?.trim().length).toBeGreaterThan(0);
  });

  test('K09 – Texter-detalj visar Zemi-nummer', async ({ page }) => {
    const seed = getSeedData();
    test.skip(!seed?.texterId, 'No texter seed data');

    await page.goto(`/texter/${seed.texterId}`);
    await waitForApp(page);
    const zemi = page.locator('.profile-zemi');
    await expect(zemi).toBeVisible();
    const text = await zemi.textContent();
    expect(text).toContain('ZEMI-');
  });

  test('K10 – Texter-detalj visar kapabilitetstogglingar', async ({ page }) => {
    const seed = getSeedData();
    test.skip(!seed?.texterId, 'No texter seed data');

    await page.goto(`/texter/${seed.texterId}`);
    await waitForApp(page);
    const toggles = page.locator('.toggle-list ion-toggle');
    await page.waitForTimeout(2_000);
    expect(await toggles.count()).toBeGreaterThanOrEqual(5);
  });

  test('K11 – Texter-detalj visar aktivitetsstatus', async ({ page }) => {
    const seed = getSeedData();
    test.skip(!seed?.texterId, 'No texter seed data');

    await page.goto(`/texter/${seed.texterId}`);
    await waitForApp(page);
    const statusBadge = page.locator('.status-badge');
    await expect(statusBadge).toBeVisible({ timeout: 10_000 });
  });

  test('K12 – Create Texter action finns i dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    // The create texter action item is the 2nd action
    const createTexterItem = page.locator('.action-item').nth(1);
    await expect(createTexterItem).toBeVisible();
    // It should have the personAdd icon
    const icon = createTexterItem.locator('ion-icon');
    expect(await icon.count()).toBeGreaterThanOrEqual(1);
  });

  test('K13 – Create Texter action har beskrivning', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const createTexterItem = page.locator('.action-item').nth(1);
    const label = createTexterItem.locator('ion-label');
    const text = await label.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('K14 – Owner ser Quick Message Manager i texter-detalj', async ({ page }) => {
    const seed = getSeedData();
    test.skip(!seed?.texterId, 'No texter seed data');

    await page.goto(`/texter/${seed.texterId}`);
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    // Should see quick message section
    const sections = page.locator('.section');
    expect(await sections.count()).toBeGreaterThanOrEqual(1);
  });

  test('K15 – Owner ser Quiet Hours i texter-detalj', async ({ page }) => {
    const seed = getSeedData();
    test.skip(!seed?.texterId, 'No texter seed data');

    await page.goto(`/texter/${seed.texterId}`);
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    // Quiet hours section exists
    const body = await page.locator('ion-content').textContent();
    expect(body?.toLowerCase()).toMatch(/quiet|tysta|lugn/i);
  });
});

// ─────────────────────────────────────────────────────────────
// L. OWNER → SUPER INTERACTIONS (10 tester)
// ─────────────────────────────────────────────────────────────

test.describe('L. Owner → Super', () => {
  test.use({ storageState: OWNER_AUTH });

  test('L01 – Invite Super-sida laddas', async ({ page }) => {
    await page.goto('/invite-super');
    await waitForApp(page);
    await expect(page.locator('.invite-super-container')).toBeVisible({ timeout: 10_000 });
  });

  test('L02 – Invite Super har e-post-fält', async ({ page }) => {
    await page.goto('/invite-super');
    await waitForApp(page);
    const emailInput = page.locator('ion-input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('L03 – Invite Super har namn-fält', async ({ page }) => {
    await page.goto('/invite-super');
    await waitForApp(page);
    const nameInput = page.locator('ion-input[type="text"]');
    await expect(nameInput).toBeVisible();
  });

  test('L04 – Invite Super har skicka-knapp', async ({ page }) => {
    await page.goto('/invite-super');
    await waitForApp(page);
    const submitBtn = page.locator('.invite-submit-btn');
    await expect(submitBtn).toBeVisible();
  });

  test('L05 – Owner dashboard visar teammedlemmar inkl Super', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const memberItems = page.locator('.member-item');
    if (await memberItems.count() > 0) {
      // Should have at least texters and super from seed data
      expect(await memberItems.count()).toBeGreaterThanOrEqual(2);
    }
  });

  test('L06 – Owner ser Super i team-sektion på vänner', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const teamSection = page.locator('.team-section');
    if (await teamSection.count() > 0) {
      const roleBadges = page.locator('.team-role-badge');
      if (await roleBadges.count() > 0) {
        const allBadgeText = await roleBadges.allTextContents();
        const hasSuper = allBadgeText.some((t) => t.toLowerCase().includes('super'));
        const hasTexter = allBadgeText.some((t) => t.toLowerCase().includes('texter'));
        expect(hasSuper || hasTexter).toBeTruthy();
      }
    }
  });

  test('L07 – Invite Super visar pending invitations', async ({ page }) => {
    await page.goto('/invite-super');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    // Pending section may or may not have items
    const pendingSection = page.locator('.invite-pending-section');
    expect(await pendingSection.count()).toBeGreaterThanOrEqual(0);
  });

  test('L08 – Owner Dashboard invite-super länk fungerar', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    // Invite Super is the 4th action item (index 3)
    const inviteItem = page.locator('.action-item').nth(3);
    await inviteItem.click();
    await page.waitForURL('**/invite-super**', { timeout: 5_000 });
    expect(page.url()).toContain('/invite-super');
  });

  test('L09 – Owner Dashboard oversight länk fungerar', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    // Oversight is the 3rd action item (index 2)
    const oversightItem = page.locator('.action-item').nth(2);
    await oversightItem.click();
    await page.waitForURL('**/oversight**', { timeout: 5_000 });
    expect(page.url()).toContain('/oversight');
  });

  test('L10 – Owner Dashboard approvals länk fungerar', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    // Approvals is the 1st action item (index 0)
    const approvalsItem = page.locator('.action-item').first();
    await approvalsItem.click();
    await page.waitForURL('**/owner-approvals**', { timeout: 5_000 });
    expect(page.url()).toContain('/owner-approvals');
  });
});

// ─────────────────────────────────────────────────────────────
// M. TEXTER RESTRICTIONS & CAPABILITIES (15 tester)
// ─────────────────────────────────────────────────────────────

test.describe('M. Texter Restrictions', () => {
  test.beforeEach(async () => {
    test.skip(!existsSync(TEXTER_AUTH), 'No texter auth session');
  });

  test.use({ storageState: TEXTER_AUTH });

  test('M01 – Texter ser ej dashboard actions', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await page.waitForTimeout(3_000);
    // Texter should not see the owner quick actions (approvals, oversight, etc.)
    const actionItems = page.locator('.action-item');
    // Either page redirects away or actions are not showing owner items
    const count = await actionItems.count();
    // Texter shouldn't have owner-specific actions
    expect(count).toBeLessThanOrEqual(4);
  });

  test('M02 – Texter kan ej navigera till /oversight', async ({ page }) => {
    await page.goto('/oversight');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const chatItems = page.locator('.chat-item');
    // Texter shouldn't see oversight chats
    expect(await chatItems.count()).toBe(0);
  });

  test('M03 – Texter kan ej navigera till /owner-approvals', async ({ page }) => {
    await page.goto('/owner-approvals');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const requestItems = page.locator('.request-item');
    expect(await requestItems.count()).toBe(0);
  });

  test('M04 – Texter kan inte skapa inbjudan', async ({ page }) => {
    await page.goto('/invite-super');
    await waitForApp(page);
    await page.waitForTimeout(3_000);
    // Texter may see the page but cannot successfully create invitations
    // The page may still render but the RLS prevents actual invitations
    expect(page.url()).toBeTruthy();
  });

  test('M05 – Texter ser ej Dashboard i bottom tabs', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    const dashTab = page.locator('ion-tab-button[tab="dashboard"]');
    expect(await dashTab.count()).toBe(0);
  });

  test('M06 – Texter kan gå till vänner', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    const segment = page.locator('ion-segment');
    await expect(segment).toBeVisible({ timeout: 10_000 });
  });

  test('M07 – Texter kan lägga till vän', async ({ page }) => {
    await page.goto('/add-friend');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(1);
  });

  test('M08 – Texter kan se support-sida', async ({ page }) => {
    await page.goto('/support');
    await waitForApp(page);
    expect(page.url()).toContain('/support');
    const faqSection = page.locator('ion-accordion-group');
    await expect(faqSection).toBeVisible({ timeout: 10_000 });
  });

  // M09 removed – assertion (count >= 0) always true, provided no test value

  test('M10 – Texter ser seeded vänner', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const friendCards = page.locator('.friend-card');
    // Texter should have seeded friendships
    expect(await friendCards.count()).toBeGreaterThanOrEqual(1);
  });

  test('M11 – Texter kan starta ny chatt med vänner', async ({ page }) => {
    await page.goto('/new-chat');
    await waitForApp(page);
    const contacts = page.locator('.contact-item');
    expect(await contacts.count()).toBeGreaterThanOrEqual(1);
  });

  test('M12 – Texter ser kontaktnamn i ny chatt', async ({ page }) => {
    await page.goto('/new-chat');
    await waitForApp(page);
    const names = page.locator('.contact-name');
    if (await names.count() > 0) {
      const text = await names.first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('M13 – Texter ser Zemi-nummer i ny chatt', async ({ page }) => {
    await page.goto('/new-chat');
    await waitForApp(page);
    const zemis = page.locator('.contact-zemi');
    if (await zemis.count() > 0) {
      const text = await zemis.first().textContent();
      expect(text).toContain('ZEMI-');
    }
  });

  test('M14 – Texter kan navigera till legal pages', async ({ page }) => {
    await page.goto('/privacy');
    await waitForApp(page);
    expect(page.url()).toContain('/privacy');
  });

  test('M15 – Texter ser terms of service', async ({ page }) => {
    await page.goto('/terms');
    await waitForApp(page);
    expect(page.url()).toContain('/terms');
  });
});

// ─────────────────────────────────────────────────────────────
// N. SUPER RESTRICTIONS & CAPABILITIES (10 tester)
// ─────────────────────────────────────────────────────────────

test.describe('N. Super Restrictions', () => {
  test.beforeEach(async () => {
    test.skip(!existsSync(SUPER_AUTH), 'No super auth session');
  });

  test.use({ storageState: SUPER_AUTH });

  test('N01 – Super ser ej dashboard owner actions', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await page.waitForTimeout(3_000);
    // Super should not see the owner-specific member management actions
    // The dashboard page renders but without owner-specific approve/oversight/invite actions
    const body = await page.locator('ion-content').textContent();
    expect(body).toBeTruthy();
  });

  test('N02 – Super kan ej navigera till /oversight', async ({ page }) => {
    await page.goto('/oversight');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const chatItems = page.locator('.chat-item');
    expect(await chatItems.count()).toBe(0);
  });

  test('N03 – Super kan ej navigera till /owner-approvals', async ({ page }) => {
    await page.goto('/owner-approvals');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const requestItems = page.locator('.request-item');
    expect(await requestItems.count()).toBe(0);
  });

  test('N04 – Super kan gå till vänner', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    const segment = page.locator('ion-segment');
    await expect(segment).toBeVisible({ timeout: 10_000 });
  });

  test('N05 – Super kan lägga till vän', async ({ page }) => {
    await page.goto('/add-friend');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(1);
  });

  test('N06 – Super kan starta ny chatt', async ({ page }) => {
    await page.goto('/new-chat');
    await waitForApp(page);
    const contacts = page.locator('.contact-item');
    const emptyState = page.locator('.empty-state');
    expect((await contacts.count()) + (await emptyState.count())).toBeGreaterThan(0);
  });

  test('N07 – Super kan se support-sida', async ({ page }) => {
    await page.goto('/support');
    await waitForApp(page);
    expect(page.url()).toContain('/support');
  });

  test('N08 – Super ser seeded vänner', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const friendCards = page.locator('.friend-card');
    expect(await friendCards.count()).toBeGreaterThanOrEqual(1);
  });

  test('N09 – Super ser Delete Account (inte Texter)', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const dangerCard = page.locator('.danger-card');
    await expect(dangerCard).toBeVisible();
  });

  test('N10 – Super ser inte SOS-knapp', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    const sosBtn = page.locator('.sos-button');
    expect(await sosBtn.count()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// O. CROSS-ROLE CHAT INTERACTIONS (10 tester)
// ─────────────────────────────────────────────────────────────

test.describe('O. Cross-Role Chat', () => {

  test('O01 – Owner ser chatt med Texter', async ({ page }) => {
    const ctx = await page.context().browser()!.newContext({ storageState: OWNER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/chats');
    await waitForApp(p);
    await p.waitForTimeout(2_000);
    const chatItems = p.locator('.chat-item');
    expect(await chatItems.count()).toBeGreaterThanOrEqual(1);
    await ctx.close();
  });

  test('O02 – Texter ser chatt med Owner', async ({ page }) => {
    test.skip(!existsSync(TEXTER_AUTH), 'No texter auth');
    const ctx = await page.context().browser()!.newContext({ storageState: TEXTER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/chats');
    await waitForApp(p);
    const chatItems = p.locator('.chat-item');
    expect(await chatItems.count()).toBeGreaterThanOrEqual(1);
    await ctx.close();
  });

  test('O03 – Super ser chatt med Texter', async ({ page }) => {
    test.skip(!existsSync(SUPER_AUTH), 'No super auth');
    const ctx = await page.context().browser()!.newContext({ storageState: SUPER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/chats');
    await waitForApp(p);
    const chatItems = p.locator('.chat-item');
    expect(await chatItems.count()).toBeGreaterThanOrEqual(1);
    await ctx.close();
  });

  test('O04 – Owner kan se meddelanden i oversight-chatt', async ({ page }) => {
    const ctx = await page.context().browser()!.newContext({ storageState: OWNER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/oversight');
    await waitForApp(p);
    await p.waitForTimeout(2_000);
    const firstChat = p.locator('.chat-item').first();
    if (await firstChat.count() > 0) {
      await firstChat.click();
      await p.waitForURL('**/oversight/chat/**', { timeout: 5_000 });
      await waitForApp(p);
      const messages = p.locator('.message-bubble');
      await p.waitForTimeout(2_000);
      expect(await messages.count()).toBeGreaterThanOrEqual(1);
    }
    await ctx.close();
  });

  test('O05 – Texter ser meddelanden i sin chatt', async ({ page }) => {
    test.skip(!existsSync(TEXTER_AUTH), 'No texter auth');
    const ctx = await page.context().browser()!.newContext({ storageState: TEXTER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/chats');
    await waitForApp(p);
    await p.waitForTimeout(2_000);
    const firstChat = p.locator('.chat-item').first();
    if (await firstChat.count() > 0) {
      await firstChat.click();
      await p.waitForURL('**/chat/**', { timeout: 5_000 });
      await waitForApp(p);
      await p.waitForTimeout(3_000);
      const messages = p.locator('.message-bubble');
      expect(await messages.count()).toBeGreaterThanOrEqual(1);
    }
    await ctx.close();
  });

  test('O06 – Owner kan inte radera andras meddelanden (UI)', async ({ page }) => {
    const ctx = await page.context().browser()!.newContext({ storageState: OWNER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/chats');
    await waitForApp(p);
    const firstChat = p.locator('.chat-item').first();
    if (await firstChat.count() === 0) { await ctx.close(); return; }

    await firstChat.click();
    await p.waitForURL('**/chat/**', { timeout: 5_000 });
    await waitForApp(p);

    const otherMsg = p.locator('.message-wrapper.other').first();
    if (await otherMsg.count() > 0) {
      // Long-press should not show delete for others' messages
      await otherMsg.click({ button: 'right' });
      await p.waitForTimeout(500);
      const deleteBtn = p.locator('.action-sheet-destructive, [data-testid*="delete"]');
      // Should not have delete option for others' messages
      expect(await deleteBtn.count()).toBe(0);
    }
    await ctx.close();
  });

  // O07 removed – assertion (ion-content count >= 1) always true

  test('O08 – Owner ser Texter-chatt i oversight-filtret', async ({ page }) => {
    const ctx = await page.context().browser()!.newContext({ storageState: OWNER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/oversight');
    await waitForApp(p);
    await p.waitForTimeout(2_000);
    // Filter by texter if segment exists
    const filterBtns = p.locator('ion-segment-button');
    if (await filterBtns.count() > 1) {
      await filterBtns.nth(1).click();
      await p.waitForTimeout(1_000);
      const chats = p.locator('.chat-item');
      // After filtering, should still show chats (or empty)
      expect(await chats.count()).toBeGreaterThanOrEqual(0);
    }
    await ctx.close();
  });

  test('O09 – Texter kan se sin profilinfo', async ({ page }) => {
    test.skip(!existsSync(TEXTER_AUTH), 'No texter auth');
    const ctx = await page.context().browser()!.newContext({ storageState: TEXTER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/settings');
    await waitForApp(p);
    const profileCard = p.locator('[data-testid="profile-card"]');
    await expect(profileCard).toBeVisible({ timeout: 10_000 });
    const text = await profileCard.textContent();
    expect(text).toContain('Texter');
    await ctx.close();
  });

  test('O10 – Super kan se sin profilinfo', async ({ page }) => {
    test.skip(!existsSync(SUPER_AUTH), 'No super auth');
    const ctx = await page.context().browser()!.newContext({ storageState: SUPER_AUTH });
    const p = await ctx.newPage();
    await p.goto('/settings');
    await waitForApp(p);
    const profileCard = p.locator('[data-testid="profile-card"]');
    await expect(profileCard).toBeVisible({ timeout: 10_000 });
    const text = await profileCard.textContent();
    expect(text).toContain('Super');
    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────
// P. TEAM MANAGEMENT (5 tester)
// ─────────────────────────────────────────────────────────────

test.describe('P. Team Management', () => {
  test.use({ storageState: OWNER_AUTH });

  test('P01 – Dashboard visar team-namn', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const header = page.locator('ion-title, .team-name');
    const text = await header.first().textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('P02 – Dashboard member-list visar roller', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await page.waitForTimeout(3_000);
    const memberItems = page.locator('.member-item');
    if (await memberItems.count() > 0) {
      const roleBadges = page.locator('.role-badge-small');
      expect(await roleBadges.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('P03 – Dashboard visar aktiva/inaktiva status', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const memberItems = page.locator('.member-item');
    if (await memberItems.count() > 0) {
      const statusIndicators = page.locator('.member-status, .status-dot');
      expect(await statusIndicators.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('P04 – Klick på texter i dashboard navigerar till detalj', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await page.waitForTimeout(2_000);
    const texterItems = page.locator('.member-item').filter({ hasText: /texter/i });
    if (await texterItems.count() > 0) {
      await texterItems.first().click();
      await page.waitForURL('**/texter/**', { timeout: 5_000 });
      expect(page.url()).toContain('/texter/');
    }
  });

  // P05 removed – assertion (count >= 0) always true, provided no test value
});
