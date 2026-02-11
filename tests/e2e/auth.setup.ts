import { test as setup } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Local Supabase standard demo keys
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// ─── Test Users ──────────────────────────────────────────────

export const TEST_OWNER = {
  email: 'e2e-owner@test.zemichat.local',
  password: 'TestOwner123!',
  name: 'E2E Owner',
};

export const TEST_NEW_OWNER = {
  email: 'e2e-newowner@test.zemichat.local',
  password: 'TestNewOwner123!',
  name: 'E2E New Owner',
};

export const TEST_TEXTER = {
  password: 'TestTexter123!',
  name: 'E2E Texter',
};

export const TEST_TEXTER2 = {
  password: 'TestTexter2_123!',
  name: 'E2E Texter2',
};

export const TEST_SUPER = {
  email: 'e2e-super@test.zemichat.local',
  password: 'TestSuper123!',
  name: 'E2E Super',
};

// ─── Auth Files ──────────────────────────────────────────────

export const OWNER_AUTH_FILE = 'tests/e2e/.auth/owner.json';
export const NEW_OWNER_AUTH_FILE = 'tests/e2e/.auth/new-owner.json';
export const TEXTER_AUTH_FILE = 'tests/e2e/.auth/texter.json';
export const SUPER_AUTH_FILE = 'tests/e2e/.auth/super.json';

// ─── Helpers ─────────────────────────────────────────────────

async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await page
    .locator('ion-app.hydrated')
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {});
}

async function ensureUser(
  admin: SupabaseClient,
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

async function ensureTeam(userId: string): Promise<string | null> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: signIn } = await client.auth.signInWithPassword({
    email: TEST_OWNER.email,
    password: TEST_OWNER.password,
  });

  if (!signIn.user) return null;

  // Check if user already has a profile (team)
  const { data: profile } = await client
    .from('users')
    .select('id, team_id')
    .eq('id', userId)
    .single();

  if (profile) return profile.team_id;

  // Create team via RPC
  const { error } = await client.rpc('create_team_with_owner', {
    team_name: 'E2E Test Team',
    owner_display_name: TEST_OWNER.name,
  });

  if (error) throw error;

  // Re-fetch to get team_id
  const { data: newProfile } = await client
    .from('users')
    .select('team_id')
    .eq('id', userId)
    .single();

  return newProfile?.team_id || null;
}

async function ensureTexter(
  ownerEmail: string,
  ownerPassword: string,
  texterName: string,
  texterPassword: string,
): Promise<{ zemiNumber: string; userId: string } | null> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: signIn } = await client.auth.signInWithPassword({
    email: ownerEmail,
    password: ownerPassword,
  });

  if (!signIn.user) return null;

  // Check if texter already exists by name
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await serviceClient
    .from('users')
    .select('id, zemi_number')
    .eq('display_name', texterName)
    .eq('role', 'texter')
    .single();

  if (existing) {
    return { zemiNumber: existing.zemi_number, userId: existing.id };
  }

  // Create texter via RPC (as owner)
  const { data, error } = await client.rpc('create_texter', {
    texter_display_name: texterName,
    texter_password: texterPassword,
  });

  if (error) throw error;

  const result = typeof data === 'string' ? JSON.parse(data) : data;
  return {
    zemiNumber: result.zemi_number,
    userId: result.user_id,
  };
}

async function ensureSuper(
  admin: SupabaseClient,
  serviceClient: SupabaseClient,
  superEmail: string,
  superPassword: string,
  superName: string,
  teamId: string,
): Promise<string> {
  const userId = await ensureUser(admin, superEmail, superPassword, superName);

  // Check if profile already exists
  const { data: existing } = await serviceClient
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (existing) return userId;

  // Generate Zemi number
  const zemiPart1 = Math.random().toString(36).substring(2, 5).toUpperCase();
  const zemiPart2 = Math.random().toString(36).substring(2, 5).toUpperCase();
  const zemiNumber = `ZEMI-${zemiPart1}-${zemiPart2}`;

  // Insert super profile directly (service role bypasses RLS)
  const { error } = await serviceClient.from('users').insert({
    id: userId,
    team_id: teamId,
    role: 'super',
    display_name: superName,
    zemi_number: zemiNumber,
    is_active: true,
  });

  if (error) throw error;

  return userId;
}

