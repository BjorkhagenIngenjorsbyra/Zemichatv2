/**
 * Vitest globalSetup — runs once before all test files.
 * Seeds auth users and public data into the local Supabase instance.
 */
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const TEST_PASSWORD = 'test-password-123!';

function execSQL(sql: string): string {
  // ON_ERROR_STOP=1 so seed failures throw loudly instead of being silently
  // swallowed (a swallowed teams-insert error once masked 31 test failures).
  return execSync(
    'docker exec -i supabase_db_zemichat psql -U postgres -d postgres -v ON_ERROR_STOP=1',
    { input: sql, encoding: 'utf-8' },
  );
}

// Fixed UUIDs
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
  // Realistic two-way conversation in the owner↔texter chat so the UI looks
  // like a real chat (mixed senders → left/right alignment is exercised, and
  // explorer/demo runs aren't dominated by leftover E2E test strings).
  msgConvTexter1: 'dddd0010-0000-0000-0000-000000000010',
  msgConvOwner1:  'dddd0011-0000-0000-0000-000000000011',
  msgConvTexter2: 'dddd0012-0000-0000-0000-000000000012',
  msgConvOwner2:  'dddd0013-0000-0000-0000-000000000013',
  msgConvTexter3: 'dddd0014-0000-0000-0000-000000000014',
  friendshipAccepted: 'eeee0001-0000-0000-0000-000000000001',
  friendshipPending: 'eeee0002-0000-0000-0000-000000000002',
  texterSettings1: 'ffff0001-0000-0000-0000-000000000001',
  reaction1: 'ffff0002-0000-0000-0000-000000000001',
  readReceipt1: 'ffff0003-0000-0000-0000-000000000001',
  messageEdit1: 'ffff0004-0000-0000-0000-000000000001',
};

function emailFor(id: string): string {
  return `user-${id.slice(0, 8)}@test.local`;
}

