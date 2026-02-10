import { test as setup } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Local Supabase standard demo keys
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const TEST_OWNER = {
  email: 'e2e-owner@test.zemichat.local',
  password: 'TestOwner123!',
  name: 'E2E Owner',
};

const TEST_NEW_OWNER = {
  email: 'e2e-newowner@test.zemichat.local',
  password: 'TestNewOwner123!',
  name: 'E2E New Owner',
};

export const OWNER_AUTH_FILE = 'tests/e2e/.auth/owner.json';
export const NEW_OWNER_AUTH_FILE = 'tests/e2e/.auth/new-owner.json';

async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await page.locator('ion-app.hydrated').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
}

async function ensureUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  password: string,
  name: string,
): Promise<string> {
  const { data: listData } = await admin.auth.admin.listUsers();
  const existing = listData?.users?.find((u) => u.email === email);

  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });

  if (error) throw error;
  return data.user.id;
}

async function ensureTeam(userId: string): Promise<boolean> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: signIn } = await client.auth.signInWithPassword({
    email: TEST_OWNER.email,
    password: TEST_OWNER.password,
  });

  if (!signIn.user) return false;

  // Check if user already has a profile (team)
  const { data: profile } = await client
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (profile) return true;

  // Create team via RPC
  const { error } = await client.rpc('create_team_with_owner', {
    team_name: 'E2E Test Team',
    owner_display_name: TEST_OWNER.name,
  });

  if (error) throw error;
  return true;
}

// ─── Setup: Owner with team ───────────────────────────────────

setup('create owner auth session', async ({ page }) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create user
  const userId = await ensureUser(admin, TEST_OWNER.email, TEST_OWNER.password, TEST_OWNER.name);

  // 2. Create team if needed
  await ensureTeam(userId);

  // 3. Log in via browser
  await page.goto('/login');
  await waitForApp(page);

  const inputs = page.locator('ion-input');
  await inputs.nth(0).locator('input').fill(TEST_OWNER.email);
  await inputs.nth(1).locator('input').fill(TEST_OWNER.password);
  await page.locator('ion-button[type="submit"]').click();

  // Wait for redirect to /chats (owner with team)
  await page.waitForURL('**/chats**', { timeout: 15_000 });

  // 4. Save storage state
  await page.context().storageState({ path: OWNER_AUTH_FILE });
});

// ─── Setup: New owner without team ────────────────────────────

setup('create new-owner auth session', async ({ page }) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create user (no team)
  await ensureUser(admin, TEST_NEW_OWNER.email, TEST_NEW_OWNER.password, TEST_NEW_OWNER.name);

  // 2. Ensure NO team exists — delete profile if left from previous run
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: listData } = await admin.auth.admin.listUsers();
  const user = listData?.users?.find((u) => u.email === TEST_NEW_OWNER.email);
  if (user) {
    // Delete any existing team/profile for this user (cleanup from previous runs)
    await client.from('users').delete().eq('id', user.id);
  }

  // 3. Log in via browser
  await page.goto('/login');
  await waitForApp(page);

  const inputs = page.locator('ion-input');
  await inputs.nth(0).locator('input').fill(TEST_NEW_OWNER.email);
  await inputs.nth(1).locator('input').fill(TEST_NEW_OWNER.password);
  await page.locator('ion-button[type="submit"]').click();

  // Without team, redirects: /login → submit → /chats → /create-team
  await page.waitForURL('**/create-team**', { timeout: 15_000 });

  // 4. Save storage state
  await page.context().storageState({ path: NEW_OWNER_AUTH_FILE });
});
