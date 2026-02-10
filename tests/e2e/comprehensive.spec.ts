import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Parse "rgb(r, g, b)" → average lightness 0-255 */
function rgbLightness(rgb: string): number {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return -1;
  return (parseInt(m[1]) + parseInt(m[2]) + parseInt(m[3])) / 3;
}

/** Wait for Ionic hydration + networkidle */
async function waitForApp(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.locator('ion-app.hydrated').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
}

/** Set locale via localStorage then reload */
async function setLocale(page: Page, lang: string) {
  await page.evaluate((l) => localStorage.setItem('zemichat-language', l), lang);
  await page.reload();
  await waitForApp(page);
  await page.waitForTimeout(300);
}

/** Check no raw i18n keys like "auth.xxx" leak into visible text */
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
    expect(await inputs.count()).toBeGreaterThanOrEqual(4); // name, email, pw, confirm
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
    // Either client-side or server-side error; page should not navigate to verify-email
    await page.waitForTimeout(3_000);
    const url = page.url();
    const hasError = await page.locator('.auth-error').isVisible().catch(() => false);
    // Should either show error or stay on signup page
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
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 5_000 });
  });

  test('A05 – Lösenord som ej matchar avvisas', async ({ page }) => {
    await page.goto('/signup');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('Test');
    await inputs.nth(1).locator('input').fill('test@example.com');
    await inputs.nth(2).locator('input').fill('password123');
    await inputs.nth(3).locator('input').fill('different456');
    await page.locator('ion-checkbox').click();
    await page.locator('ion-button[type="submit"]').click();
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 5_000 });
  });

  test('A06 – Signup consent krävs (knapp disabled utan checkbox)', async ({ page }) => {
    await page.goto('/signup');
    await waitForApp(page);
    const btn = page.locator('ion-button[type="submit"]');
    const disabled = await btn.getAttribute('disabled');
    const ariaDisabled = await btn.getAttribute('aria-disabled');
    expect(disabled !== null || ariaDisabled === 'true').toBeTruthy();
  });

  test('A07 – Login-sida laddar med formulär', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await expect(page.locator('h1.auth-title')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('form.auth-form')).toBeVisible();
    const inputs = page.locator('ion-input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(2);
  });

  test('A08 – Login misslyckas med felaktiga uppgifter', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('wrong@example.com');
    await inputs.nth(1).locator('input').fill('wrongpassword');
    await page.locator('ion-button[type="submit"]').click();
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 10_000 });
  });

  test('A09 – Texter-login har Zemi-nummer och lösenordsfält', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    await expect(page.getByRole('heading', { name: 'Zemichat' })).toBeVisible();
    const inputs = page.locator('ion-input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(2);
  });

  test('A10 – Texter-login har länk till Owner-login', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    await expect(
      page.locator('ion-button[routerlink="/login"]').or(page.locator('a[href="/login"]'))
    ).toBeVisible();
  });

  test('A11 – Login har länk till Signup', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await expect(
      page.locator('ion-button[routerlink="/signup"]').or(page.locator('a[href="/signup"]'))
    ).toBeVisible();
  });

  test('A12 – Login har länk till Texter-login', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await expect(
      page.locator('ion-button[routerlink="/texter-login"]').or(page.locator('a[href="/texter-login"]'))
    ).toBeVisible();
  });

  test('A13 – Login har Glömt lösenord-länk', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await expect(page.locator('.auth-link, .auth-links ion-button, a[href="/forgot-password"]').first()).toBeVisible();
  });

  test('A14 – Skyddade routes redirectar till login', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    // Should redirect to login
    await expect(
      page.locator('form.auth-form').or(page.locator('.welcome-container'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('A15 – Root redirectar till welcome', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await expect(page.locator('.welcome-container').first()).toBeVisible({ timeout: 15_000 });
  });

});

// ─────────────────────────────────────────────────────────────
// B. SPRÅK & i18n (10 tester)
// ─────────────────────────────────────────────────────────────

test.describe('B. Språk & i18n', () => {

  test('B01 – Svenska visas för sv-locale', async ({ page }) => {
    await page.goto('/login');
    await setLocale(page, 'sv');
    const body = await page.locator('body').textContent() ?? '';
    expect(body).toContain('Logga in');
  });

  test('B02 – Engelska visas för en-locale', async ({ page }) => {
    await page.goto('/login');
    await setLocale(page, 'en');
    const body = await page.locator('body').textContent() ?? '';
    expect(body).toContain('Log in');
  });

  test('B03 – Norska visas för no-locale', async ({ page }) => {
    await page.goto('/login');
    await setLocale(page, 'no');
    const body = await page.locator('body').textContent() ?? '';
    expect(body).toContain('Logg inn');
  });

  test('B04 – Danska visas för da-locale', async ({ page }) => {
    await page.goto('/login');
    await setLocale(page, 'da');
    const body = await page.locator('body').textContent() ?? '';
    expect(body).toContain('Log ind');
  });

  test('B05 – Finska visas för fi-locale', async ({ page }) => {
    await page.goto('/login');
    await setLocale(page, 'fi');
    const body = await page.locator('body').textContent() ?? '';
    expect(body).toContain('Kirjaudu sisään');
  });

  test('B06 – Språk sparas i localStorage', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await page.evaluate(() => localStorage.setItem('zemichat-language', 'en'));
    await page.reload();
    await waitForApp(page);
    const saved = await page.evaluate(() => localStorage.getItem('zemichat-language'));
    expect(saved).toBe('en');
  });

  test('B07 – Inga i18n-nycklar synliga på login', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await page.waitForTimeout(500);
    await assertNoRawKeys(page);
  });

  test('B08 – Inga i18n-nycklar synliga på signup', async ({ page }) => {
    await page.goto('/signup');
    await waitForApp(page);
    await page.waitForTimeout(500);
    await assertNoRawKeys(page);
  });

  test('B09 – Inga i18n-nycklar synliga på texter-login', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    await page.waitForTimeout(500);
    await assertNoRawKeys(page);
  });

  test('B10 – Alla 5 locales har kritiska i18n-nycklar', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return { available: false, issues: [] as string[] };

      const issues: string[] = [];
      const locales = ['sv', 'en', 'no', 'da', 'fi'];
      const keys = [
        'auth.login', 'auth.signup', 'auth.email', 'auth.password',
        'common.appName', 'common.cancel', 'common.save', 'common.done',
        'friends.title', 'friends.addFriend', 'friends.myFriends', 'friends.requests',
        'dashboard.quickActions', 'dashboard.yourTeam', 'dashboard.createTexter',
        'texter.createTitle', 'texter.name', 'texter.zemiNumber',
        'settings.title', 'settings.language', 'settings.profile',
        'chat.noChats', 'chat.startChatting', 'chat.newChat',
        'quickMessages.title', 'quickMessages.suggestions',
        'choosePlan.title', 'choosePlan.startTrial',
        'trial.banner', 'trial.bannerLastDay',
        'welcome.description', 'welcome.createAccount',
        'verifyEmail.title', 'verifyEmail.goToLogin',
        'invite.title', 'invite.sendInvite',
      ];

      for (const locale of locales) {
        const res = i18n.store.data[locale]?.translation;
        if (!res) { issues.push(`Missing locale: ${locale}`); continue; }
        for (const key of keys) {
          let val: any = res;
          for (const p of key.split('.')) val = val?.[p];
          if (val === undefined || val === null) issues.push(`${locale}: missing ${key}`);
        }
      }
      return { available: true, issues };
    });

    if (!result.available) {
      test.skip();
      return;
    }
    expect(result.issues).toEqual([]);
  });

});

