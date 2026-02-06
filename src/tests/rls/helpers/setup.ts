/**
 * RLS Integration Test Infrastructure
 *
 * Data seeding happens in global-setup.ts (runs once via vitest globalSetup).
 * This module provides:
 * - getTestWorld(): creates authenticated clients for the pre-seeded users
 * - Assertion helpers (expectRows, expectNoRows, etc.)
 * - execSQL() for direct DB operations in individual tests
 *
 * SAFE TO COMMIT — all keys are local Supabase defaults.
 */

import { execSync } from 'child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

// ---------------------------------------------------------------------------
// Constants – local Supabase deterministic keys (safe to commit)
// ---------------------------------------------------------------------------
export const SUPABASE_URL = 'http://127.0.0.1:54321';

export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const TEST_PASSWORD = 'test-password-123!';

// ---------------------------------------------------------------------------
// Docker exec SQL helper
// ---------------------------------------------------------------------------
export function execSQL(sql: string): string {
  return execSync(
    'docker exec -i supabase_db_zemichat psql -U postgres -d postgres',
    { input: sql, encoding: 'utf-8' },
  );
}

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------
export function createAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createAuthenticatedClient(
  email: string,
  password: string = TEST_PASSWORD,
): Promise<SupabaseClient<Database>> {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Failed to sign in ${email}: ${error.message}`);
  return client;
}

// ---------------------------------------------------------------------------
// TestWorld types
// ---------------------------------------------------------------------------
export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient<Database>;
}

export interface TestTeam {
  id: string;
  owner: TestUser;
  super: TestUser;
  texter: TestUser;
}

export interface TestWorld {
  team1: TestTeam;
  team2: TestTeam;
  adminClient: SupabaseClient<Database>;
  chats: {
    texterToTexter: string;
    superToSuper: string;
    superToTexter: string;
    ownerToTexter: string;
  };
  messages: {
    normalMsg: string;
    deletedMsg: string;
    editedMsg: string;
    inSuperChat: string;
    inCrossTeamChat: string;
  };
  friendships: {
    acceptedCrossTeam: string;
    pendingForTexter: string;
  };
  texterSettingsId: string;
  reactionId: string;
  readReceiptId: string;
  messageEditId: string;
}

// ---------------------------------------------------------------------------
// Fixed UUIDs (must match global-setup.ts)
// ---------------------------------------------------------------------------
const IDS = {
  team1: '11111111-1111-1111-1111-111111111111',
  team2: '22222222-2222-2222-2222-222222222222',
  owner1: 'aaaa0001-0000-0000-0000-000000000001',
  super1: 'aaaa0002-0000-0000-0000-000000000002',
  texter1: 'aaaa0003-0000-0000-0000-000000000003',
  owner2: 'bbbb0001-0000-0000-0000-000000000001',
  super2: 'bbbb0002-0000-0000-0000-000000000002',
  texter2: 'bbbb0003-0000-0000-0000-000000000003',
  chatTexterToTexter: 'cccc0001-0000-0000-0000-000000000001',
  chatSuperToSuper: 'cccc0002-0000-0000-0000-000000000002',
  chatSuperToTexter: 'cccc0003-0000-0000-0000-000000000003',
  chatOwnerToTexter: 'cccc0004-0000-0000-0000-000000000004',
  msgNormal: 'dddd0001-0000-0000-0000-000000000001',
  msgDeleted: 'dddd0002-0000-0000-0000-000000000002',
  msgEdited: 'dddd0003-0000-0000-0000-000000000003',
  msgInSuperChat: 'dddd0004-0000-0000-0000-000000000004',
  msgInCrossTeam: 'dddd0005-0000-0000-0000-000000000005',
  friendshipAccepted: 'eeee0001-0000-0000-0000-000000000001',
  friendshipPending: 'eeee0002-0000-0000-0000-000000000002',
  texterSettings1: 'ffff0001-0000-0000-0000-000000000001',
  reaction1: 'ffff0002-0000-0000-0000-000000000001',
  readReceipt1: 'ffff0003-0000-0000-0000-000000000001',
  messageEdit1: 'ffff0004-0000-0000-0000-000000000001',
} as const;

export { IDS };

// ---------------------------------------------------------------------------
// Email helpers
// ---------------------------------------------------------------------------
function emailFor(id: string): string {
  return `user-${id.slice(0, 8)}@test.local`;
}

export const EMAILS = {
  owner1: emailFor(IDS.owner1),
  super1: emailFor(IDS.super1),
  texter1: emailFor(IDS.texter1),
  owner2: emailFor(IDS.owner2),
  super2: emailFor(IDS.super2),
  texter2: emailFor(IDS.texter2),
};

// ---------------------------------------------------------------------------
// getTestWorld — creates authenticated clients for pre-seeded data.
// Called in beforeAll() of each test file. Cheap — only sign-ins, no seeding.
// ---------------------------------------------------------------------------
export async function getTestWorld(): Promise<TestWorld> {
  const adminClient = createAdminClient();

  const [
    owner1Client,
    super1Client,
    texter1Client,
    owner2Client,
    super2Client,
    texter2Client,
  ] = await Promise.all([
    createAuthenticatedClient(EMAILS.owner1),
    createAuthenticatedClient(EMAILS.super1),
    createAuthenticatedClient(EMAILS.texter1),
    createAuthenticatedClient(EMAILS.owner2),
    createAuthenticatedClient(EMAILS.super2),
    createAuthenticatedClient(EMAILS.texter2),
  ]);

  return {
    team1: {
      id: IDS.team1,
      owner: { id: IDS.owner1, email: EMAILS.owner1, client: owner1Client },
      super: { id: IDS.super1, email: EMAILS.super1, client: super1Client },
      texter: { id: IDS.texter1, email: EMAILS.texter1, client: texter1Client },
    },
    team2: {
      id: IDS.team2,
      owner: { id: IDS.owner2, email: EMAILS.owner2, client: owner2Client },
      super: { id: IDS.super2, email: EMAILS.super2, client: super2Client },
      texter: { id: IDS.texter2, email: EMAILS.texter2, client: texter2Client },
    },
    adminClient,
    chats: {
      texterToTexter: IDS.chatTexterToTexter,
      superToSuper: IDS.chatSuperToSuper,
      superToTexter: IDS.chatSuperToTexter,
      ownerToTexter: IDS.chatOwnerToTexter,
    },
    messages: {
      normalMsg: IDS.msgNormal,
      deletedMsg: IDS.msgDeleted,
      editedMsg: IDS.msgEdited,
      inSuperChat: IDS.msgInSuperChat,
      inCrossTeamChat: IDS.msgInCrossTeam,
    },
    friendships: {
      acceptedCrossTeam: IDS.friendshipAccepted,
      pendingForTexter: IDS.friendshipPending,
    },
    texterSettingsId: IDS.texterSettings1,
    reactionId: IDS.reaction1,
    readReceiptId: IDS.readReceipt1,
    messageEditId: IDS.messageEdit1,
  };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

export function expectRows<T>(
  result: { data: T[] | null; error: { message: string; code?: string } | null },
  n: number,
): void {
  expect(result.error).toBeNull();
  expect(result.data).not.toBeNull();
  expect(result.data!.length).toBe(n);
}

export function expectNoRows<T>(
  result: { data: T[] | null; error: { message: string; code?: string } | null },
): void {
  expect(result.error).toBeNull();
  expect(result.data).not.toBeNull();
  expect(result.data!.length).toBe(0);
}

export function expectSuccess<T>(
  result: { data: T | null; error: { message: string; code?: string } | null },
): void {
  expect(result.error).toBeNull();
}

export function expectRLSError(
  result: { data: unknown; error: { message: string; code?: string } | null },
): void {
  expect(result.error).not.toBeNull();
}

export function expectBlocked(
  result: { data: unknown; error: { message: string; code?: string } | null; count?: number | null },
): void {
  const wasError = result.error !== null;
  const zeroAffected = !wasError && (
    result.data === null ||
    (Array.isArray(result.data) && result.data.length === 0)
  );
  expect(wasError || zeroAffected).toBe(true);
}