async function ensureFriendship(
  serviceClient: SupabaseClient,
  userId1: string,
  userId2: string,
): Promise<void> {
  // Check if friendship already exists
  const { data: existing } = await serviceClient
    .from('friendships')
    .select('id')
    .or(`and(requester_id.eq.${userId1},addressee_id.eq.${userId2}),and(requester_id.eq.${userId2},addressee_id.eq.${userId1})`)
    .eq('status', 'accepted')
    .single();

  if (existing) return;

  const { error } = await serviceClient.from('friendships').insert({
    requester_id: userId1,
    addressee_id: userId2,
    status: 'accepted',
    approved_by: userId1,
  });

  if (error && !error.message.includes('duplicate')) throw error;
}

async function ensureChat(
  serviceClient: SupabaseClient,
  memberIds: string[],
  isGroup: boolean,
  name?: string,
): Promise<string> {
  // For 1-on-1 chats, check if one already exists between these users
  if (!isGroup && memberIds.length === 2) {
    const { data: existingMembers } = await serviceClient
      .from('chat_members')
      .select('chat_id')
      .in('user_id', memberIds);

    if (existingMembers) {
      // Find chat_id that appears for both users
      const chatCounts = new Map<string, number>();
      for (const m of existingMembers) {
        chatCounts.set(m.chat_id, (chatCounts.get(m.chat_id) || 0) + 1);
      }
      for (const [chatId, count] of chatCounts) {
        if (count >= 2) {
          // Check if it's a 1-on-1 chat
          const { data: chat } = await serviceClient
            .from('chats')
            .select('id, is_group')
            .eq('id', chatId)
            .eq('is_group', false)
            .single();
          if (chat) return chat.id;
        }
      }
    }
  }

  // Create new chat
  const { data: chat, error: chatError } = await serviceClient
    .from('chats')
    .insert({
      is_group: isGroup,
      name: name || null,
      created_by: memberIds[0],
    })
    .select('id')
    .single();

  if (chatError) throw chatError;

  // Add members
  const memberInserts = memberIds.map((uid) => ({
    chat_id: chat.id,
    user_id: uid,
  }));

  const { error: memberError } = await serviceClient
    .from('chat_members')
    .insert(memberInserts);

  if (memberError) throw memberError;

  return chat.id;
}