export async function setup() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create auth users
  const userDefs = [
    { id: IDS.owner1, email: emailFor(IDS.owner1) },
    { id: IDS.super1, email: emailFor(IDS.super1) },
    { id: IDS.texter1, email: emailFor(IDS.texter1) },
    { id: IDS.owner2, email: emailFor(IDS.owner2) },
    { id: IDS.super2, email: emailFor(IDS.super2) },
    { id: IDS.texter2, email: emailFor(IDS.texter2) },
  ];

  for (const u of userDefs) {
    // Best-effort delete first so a half-finished prior run (e.g. one that
    // aborted before the SQL seed) doesn't block re-creation with the same id.
    await adminClient.auth.admin.deleteUser(u.id).catch(() => {});
    const { error } = await adminClient.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`globalSetup createUser ${u.email}: ${error.message}`);
  }

  // Seed public data
  execSQL(`
    SET session_replication_role = 'replica';

    INSERT INTO public.teams (id, name, owner_id, referral_code) VALUES
      ('${IDS.team1}', 'Team Alpha', '${IDS.owner1}', 'REF-TEAM-ALPHA'),
      ('${IDS.team2}', 'Team Beta',  '${IDS.owner2}', 'REF-TEAM-BETA');

    INSERT INTO public.users (id, team_id, role, zemi_number, display_name, is_active) VALUES
      ('${IDS.owner1}',  '${IDS.team1}', 'owner',  'ZEMI-001-001', 'Anna Berg',    true),
      ('${IDS.super1}',  '${IDS.team1}', 'super',  'ZEMI-001-002', 'Johan Berg',   true),
      ('${IDS.texter1}', '${IDS.team1}', 'texter', 'ZEMI-001-003', 'Liam Berg',    true),
      ('${IDS.owner2}',  '${IDS.team2}', 'owner',  'ZEMI-002-001', 'Sara Lund',    true),
      ('${IDS.super2}',  '${IDS.team2}', 'super',  'ZEMI-002-002', 'Erik Lund',    true),
      ('${IDS.texter2}', '${IDS.team2}', 'texter', 'ZEMI-002-003', 'Nora Lund',    true);

    INSERT INTO public.texter_settings (id, user_id) VALUES
      ('${IDS.texterSettings1}', '${IDS.texter1}');

    INSERT INTO public.friendships (id, requester_id, addressee_id, status, approved_by) VALUES
      ('${IDS.friendshipAccepted}', '${IDS.texter1}', '${IDS.texter2}', 'accepted', '${IDS.owner1}'),
      ('${IDS.friendshipPending}',  '${IDS.super2}',  '${IDS.texter1}', 'pending',  NULL);

    INSERT INTO public.chats (id, name, is_group, created_by) VALUES
      -- 1-on-1 chats have no stored name in real usage; the UI derives the
      -- other member's display name. NULL here exercises that real path.
      ('${IDS.chatTexterToTexter}', NULL, false, '${IDS.texter1}'),
      ('${IDS.chatSuperToSuper}',   NULL, false, '${IDS.super1}'),
      ('${IDS.chatSuperToTexter}',  NULL, false, '${IDS.super1}'),
      ('${IDS.chatOwnerToTexter}',  NULL, false, '${IDS.owner1}');

    INSERT INTO public.chat_members (chat_id, user_id) VALUES
      ('${IDS.chatTexterToTexter}', '${IDS.texter1}'),
      ('${IDS.chatTexterToTexter}', '${IDS.texter2}'),
      ('${IDS.chatSuperToSuper}', '${IDS.super1}'),
      ('${IDS.chatSuperToSuper}', '${IDS.super2}'),
      ('${IDS.chatSuperToTexter}', '${IDS.super1}'),
      ('${IDS.chatSuperToTexter}', '${IDS.texter1}'),
      ('${IDS.chatOwnerToTexter}', '${IDS.owner1}'),
      ('${IDS.chatOwnerToTexter}', '${IDS.texter1}');

    INSERT INTO public.messages (id, chat_id, sender_id, type, content) VALUES
      ('${IDS.msgNormal}',      '${IDS.chatSuperToTexter}',  '${IDS.texter1}', 'text', 'Hello from texter'),
      ('${IDS.msgEdited}',      '${IDS.chatSuperToTexter}',  '${IDS.texter1}', 'text', 'Edited content'),
      ('${IDS.msgInSuperChat}', '${IDS.chatSuperToSuper}',   '${IDS.super1}',  'text', 'Super private msg'),
      ('${IDS.msgInCrossTeam}', '${IDS.chatTexterToTexter}', '${IDS.texter1}', 'text', 'Cross team msg');

    -- Realistic owner↔texter conversation with mixed senders and ascending timestamps.
    INSERT INTO public.messages (id, chat_id, sender_id, type, content, created_at) VALUES
      ('${IDS.msgConvTexter1}', '${IDS.chatOwnerToTexter}', '${IDS.texter1}', 'text', 'Hej! Är du hemma snart?',            now() - interval '50 minutes'),
      ('${IDS.msgConvOwner1}',  '${IDS.chatOwnerToTexter}', '${IDS.owner1}',  'text', 'Ja, jag är på väg nu. Hur var det i skolan?', now() - interval '45 minutes'),
      ('${IDS.msgConvTexter2}', '${IDS.chatOwnerToTexter}', '${IDS.texter1}', 'text', 'Bra! Vi hade prov i matte och det gick fint.', now() - interval '40 minutes'),
      ('${IDS.msgConvOwner2}',  '${IDS.chatOwnerToTexter}', '${IDS.owner1}',  'text', 'Vad kul att höra! Vill du ha pannkakor till middag?', now() - interval '20 minutes'),
      ('${IDS.msgConvTexter3}', '${IDS.chatOwnerToTexter}', '${IDS.texter1}', 'text', 'Ja tack!! 🥞',                       now() - interval '5 minutes');

    INSERT INTO public.messages (id, chat_id, sender_id, type, content, deleted_at, deleted_by) VALUES
      ('${IDS.msgDeleted}', '${IDS.chatSuperToTexter}', '${IDS.texter1}', 'text', 'Deleted msg',
       now(), '${IDS.texter1}');

    INSERT INTO public.message_edits (id, message_id, old_content) VALUES
      ('${IDS.messageEdit1}', '${IDS.msgEdited}', 'Original content before edit');
    UPDATE public.messages SET is_edited = true, edited_at = now()
      WHERE id = '${IDS.msgEdited}';

    INSERT INTO public.message_reactions (id, message_id, user_id, emoji) VALUES
      ('${IDS.reaction1}', '${IDS.msgNormal}', '${IDS.texter1}', '👍');

    INSERT INTO public.message_read_receipts (id, message_id, user_id) VALUES
      ('${IDS.readReceipt1}', '${IDS.msgNormal}', '${IDS.super1}');

    SET session_replication_role = 'origin';
  `);
}
