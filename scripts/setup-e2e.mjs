#!/usr/bin/env node
/**
 * One-time setup for E2E tests.
 *
 * Creates two dedicated test users with known passwords,
 * adds them to a team, creates a shared chat, and writes .env.e2e.
 *
 * Usage:  node scripts/setup-e2e.mjs
 * Requires: VITE_SUPABASE_URL and service role key (fetched via CLI).
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { config } from 'dotenv';

config(); // load .env for VITE_SUPABASE_URL

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Get service role key
let SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  // Try reading from existing .env.e2e
  if (existsSync('.env.e2e')) {
    const content = (await import('fs')).readFileSync('.env.e2e', 'utf8');
    const match = content.match(/E2E_SUPABASE_SERVICE_KEY=(.+)/);
    if (match) SERVICE_KEY = match[1].trim();
  }
}

if (!SERVICE_KEY) {
  console.error('SERVICE_KEY not found. Please provide E2E_SUPABASE_SERVICE_KEY env var.');
  console.error('You can get it from: npx supabase projects api-keys');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USER1_EMAIL = 'e2e-test-user1@zemichat.test';
const TEST_USER1_PASSWORD = 'E2eTest!User1_2026';
const TEST_USER2_EMAIL = 'e2e-test-user2@zemichat.test';
const TEST_USER2_PASSWORD = 'E2eTest!User2_2026';

async function findOrCreateUser(email, password, displayName) {
  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 100 });
  const found = existing?.users?.find((u) => u.email === email);

  if (found) {
    console.log(`  Found existing user: ${email} (${found.id})`);
    // Update password to ensure it matches
    await supabase.auth.admin.updateUserById(found.id, { password });
    return found.id;
  }

  // Create new user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error(`  Failed to create ${email}:`, error.message);
    process.exit(1);
  }

  console.log(`  Created user: ${email} (${data.user.id})`);
  return data.user.id;
}

async function ensurePublicUser(userId, teamId, role, displayName) {
  // Check if public.users entry exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (existing) {
    console.log(`  Public user entry exists for ${userId}`);
    // Make sure they're active
    await supabase.from('users').update({ is_active: true }).eq('id', userId);
    return;
  }

  // Generate a unique zemi number
  const hex = userId.substring(0, 6).toUpperCase();
  const zemiNumber = `ZEMI-E2E-${hex}`;

  const { error } = await supabase.from('users').insert({
    id: userId,
    team_id: teamId,
    role,
    display_name: displayName,
    zemi_number: zemiNumber,
    is_active: true,
  });

  if (error) {
    console.error(`  Failed to create public user for ${userId}:`, error.message);
    process.exit(1);
  }
  console.log(`  Created public user entry for ${userId}`);
}

async function ensureTeam(userId) {
  // Check if there's already a team
  const { data: user } = await supabase
    .from('users')
    .select('team_id')
    .eq('id', userId)
    .single();

  if (user?.team_id) return user.team_id;

  // Create a team
  const { data: team, error } = await supabase
    .from('teams')
    .insert({ name: 'E2E Test Team', owner_id: userId })
    .select()
    .single();

  if (error) {
    console.error('  Failed to create team:', error.message);
    process.exit(1);
  }

  console.log(`  Created team: ${team.id}`);
  return team.id;
}

async function ensureChat(user1Id, user2Id) {
  // Check if they already share a chat
  const { data: u1Chats } = await supabase
    .from('chat_members')
    .select('chat_id')
    .eq('user_id', user1Id)
    .is('left_at', null);

  const { data: u2Chats } = await supabase
    .from('chat_members')
    .select('chat_id')
    .eq('user_id', user2Id)
    .is('left_at', null);

  const u1ChatIds = new Set((u1Chats || []).map((r) => r.chat_id));
  const sharedChatId = (u2Chats || []).find((r) => u1ChatIds.has(r.chat_id))?.chat_id;

  if (sharedChatId) {
    console.log(`  Found shared chat: ${sharedChatId}`);
    return sharedChatId;
  }

  // Create a new chat (is_group: false for DM)
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .insert({ is_group: false, created_by: user1Id })
    .select()
    .single();

  if (chatError) {
    console.error('  Failed to create chat:', chatError.message);
    process.exit(1);
  }

  console.log(`  Created chat: ${chat.id}`);

  // Add both users as members (no role column in chat_members)
  const { error: memberError } = await supabase.from('chat_members').insert([
    { chat_id: chat.id, user_id: user1Id },
    { chat_id: chat.id, user_id: user2Id },
  ]);

  if (memberError) {
    console.error('  Failed to add chat members:', memberError.message);
    process.exit(1);
  }

  console.log('  Added both users to chat');
  return chat.id;
}

async function main() {
  console.log('Setting up E2E test environment...\n');

  // 1. Create test users
  console.log('1. Creating test users...');
  const user1Id = await findOrCreateUser(TEST_USER1_EMAIL, TEST_USER1_PASSWORD, 'E2E User 1');
  const user2Id = await findOrCreateUser(TEST_USER2_EMAIL, TEST_USER2_PASSWORD, 'E2E User 2');

  // 2. Get or create a team (use Erik's team if available)
  console.log('\n2. Setting up team...');
  const { data: erikUser } = await supabase
    .from('users')
    .select('team_id')
    .eq('role', 'owner')
    .not('team_id', 'is', null)
    .limit(1)
    .single();

  const teamId = erikUser?.team_id || (await ensureTeam(user1Id));
  console.log(`  Using team: ${teamId}`);

  // 3. Ensure public.users entries
  console.log('\n3. Setting up public user profiles...');
  await ensurePublicUser(user1Id, teamId, 'owner', 'E2E User 1');
  await ensurePublicUser(user2Id, teamId, 'super', 'E2E User 2');

  // 4. Ensure shared chat
  console.log('\n4. Setting up shared chat...');
  const chatId = await ensureChat(user1Id, user2Id);

  // 5. Verify login works
  console.log('\n5. Verifying authentication...');
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: login1 } = await anonClient.auth.signInWithPassword({
    email: TEST_USER1_EMAIL,
    password: TEST_USER1_PASSWORD,
  });
  if (login1) {
    console.error(`  Login failed for user1: ${login1.message}`);
    process.exit(1);
  }
  console.log('  User 1 login OK');

  const anonClient2 = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: login2 } = await anonClient2.auth.signInWithPassword({
    email: TEST_USER2_EMAIL,
    password: TEST_USER2_PASSWORD,
  });
  if (login2) {
    console.error(`  Login failed for user2: ${login2.message}`);
    process.exit(1);
  }
  console.log('  User 2 login OK');

  // 6. Write .env.e2e
  console.log('\n6. Writing .env.e2e...');
  const envContent = `# E2E Test Configuration (auto-generated by scripts/setup-e2e.mjs)

# Supabase
E2E_SUPABASE_URL=${SUPABASE_URL}
E2E_SUPABASE_ANON_KEY=${ANON_KEY}
E2E_SUPABASE_SERVICE_KEY=${SERVICE_KEY}

# Test user 1 (owner role)
E2E_USER1_EMAIL=${TEST_USER1_EMAIL}
E2E_USER1_PASSWORD=${TEST_USER1_PASSWORD}

# Test user 2 (super role)
E2E_USER2_EMAIL=${TEST_USER2_EMAIL}
E2E_USER2_PASSWORD=${TEST_USER2_PASSWORD}

# Shared chat
E2E_CHAT_ID=${chatId}
`;

  writeFileSync('.env.e2e', envContent);
  console.log('  .env.e2e written successfully');

  console.log('\n--- Setup complete! Run tests with: npm run test.e2e ---');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