async function seedMessage(
  serviceClient: SupabaseClient,
  chatId: string,
  senderId: string,
  content: string,
  type: string = 'text',
): Promise<string> {
  const { data, error } = await serviceClient
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      content,
      type,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// ─── Setup: Owner with team ───────────────────────────────────

setup('create owner auth session', async ({ page }) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create user
  const userId = await ensureUser(admin, TEST_OWNER.email, TEST_OWNER.password, TEST_OWNER.name);

  // 2. Create team if needed
  const teamId = await ensureTeam(userId);

  // 3. Seed Texter and Super users (for later tests)
  if (teamId) {
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create texter 1
    const texter = await ensureTexter(
      TEST_OWNER.email,
      TEST_OWNER.password,
      TEST_TEXTER.name,
      TEST_TEXTER.password,
    );

    // Create texter 2
    const texter2 = await ensureTexter(
      TEST_OWNER.email,
      TEST_OWNER.password,
      TEST_TEXTER2.name,
      TEST_TEXTER2.password,
    );

    // Create super
    const superId = await ensureSuper(
      admin,
      serviceClient,
      TEST_SUPER.email,
      TEST_SUPER.password,
      TEST_SUPER.name,
      teamId,
    );

    // Create friendships
    if (texter) {
      await ensureFriendship(serviceClient, userId, texter.userId);
      if (texter2) {
        await ensureFriendship(serviceClient, texter.userId, texter2.userId);
      }
    }

    if (superId && texter) {
      await ensureFriendship(serviceClient, superId, texter.userId);
    }

    if (superId) {
      await ensureFriendship(serviceClient, userId, superId);
    }

    // Create chats with seed messages
    if (texter) {
      const chatOwnerTexter = await ensureChat(serviceClient, [userId, texter.userId], false);
      await seedMessage(serviceClient, chatOwnerTexter, userId, 'Hej! Hur mår du?');
      await seedMessage(serviceClient, chatOwnerTexter, texter.userId, 'Bra tack! 😊');
      await seedMessage(serviceClient, chatOwnerTexter, userId, 'Vad gör du idag?');
    }

    if (texter && texter2) {
      const chatTexters = await ensureChat(serviceClient, [texter.userId, texter2.userId], false);
      await seedMessage(serviceClient, chatTexters, texter.userId, 'Hej kompis!');
      await seedMessage(serviceClient, chatTexters, texter2.userId, 'Tjena! Ska vi spela?');
    }

    if (superId && texter) {
      const chatSuperTexter = await ensureChat(serviceClient, [superId, texter.userId], false);
      await seedMessage(serviceClient, chatSuperTexter, superId, 'Allt ok?');
      await seedMessage(serviceClient, chatSuperTexter, texter.userId, 'Japp!');
    }

    // Write seed data to a file for other test files to reference
    const seedData = {
      ownerId: userId,
      teamId,
      texterId: texter?.userId,
      texterZemi: texter?.zemiNumber,
      texter2Id: texter2?.userId,
      texter2Zemi: texter2?.zemiNumber,
      superId,
    };

    // Store in env file for test consumption
    const fs = await import('fs');
    fs.writeFileSync(
      'tests/e2e/.auth/seed-data.json',
      JSON.stringify(seedData, null, 2),
    );
  }

  // 4. Log in via browser (skip tour if shown)
  await page.goto('/login');
  await waitForApp(page);

  const inputs = page.locator('ion-input');
  await inputs.nth(0).locator('input').fill(TEST_OWNER.email);
  await inputs.nth(1).locator('input').fill(TEST_OWNER.password);
  await page.locator('ion-button[type="submit"]').click();

  // Wait for redirect to /chats (owner with team)
  await page.waitForURL('**/chats**', { timeout: 15_000 });

  // Skip onboarding if shown
  await page.evaluate(() => localStorage.setItem('zemichat-owner-onboarding-done', 'true'));

  // 5. Save storage state
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

// ─── Setup: Texter auth session ──────────────────────────────

setup('create texter auth session', async ({ page }) => {
  // Read seed data to get texter's zemi number
  const fs = await import('fs');
  const seedDataPath = 'tests/e2e/.auth/seed-data.json';

  if (!fs.existsSync(seedDataPath)) {
    console.log('Seed data not ready yet, skipping texter setup');
    return;
  }

  const seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf-8'));
  const texterZemi = seedData.texterZemi;

  if (!texterZemi) {
    console.log('No texter zemi number found, skipping');
    return;
  }

  // Log in via texter login page
  await page.goto('/texter-login');
  await waitForApp(page);

  const inputs = page.locator('ion-input');
  await inputs.nth(0).locator('input').fill(texterZemi);
  await inputs.nth(1).locator('input').fill(TEST_TEXTER.password);
  await page.locator('ion-button[type="submit"]').click();

  // Wait for redirect to /chats
  await page.waitForURL('**/chats**', { timeout: 15_000 });

  // Skip tour
  await page.evaluate(() => localStorage.setItem('zemichat-texter-tour-done', 'true'));

  await page.context().storageState({ path: TEXTER_AUTH_FILE });
});

// ─── Setup: Super auth session ───────────────────────────────

setup('create super auth session', async ({ page }) => {
  // Log in via normal login page
  await page.goto('/login');
  await waitForApp(page);

  const inputs = page.locator('ion-input');
  await inputs.nth(0).locator('input').fill(TEST_SUPER.email);
  await inputs.nth(1).locator('input').fill(TEST_SUPER.password);
  await page.locator('ion-button[type="submit"]').click();

  // Wait for redirect to /chats
  await page.waitForURL('**/chats**', { timeout: 15_000 });

  // Skip tour
  await page.evaluate(() => localStorage.setItem('zemichat-super-tour-done', 'true'));

  await page.context().storageState({ path: SUPER_AUTH_FILE });
});
