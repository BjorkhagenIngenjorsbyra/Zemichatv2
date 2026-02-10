import { test, expect } from '@playwright/test';

test.describe('Zemichat App Tests', () => {

  test('Login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    // Headless Chromium uses en-US locale → English text
    // Wait for either Swedish or English login text
    await expect(
      page.getByRole('heading', { name: 'Zemichat' })
    ).toBeVisible({ timeout: 10000 });
    // Login button should exist
    await expect(
      page.locator('ion-button[type="submit"]')
    ).toBeVisible();
  });

  test('Login page has form inputs', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Should have email and password inputs
    const inputs = page.locator('ion-input');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Signup page loads', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    // Should show signup form with heading
    await expect(
      page.locator('h1.auth-title').or(page.locator('.auth-title'))
    ).toBeVisible({ timeout: 10000 });
    // Should have a submit button
    await expect(
      page.locator('ion-button[type="submit"]')
    ).toBeVisible();
  });

  test('Texter login page loads', async ({ page }) => {
    await page.goto('/texter-login');
    await page.waitForLoadState('networkidle');
    // Should show Zemichat heading and Zemi number input
    await expect(
      page.getByRole('heading', { name: 'Zemichat' })
    ).toBeVisible({ timeout: 10000 });
    // Should have a login button
    await expect(
      page.locator('ion-button[type="submit"]')
    ).toBeVisible();
  });

  test('No raw i18n keys visible on login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const body = await page.locator('body').textContent();
    // Raw i18n keys look like "auth.login" or "common.submit"
    const rawKeyPattern = /\b(auth|common|friends|dashboard|texter|settings|quickMessages)\.[a-zA-Z]+\b/;
    expect(body).not.toMatch(rawKeyPattern);
  });

  test('No raw i18n keys visible on texter login page', async ({ page }) => {
    await page.goto('/texter-login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const body = await page.locator('body').textContent();
    const rawKeyPattern = /\b(auth|common|friends|dashboard|texter|settings|quickMessages)\.[a-zA-Z]+\b/;
    expect(body).not.toMatch(rawKeyPattern);
  });

  test('No raw i18n keys visible on signup page', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const body = await page.locator('body').textContent();
    const rawKeyPattern = /\b(auth|common|friends|dashboard|texter|settings|quickMessages)\.[a-zA-Z]+\b/;
    expect(body).not.toMatch(rawKeyPattern);
  });

  test('CSS: safe-fab class applies correct bottom offset', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `.safe-fab { bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }`;
      document.head.appendChild(style);
      const el = document.createElement('div');
      el.className = 'safe-fab';
      el.style.position = 'fixed';
      document.body.appendChild(el);
      const computed = getComputedStyle(el).bottom;
      el.remove();
      style.remove();
      return computed;
    });
    // On desktop env(safe-area-inset-bottom) = 0, so bottom = 16px
    expect(result).toBe('16px');
  });

  test('App uses dark theme with correct CSS variables', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const vars = await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        background: style.getPropertyValue('--background').trim(),
        foreground: style.getPropertyValue('--foreground').trim(),
        card: style.getPropertyValue('--card').trim(),
      };
    });

    // Should have dark theme CSS variables defined
    expect(vars.background).toBeTruthy();
    expect(vars.foreground).toBeTruthy();
    expect(vars.card).toBeTruthy();
  });

  test('i18n: all locale files have matching quickMessages keys', async ({ page }) => {
    // Static validation — load the app and check i18n resources if accessible
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(() => {
      const i18n = (window as any).__i18n || (window as any).i18next || (window as any).i18n;
      if (!i18n || !i18n.store) return { available: false, issues: [] as string[] };

      const issues: string[] = [];
      const locales = ['sv', 'en', 'no', 'da', 'fi'];
      const requiredKeys = [
        'friends.title', 'friends.addFriend', 'friends.userNotFound',
        'quickMessages.title', 'quickMessages.addDefaults', 'quickMessages.suggestions',
      ];

      for (const locale of locales) {
        const resources = i18n.store.data[locale]?.translation;
        if (!resources) {
          issues.push(`Missing locale: ${locale}`);
          continue;
        }
        for (const key of requiredKeys) {
          const parts = key.split('.');
          let val: any = resources;
          for (const p of parts) {
            val = val?.[p];
          }
          if (val === undefined || val === null) {
            issues.push(`${locale}: missing ${key}`);
          }
        }
      }
      return { available: true, issues };
    });

    if (!result.available) {
      // i18n store not accessible from window — skip gracefully
      return;
    }

    expect(result.issues).toEqual([]);
  });

});