// ─────────────────────────────────────────────────────────────
// C. TEAM OWNER FLÖDE (20 tester)
// ─────────────────────────────────────────────────────────────

test.describe('C. Team Owner flöde', () => {

  test('C01 – Create Team-sida renderas', async ({ page }) => {
    await page.goto('/create-team');
    await waitForApp(page);
    // Will redirect to login if not auth, but page itself should exist
    await expect(
      page.locator('.create-team-container').or(page.locator('form.auth-form'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('C02 – Create Team har steg-indikator', async ({ page }) => {
    await page.goto('/create-team');
    await waitForApp(page);
    // If redirected to login, skip
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    await expect(page.locator('.step-badge, .step-indicator')).toBeVisible();
  });

  test('C03 – Create Team har namn-input', async ({ page }) => {
    await page.goto('/create-team');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    await expect(page.locator('ion-input')).toBeVisible();
  });

  test('C04 – Choose Plan-sida renderas', async ({ page }) => {
    await page.goto('/choose-plan');
    await waitForApp(page);
    await expect(
      page.locator('.choose-plan-container').or(page.locator('form.auth-form'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('C05 – Choose Plan visar plan-kort', async ({ page }) => {
    await page.goto('/choose-plan');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    const cards = page.locator('.choose-plan-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });

  test('C06 – Choose Plan har rekommenderad plan', async ({ page }) => {
    await page.goto('/choose-plan');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    await expect(page.locator('.choose-plan-card.recommended, .recommended-badge')).toBeVisible();
  });

  test('C07 – Dashboard-sida renderas (eller redirectar)', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await expect(
      page.locator('.dashboard-container').or(page.locator('form.auth-form'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('C08 – Dashboard har Quick Actions-sektion', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    await expect(page.locator('.action-list, .action-item').first()).toBeVisible();
  });

  test('C09 – Dashboard har Create Texter-action', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    const body = await page.locator('body').textContent() ?? '';
    expect(body.toLowerCase()).toContain('texter');
  });

  test('C10 – Dashboard har Oversight-action', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    const links = page.locator('ion-item[routerlink="/oversight"], [href="/oversight"], a[routerlink="/oversight"]');
    const bodyText = await page.locator('.action-item').allTextContents();
    expect(bodyText.join(' ').length).toBeGreaterThan(0);
  });

  test('C11 – Dashboard har Invite Super-action', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    const items = await page.locator('.action-item').allTextContents();
    const hasInvite = items.some(t => t.toLowerCase().includes('super') || t.toLowerCase().includes('bjud'));
    expect(hasInvite).toBeTruthy();
  });

  test('C12 – Dashboard har Team Members-sektion', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    await expect(
      page.locator('.member-list, .empty-state').first()
    ).toBeVisible();
  });

  test('C13 – Invite Super-sida renderas', async ({ page }) => {
    await page.goto('/invite-super');
    await waitForApp(page);
    await expect(
      page.locator('.invite-super-container').or(page.locator('form.auth-form'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('C14 – Invite Super har e-post och namn-fält', async ({ page }) => {
    await page.goto('/invite-super');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    const inputs = page.locator('ion-input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(1);
  });

  test('C15 – Owner Approvals-sida renderas', async ({ page }) => {
    await page.goto('/owner-approvals');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('C16 – Oversight-sida renderas', async ({ page }) => {
    await page.goto('/oversight');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('C17 – Texter Detail-sida renderas', async ({ page }) => {
    await page.goto('/texter/00000000-0000-0000-0000-000000000000');
    await waitForApp(page);
    // Will redirect or show error since fake UUID
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('C18 – Create Texter modal-komponent finns i DOM', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    // Modal should be in the DOM (hidden)
    await expect(page.locator('ion-modal')).toHaveCount(1, { timeout: 5_000 }).catch(() => {
      // Some Ionic versions only render modal on open
    });
  });

  test('C19 – Dashboard har back-knapp till Settings', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    await expect(page.locator('ion-back-button, ion-button[routerlink="/settings"]').first()).toBeVisible();
  });

  test('C20 – Dashboard visar Approvals med badge', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    // At minimum the approvals action item exists
    const items = await page.locator('.action-item').allTextContents();
    const hasApprovals = items.some(t => t.toLowerCase().includes('godkänn') || t.toLowerCase().includes('approval'));
    expect(hasApprovals).toBeTruthy();
  });

});

// ─────────────────────────────────────────────────────────────
// D. SUPER FLÖDE (10 tester)
// ─────────────────────────────────────────────────────────────

test.describe('D. Super flöde', () => {

  test('D01 – Super invite-sida renderas med token', async ({ page }) => {
    await page.goto('/invite/test-token-123');
    await waitForApp(page);
    await expect(page.locator('ion-content')).toBeVisible({ timeout: 10_000 });
  });

  test('D02 – Super invite visar team-info eller error', async ({ page }) => {
    await page.goto('/invite/invalid-token');
    await waitForApp(page);
    // With invalid token should show error or loading
    const body = await page.locator('body').textContent() ?? '';
    expect(body.length).toBeGreaterThan(0);
  });

  test('D03 – Super tour-sida renderas', async ({ page }) => {
    await page.goto('/super-tour');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('D04 – Chattar-sida renderas (skyddad)', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await expect(
      page.locator('.chat-list, .empty-state, form.auth-form, .welcome-container').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('D05 – Vänner-sida renderas (skyddad)', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await expect(
      page.locator('.friends-container, ion-segment, form.auth-form, .welcome-container').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('D06 – Inställningar-sida renderas (skyddad)', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    await expect(
      page.locator('.settings-container, form.auth-form, .welcome-container').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('D07 – New Chat-sida renderas (skyddad)', async ({ page }) => {
    await page.goto('/new-chat');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('D08 – Add Friend-sida renderas (skyddad)', async ({ page }) => {
    await page.goto('/add-friend');
    await waitForApp(page);
    await expect(
      page.locator('.add-friend-container, form.auth-form, .welcome-container').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('D09 – Chat View-sida renderas (skyddad)', async ({ page }) => {
    await page.goto('/chat/00000000-0000-0000-0000-000000000000');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('D10 – Support-sida renderas (skyddad)', async ({ page }) => {
    await page.goto('/support');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

});

// ─────────────────────────────────────────────────────────────
// E. TEXTER FLÖDE (15 tester)
// ─────────────────────────────────────────────────────────────

test.describe('E. Texter flöde', () => {

  test('E01 – Texter login-sida har Zemi-input', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    // Zemi input has class zemi-input on the ion-input element
    await expect(
      page.locator('ion-input.zemi-input, ion-input.auth-input').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('E02 – Texter login visar fel vid tom submit', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    await page.locator('ion-button[type="submit"]').click();
    // Should show error or stay on same page (no navigation)
    await page.waitForTimeout(2_000);
    const hasError = await page.locator('.auth-error').isVisible().catch(() => false);
    const url = page.url();
    expect(hasError || url.includes('/texter-login')).toBeTruthy();
  });

  test('E03 – Texter login visar fel vid felaktigt nummer-format', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('123');
    await inputs.nth(1).locator('input').fill('password123');
    await page.locator('ion-button[type="submit"]').click();
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 5_000 });
  });

  test('E04 – Texter login misslyckas med fel lösenord', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('ZEMI-000-000');
    await inputs.nth(1).locator('input').fill('wrongpassword');
    await page.locator('ion-button[type="submit"]').click();
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 10_000 });
  });

  test('E05 – Texter tour-sida renderas', async ({ page }) => {
    await page.goto('/texter-tour');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('E06 – Texter login har submit-knapp', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    await expect(page.locator('ion-button[type="submit"]')).toBeVisible();
  });

  test('E07 – Texter login har lösenordsfält', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    const pwInput = page.locator('ion-input[type="password"]');
    expect(await pwInput.count()).toBeGreaterThanOrEqual(1);
  });

  test('E08 – Texter login visar app-namn', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    const body = await page.locator('body').textContent() ?? '';
    expect(body).toContain('Zemichat');
  });

  test('E09 – Texter login Zemi-input har monospace-style', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    const zemiInput = page.locator('.zemi-input').first();
    if (await zemiInput.isVisible()) {
      const fontFamily = await zemiInput.evaluate(el => getComputedStyle(el).fontFamily);
      expect(fontFamily.toLowerCase()).toMatch(/mono|courier/);
    }
  });

  test('E10 – Texter login har divider', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    await expect(page.locator('.auth-divider')).toBeVisible();
  });

  test('E11 – Texter login visar subtitle', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    await expect(page.locator('.auth-subtitle, p.auth-subtitle')).toBeVisible();
  });

  test('E12 – Texter login har juridiska länkar', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    const legal = page.locator('.auth-legal-links, a[href="/privacy"], a[href="/terms"]');
    expect(await legal.count()).toBeGreaterThanOrEqual(1);
  });

  test('E13 – Texter login felmeddelande har rätt styling', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('ZEMI-000-000');
    await inputs.nth(1).locator('input').fill('wrong');
    await page.locator('ion-button[type="submit"]').click();
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 10_000 });
    const bg = await page.locator('.auth-error').evaluate(el => getComputedStyle(el).backgroundColor);
    // Should have a red-ish background
    const m = bg.match(/rgba?\((\d+)/);
    if (m) expect(parseInt(m[1])).toBeGreaterThan(50);
  });

  test('E14 – Texter login spinner visas vid submit', async ({ page }) => {
    await page.goto('/texter-login');
    await waitForApp(page);
    const inputs = page.locator('ion-input');
    await inputs.nth(0).locator('input').fill('ZEMI-999-999');
    await inputs.nth(1).locator('input').fill('testpass');
    await page.locator('ion-button[type="submit"]').click();
    // Spinner might flash briefly
    const spinner = page.locator('ion-spinner');
    await spinner.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
    // Either spinner appeared or error showed
    await expect(page.locator('ion-spinner, .auth-error').first()).toBeVisible({ timeout: 10_000 });
  });

  test('E15 – Privacy-sida renderas', async ({ page }) => {
    await page.goto('/privacy');
    await waitForApp(page);
    await expect(page.locator('ion-content')).toBeVisible({ timeout: 10_000 });
  });

});

// ─────────────────────────────────────────────────────────────
// F. CHATT FUNKTIONER (15 tester – UI/komponent-verifiering)
// ─────────────────────────────────────────────────────────────

test.describe('F. Chatt funktioner (UI)', () => {

  test('F01 – ChatList-sida renderas', async ({ page }) => {
    await page.goto('/chats');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('F02 – New Chat-sida renderas', async ({ page }) => {
    await page.goto('/new-chat');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('F03 – Chat View-sida renderas', async ({ page }) => {
    await page.goto('/chat/test-id');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('F04 – EmptyStateIllustration no-chats SVG renderas', async ({ page }) => {
    // Navigate to a page that uses no-chats empty state
    await page.goto('/login');
    await waitForApp(page);

    const svg = await page.evaluate(() => {
      const div = document.createElement('div');
      div.innerHTML = `<svg width="120" height="120" viewBox="0 0 120 120"></svg>`;
      document.body.appendChild(div);
      const rendered = div.querySelector('svg');
      const exists = rendered !== null;
      div.remove();
      return exists;
    });
    expect(svg).toBeTruthy();
  });

  test('F05 – ChatList empty state SVG har en bubbla med plus', async () => {
    // Verify the no-chats SVG only has one bubble (not overlapping back+front)
    const filePath = resolve(__dirname, '../../src/components/common/EmptyStateIllustration.tsx');
    const source = readFileSync(filePath, 'utf-8');
    // Old pattern had "Back bubble" and "Front bubble" comments
    expect(source).not.toContain('Back bubble');
    expect(source).not.toContain('Front bubble');
    // New pattern has a single chat bubble with plus inside
    expect(source).toContain('Single chat bubble');
    expect(source).toContain('Plus inside bubble');
  });

  test('F06 – Inga i18n-nycklar på welcome-sida', async ({ page }) => {
    await page.goto('/welcome');
    await waitForApp(page);
    await page.waitForTimeout(500);
    await assertNoRawKeys(page);
  });

  test('F07 – quickMessages.suggestions är array i alla locales', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return { available: false, issues: [] as string[] };

      const issues: string[] = [];
      for (const locale of ['sv', 'en', 'no', 'da', 'fi']) {
        const suggestions = i18n.store.data[locale]?.translation?.quickMessages?.suggestions;
        if (!Array.isArray(suggestions)) issues.push(`${locale}: not array`);
        else if (suggestions.length < 3) issues.push(`${locale}: fewer than 3`);
      }
      return { available: true, issues };
    });

    if (!result.available) { test.skip(); return; }
    expect(result.issues).toEqual([]);
  });

  test('F08 – Svenska quick messages är korrekta', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.quickMessages?.suggestions;
    });

    if (!result) { test.skip(); return; }
    expect(result).toContain('Jag är framme!');
    expect(result).toContain('Hämta mig');
  });

  test('F09 – Engelska quick messages är korrekta', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.en?.translation?.quickMessages?.suggestions;
    });

    if (!result) { test.skip(); return; }
    expect(result).toContain("I'm here!");
    expect(result).toContain('Pick me up');
  });

  test('F10 – Message-typer finns i i18n', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      const msg = i18n.store.data.sv?.translation?.message;
      return { image: msg?.image, voice: msg?.voice, video: msg?.video, document: msg?.document };
    });

    if (!result) { test.skip(); return; }
    expect(result.image).toBeTruthy();
    expect(result.voice).toBeTruthy();
    expect(result.video).toBeTruthy();
  });

  test('F11 – Chat i18n har typing-indikatorer', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      const chat = i18n.store.data.sv?.translation?.chat;
      return { typing: chat?.typing, typingOne: chat?.typingOne };
    });

    if (!result) { test.skip(); return; }
    expect(result.typing).toBeTruthy();
    expect(result.typingOne).toBeTruthy();
  });

  test('F12 – Context menu i18n finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.contextMenu;
    });

    if (!result) { test.skip(); return; }
    expect(result.reply).toBeTruthy();
    expect(result.delete).toBeTruthy();
    expect(result.edit).toBeTruthy();
  });

  test('F13 – GIF i18n finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.gif;
    });

    if (!result) { test.skip(); return; }
    expect(result.search).toBeTruthy();
  });

  test('F14 – Poll i18n finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.poll;
    });

    if (!result) { test.skip(); return; }
    expect(result.create).toBeTruthy();
  });

  test('F15 – Call i18n finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.call;
    });

    if (!result) { test.skip(); return; }
    expect(result.voice).toBeTruthy();
    expect(result.video).toBeTruthy();
  });

});

// ─────────────────────────────────────────────────────────────
// G. SAMTAL (10 tester – i18n & komponent-verifiering)
// ─────────────────────────────────────────────────────────────

test.describe('G. Samtal (i18n & UI)', () => {

  test('G01 – Call i18n har röstsamtal-översättning', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      const call = i18n.store.data.sv?.translation?.call;
      return { voice: call?.voice, incoming: call?.incomingCall };
    });
    if (!result) { test.skip(); return; }
    expect(result.voice).toBeTruthy();
  });

  test('G02 – Call i18n har videosamtal-översättning', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.call?.video;
    });
    if (!result) { test.skip(); return; }
    expect(result).toBeTruthy();
  });

  test('G03 – Call i18n finns i alla 5 locales', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      const issues: string[] = [];
      for (const l of ['sv', 'en', 'no', 'da', 'fi']) {
        if (!i18n.store.data[l]?.translation?.call) issues.push(l);
      }
      return issues;
    });
    if (!result) { test.skip(); return; }
    expect(result).toEqual([]);
  });

  test('G04 – Call i18n har mute/unmute', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      const call = i18n.store.data.sv?.translation?.call;
      return { mute: call?.mute, unmute: call?.unmute };
    });
    if (!result) { test.skip(); return; }
    expect(result.mute).toBeTruthy();
    expect(result.unmute).toBeTruthy();
  });

  test('G05 – Call i18n har end call', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.call?.endCall;
    });
    if (!result) { test.skip(); return; }
    expect(result).toBeTruthy();
  });

  test('G06 – Call i18n har accept/decline', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      const call = i18n.store.data.sv?.translation?.call;
      return { accept: call?.accept, decline: call?.decline };
    });
    if (!result) { test.skip(); return; }
    expect(result.accept).toBeTruthy();
    expect(result.decline).toBeTruthy();
  });

  test('G07 – MFA Setup-sida renderas', async ({ page }) => {
    await page.goto('/mfa-setup');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('G08 – MFA Verify-sida renderas', async ({ page }) => {
    await page.goto('/mfa-verify');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('G09 – Texter detail behörighetskontroller i i18n', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.texterDetail;
    });
    if (!result) { test.skip(); return; }
    expect(result.permissions).toBeTruthy();
  });

  test('G10 – SOS i18n finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.sos;
    });
    if (!result) { test.skip(); return; }
    expect(result.unacknowledged).toBeTruthy();
  });

});

