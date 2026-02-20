/**
 * Login helper for two-user E2E tests.
 *
 * Creates an isolated BrowserContext (separate localStorage / cookies),
 * logs in via the Ionic login form, and returns { context, page }.
 */
import { Browser, BrowserContext, Page } from '@playwright/test';

interface AuthSession {
  context: BrowserContext;
  page: Page;
}

export async function loginUser(
  browser: Browser,
  email: string,
  password: string,
  baseURL: string,
): Promise<AuthSession> {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    permissions: ['microphone', 'camera'],
  });
  const page = await context.newPage();

  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');

  // Fill email — Ionic wraps inputs in shadow DOM, target native <input>
  const emailInput = page.locator('form[data-testid="login-form"] ion-input[type="email"] input');
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  await emailInput.fill(email);

  // Fill password
  const passwordInput = page.locator('form[data-testid="login-form"] ion-input[type="password"] input');
  await passwordInput.fill(password);

  // Submit
  const submitBtn = page.locator('form[data-testid="login-form"] ion-button[type="submit"]');
  await submitBtn.click();

  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });

  return { context, page };
}
