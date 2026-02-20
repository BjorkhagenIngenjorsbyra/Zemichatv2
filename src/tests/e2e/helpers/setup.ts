/**
 * E2E Test Setup
 *
 * These tests run against the deployed Supabase instance (not local).
 * They test the full flow including Edge Functions.
 *
 * Required environment variables (set in .env.e2e or process.env):
 *   E2E_SUPABASE_URL          – Supabase project URL
 *   E2E_SUPABASE_ANON_KEY     – Supabase anon key
 *   E2E_SUPABASE_SERVICE_KEY  – Supabase service role key (for cleanup)
 *   E2E_USER1_EMAIL           – Test user 1 email
 *   E2E_USER1_PASSWORD        – Test user 1 password
 *   E2E_USER2_EMAIL           – Test user 2 email
 *   E2E_USER2_PASSWORD        – Test user 2 password
 *   E2E_CHAT_ID               – Chat ID where user1 and user2 are both members
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load .env.e2e if it exists
config({ path: '.env.e2e' });

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export const E2E_SUPABASE_URL = process.env.E2E_SUPABASE_URL || '';
export const E2E_SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY || '';
export const E2E_SUPABASE_SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_KEY || '';
export const E2E_USER1_EMAIL = process.env.E2E_USER1_EMAIL || '';
export const E2E_USER1_PASSWORD = process.env.E2E_USER1_PASSWORD || '';
export const E2E_USER2_EMAIL = process.env.E2E_USER2_EMAIL || '';
export const E2E_USER2_PASSWORD = process.env.E2E_USER2_PASSWORD || '';
export const E2E_CHAT_ID = process.env.E2E_CHAT_ID || '';

export function isE2EConfigured(): boolean {
  return !!(
    E2E_SUPABASE_URL &&
    E2E_SUPABASE_ANON_KEY &&
    E2E_USER1_EMAIL &&
    E2E_USER1_PASSWORD &&
    E2E_USER2_EMAIL &&
    E2E_USER2_PASSWORD &&
    E2E_CHAT_ID
  );
}

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

export function createAnonClient(): SupabaseClient {
  return createClient(E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createServiceClient(): SupabaseClient {
  if (!E2E_SUPABASE_SERVICE_KEY) {
    throw new Error('E2E_SUPABASE_SERVICE_KEY required for admin operations');
  }
  return createClient(E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createAuthenticatedClient(
  email: string,
  password: string,
): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return { client, userId: data.user!.id };
}

// ---------------------------------------------------------------------------
// E2E Test World
// ---------------------------------------------------------------------------

export interface E2ETestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

export interface E2ETestWorld {
  user1: E2ETestUser;
  user2: E2ETestUser;
  chatId: string;
  serviceClient?: SupabaseClient;
}

export async function getE2ETestWorld(): Promise<E2ETestWorld> {
  const [u1, u2] = await Promise.all([
    createAuthenticatedClient(E2E_USER1_EMAIL, E2E_USER1_PASSWORD),
    createAuthenticatedClient(E2E_USER2_EMAIL, E2E_USER2_PASSWORD),
  ]);

  const world: E2ETestWorld = {
    user1: { id: u1.userId, email: E2E_USER1_EMAIL, client: u1.client },
    user2: { id: u2.userId, email: E2E_USER2_EMAIL, client: u2.client },
    chatId: E2E_CHAT_ID,
  };

  if (E2E_SUPABASE_SERVICE_KEY) {
    world.serviceClient = createServiceClient();
  }

  return world;
}