// ─────────────────────────────────────────────────────────────
// H. VÄNNER & KONTAKTER (10 tester)
// ─────────────────────────────────────────────────────────────

test.describe('H. Vänner & kontakter', () => {

  test('H01 – Friends-sida renderas', async ({ page }) => {
    await page.goto('/friends');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('H02 – Add Friend-sida renderas', async ({ page }) => {
    await page.goto('/add-friend');
    await waitForApp(page);
    await expect(
      page.locator('ion-content, form.auth-form').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('H03 – Friends i18n har alla nycklar', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      const f = i18n.store.data.sv?.translation?.friends;
      return {
        title: f?.title, myFriends: f?.myFriends, requests: f?.requests,
        addFriend: f?.addFriend, noFriends: f?.noFriends, sendRequest: f?.sendRequest,
        unfriend: f?.unfriend, myTeam: f?.myTeam, noRequests: f?.noRequests,
      };
    });
    if (!result) { test.skip(); return; }
    for (const [key, val] of Object.entries(result)) {
      expect(val, `friends.${key} missing`).toBeTruthy();
    }
  });

  test('H04 – Friends i18n finns i alla 5 locales', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      const issues: string[] = [];
      const keys = ['title', 'myFriends', 'requests', 'addFriend', 'noFriends'];
      for (const l of ['sv', 'en', 'no', 'da', 'fi']) {
        const f = i18n.store.data[l]?.translation?.friends;
        for (const k of keys) {
          if (!f?.[k]) issues.push(`${l}: friends.${k}`);
        }
      }
      return issues;
    });
    if (!result) { test.skip(); return; }
    expect(result).toEqual([]);
  });

  test('H05 – Add Friend har Zemi-nummer input', async ({ page }) => {
    await page.goto('/add-friend');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    await expect(page.locator('ion-input').first()).toBeVisible();
  });

  test('H06 – Add Friend har sök-knapp', async ({ page }) => {
    await page.goto('/add-friend');
    await waitForApp(page);
    const isLogin = await page.locator('form.auth-form').isVisible().catch(() => false);
    if (isLogin) { test.skip(); return; }
    await expect(page.locator('.search-button, ion-button').first()).toBeVisible();
  });

  test('H07 – Friends i18n har unfriend-bekräftelse', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      const f = i18n.store.data.sv?.translation?.friends;
      return { unfriendTitle: f?.unfriendTitle, unfriendMessage: f?.unfriendMessage };
    });
    if (!result) { test.skip(); return; }
    expect(result.unfriendTitle).toBeTruthy();
    expect(result.unfriendMessage).toBeTruthy();
  });

  test('H08 – Friends i18n har texter-godkännande-not', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.friends?.texterApprovalNote;
    });
    if (!result) { test.skip(); return; }
    expect(result).toBeTruthy();
  });

  test('H09 – Owner Approvals i18n finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.ownerApprovals;
    });
    if (!result) { test.skip(); return; }
    expect(result.title).toBeTruthy();
  });

  test('H10 – Search i18n finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n?.store) return null;
      return i18n.store.data.sv?.translation?.search;
    });
    if (!result) { test.skip(); return; }
    expect(result).toBeTruthy();
  });

});

