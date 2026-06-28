/**
 * Group-call participant cap — server-side enforcement (migration #4/6).
 *
 * `public.chat_call_within_capacity(chat_id)` is the authoritative gate the
 * agora-token edge function calls before issuing a join token. It returns true
 * when the chat has <= MAX_GROUP_CALL_PARTICIPANTS (6) active members, so a
 * modified client cannot mint a token for an oversized channel and blow the
 * Agora free-tier cap.
 *
 * These tests exercise the function directly against the DB (the count logic
 * and left_at exclusion) and verify it is locked to service_role only. The
 * function is service-role-only by design, so assertions go through psql
 * (execSQL) rather than an authenticated client.
 */

import { describe, it, afterAll, expect } from 'vitest';
import { execSQL, IDS } from './helpers/setup';

// Synthetic channel id — deliberately NOT a seeded chat, so inserting/removing
// members here cannot affect other RLS tests' shared state.
const SYNTH_CHAT = '88888888-0000-0000-0000-0000000000c4';

/** Call the gate via psql and return its boolean as a string token. */
function capacityOk(chatId: string): boolean {
  const out = execSQL(
    `SELECT CASE WHEN public.chat_call_within_capacity('${chatId}'::uuid) ` +
      `THEN 'CAP_OK' ELSE 'CAP_FULL' END;`,
  );
  if (out.includes('CAP_OK')) return true;
  if (out.includes('CAP_FULL')) return false;
  throw new Error(`Unexpected psql output: ${out}`);
}

/** Seed `n` distinct active members on the synthetic channel. */
function seedMembers(n: number): void {
  // session_replication_role=replica bypasses the FK to chats/users so the
  // synthetic rows can exist; scoped to this one psql session only.
  execSQL(
    `SET session_replication_role = replica;\n` +
      `DELETE FROM chat_members WHERE chat_id = '${SYNTH_CHAT}';\n` +
      `INSERT INTO chat_members ` +
      `(id, chat_id, user_id, joined_at, is_muted, is_pinned, is_archived, unread_count, marked_unread)\n` +
      `SELECT gen_random_uuid(), '${SYNTH_CHAT}'::uuid, gen_random_uuid(), now(), ` +
      `false, false, false, 0, false FROM generate_series(1, ${n});`,
  );
}

describe('chat_call_within_capacity — group-call participant cap', () => {
  afterAll(() => {
    execSQL(`DELETE FROM chat_members WHERE chat_id = '${SYNTH_CHAT}';`);
  });

  it('allows a real seeded 2-member chat', () => {
    expect(capacityOk(IDS.chatTexterToTexter)).toBe(true);
  });

  it('allows exactly 6 active members (at the cap)', () => {
    seedMembers(6);
    expect(capacityOk(SYNTH_CHAT)).toBe(true);
  });

  it('blocks 7 active members (over the cap)', () => {
    seedMembers(7);
    expect(capacityOk(SYNTH_CHAT)).toBe(false);
  });

  it('excludes members who have left (left_at set) from the count', () => {
    seedMembers(7);
    execSQL(
      `UPDATE chat_members SET left_at = now() WHERE chat_id = '${SYNTH_CHAT}' ` +
        `AND id = (SELECT id FROM chat_members WHERE chat_id = '${SYNTH_CHAT}' ` +
        `AND left_at IS NULL LIMIT 1);`,
    );
    expect(capacityOk(SYNTH_CHAT)).toBe(true);
  });

  it('treats an unknown channel (0 members) as within capacity', () => {
    expect(capacityOk('00000000-0000-0000-0000-0000000000ff')).toBe(true);
  });

  it('is locked to service_role — anon and authenticated cannot execute', () => {
    const out = execSQL(
      `SELECT has_function_privilege('anon', 'public.chat_call_within_capacity(uuid)', 'EXECUTE') AS anon,\n` +
        `       has_function_privilege('authenticated', 'public.chat_call_within_capacity(uuid)', 'EXECUTE') AS auth,\n` +
        `       has_function_privilege('service_role', 'public.chat_call_within_capacity(uuid)', 'EXECUTE') AS svc;`,
    );
    // psql prints the three booleans on the data row: f | f | t
    const dataLine = out
      .split('\n')
      .find((l) => /\b[tf]\b/.test(l) && l.includes('|'));
    expect(dataLine).toBeDefined();
    const [anon, auth, svc] = dataLine!.split('|').map((c) => c.trim());
    expect(anon).toBe('f');
    expect(auth).toBe('f');
    expect(svc).toBe('t');
  });
});