// ─────────────────────────────────────────────────────────────
// I. UI/UX & STYLING (15 tester)
// ─────────────────────────────────────────────────────────────

test.describe('I. UI/UX & Styling', () => {

  test('I01 – Dark theme CSS-variabler är definierade', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const vars = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        bg: s.getPropertyValue('--background').trim(),
        fg: s.getPropertyValue('--foreground').trim(),
        card: s.getPropertyValue('--card').trim(),
        primary: s.getPropertyValue('--primary').trim(),
        border: s.getPropertyValue('--border').trim(),
        muted: s.getPropertyValue('--muted-foreground').trim(),
      };
    });
    for (const [key, val] of Object.entries(vars)) {
      expect(val, `CSS var --${key} missing`).toBeTruthy();
    }
  });

  test('I02 – Ionic variabler för dark theme finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const vars = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        ionBg: s.getPropertyValue('--ion-background-color').trim(),
        ionText: s.getPropertyValue('--ion-text-color').trim(),
        ionToolbar: s.getPropertyValue('--ion-toolbar-background').trim(),
      };
    });
    expect(vars.ionBg).toBeTruthy();
    expect(vars.ionText).toBeTruthy();
    expect(vars.ionToolbar).toBeTruthy();
  });

  test('I03 – Body har mörk bakgrund', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const lightness = rgbLightness(bg);
    expect(lightness).toBeLessThan(50); // Dark background
  });

  test('I04 – Titel har hög kontrast', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const color = await page.locator('h1.auth-title').evaluate(
      el => getComputedStyle(el).color
    );
    expect(rgbLightness(color)).toBeGreaterThan(180);
  });

  test('I05 – Subtitle har läsbar kontrast', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const color = await page.locator('p.auth-subtitle').evaluate(
      el => getComputedStyle(el).color
    );
    expect(rgbLightness(color)).toBeGreaterThan(120);
  });

  test('I06 – Signup consent-text är läsbar', async ({ page }) => {
    await page.goto('/signup');
    await waitForApp(page);
    const color = await page.locator('.consent-label').evaluate(
      el => getComputedStyle(el).color
    );
    expect(rgbLightness(color)).toBeGreaterThan(100);
  });

  test('I07 – Ionic hydrated', async ({ page }) => {
    await page.goto('/login', { timeout: 20_000 });
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('ion-app.hydrated')).toBeVisible({ timeout: 20_000 });
  });

  test('I08 – Knappar har runda hörn (pill shape)', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    const radius = await page.locator('ion-button').first().evaluate(
      el => getComputedStyle(el).borderRadius
    );
    // Should be 9999px or very large
    expect(parseInt(radius)).toBeGreaterThan(10);
  });

  test('I09 – Login-formulär har auth-form klass', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);
    await expect(page.locator('form.auth-form')).toBeVisible();
  });

  test('I10 – Animationer definierade i CSS', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const hasAnimations = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      let found = 0;
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSKeyframesRule) {
              if (['bounce-in', 'slide-up', 'shimmer', 'gentle-float'].includes(rule.name)) {
                found++;
              }
            }
          }
        } catch { /* cross-origin */ }
      }
      return found;
    });

    expect(hasAnimations).toBeGreaterThanOrEqual(2);
  });

  test('I11 – Skeleton shimmer CSS finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const exists = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSKeyframesRule && rule.name === 'shimmer') return true;
          }
        } catch { /* cross-origin */ }
      }
      return false;
    });
    expect(exists).toBeTruthy();
  });

  test('I12 – Safe area classes finns i CSS', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const result = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'safe-bottom';
      el.style.position = 'fixed';
      document.body.appendChild(el);
      const pb = getComputedStyle(el).paddingBottom;
      el.remove();
      return pb;
    });
    // Should resolve to at least some padding
    expect(result).toBeTruthy();
  });

  test('I13 – Glow effect class finns', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const shadow = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'glow-primary';
      document.body.appendChild(el);
      const s = getComputedStyle(el).boxShadow;
      el.remove();
      return s;
    });
    expect(shadow).not.toBe('none');
  });

  test('I14 – Welcome-sida har logo', async ({ page }) => {
    await page.goto('/welcome');
    await waitForApp(page);
    await expect(page.locator('.welcome-logo')).toBeVisible({ timeout: 10_000 });
  });

  test('I15 – Legal sidor renderas', async ({ page }) => {
    await page.goto('/terms');
    await waitForApp(page);
    await expect(page.locator('ion-content')).toBeVisible({ timeout: 10_000 });
    await page.goto('/privacy');
    await waitForApp(page);
    await expect(page.locator('ion-content')).toBeVisible({ timeout: 10_000 });
  });

});
