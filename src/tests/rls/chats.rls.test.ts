import { describe, it, beforeAll } from 'vitest';
import {
  getTestWorld,
  expectRows,
  expectNoRows,
  expectSuccess,
  expectRLSError,
  expectBlocked,
  execSQL,
  type TestWorld,
} from './helpers/setup';

let w: TestWorld;

beforeAll(async () => {
  w = await getTestWorld();
});

describe('chats RLS', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('Chat member can see their chat', async () => {
      const res = await w.team1.texter.client
        .from('chats')
        .select('*')
        .eq('id', w.chats.superToTexter);
      expectRows(res, 1);
    });

    it('Non-member cannot see chat', async () => {
      const res = await w.team2.texter.client
        .from('chats')
        .select('*')
        .eq('id', w.chats.superToTexter);
      expectNoRows(res);
    });

    it('Owner oversight: sees chat where Texter participates', async () => {
      // Owner1 sees superToTexter chat (team1.texter is a member)
      const res = await w.team1.owner.client
        .from('chats')
        .select('*')
        .eq('id', w.chats.superToTexter);
      expectRows(res, 1);
    });

    it('Owner CANNOT see Super↔Super chat (no Texter)', async () => {
      const res = await w.team1.owner.client
        .from('chats')
        .select('*')
        .eq('id', w.chats.superToSuper);
      expectNoRows(res);
    });

    it('Cross-team: Owner1 sees Texter1↔Texter2 chat', async () => {
      const res = await w.team1.owner.client
        .from('chats')
        .select('*')
        .eq('id', w.chats.texterToTexter);
      expectRows(res, 1);
    });

    it('Cross-team: Owner2 sees Texter1↔Texter2 chat', async () => {
      const res = await w.team2.owner.client
        .from('chats')
        .select('*')
        .eq('id', w.chats.texterToTexter);
      expectRows(res, 1);
    });

    it('Owner2 cannot see team1 internal Super↔Texter chat', async () => {
      // superToTexter has team1.texter, but owner2 is from team2
      // owner2 CAN see because texter1 is in the chat and is a texter in team1 (not team2)
      // Wait — chat_has_texter_from_team checks texter from OWNER'S team
      // team2.owner checks for texter from team2 → team1.texter is NOT in team2
      const res = await w.team2.owner.client
        .from('chats')
        .select('*')
        .eq('id', w.chats.superToTexter);
      expectNoRows(res);
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Active user can create chat with self as creator', async () => {
      const chatId = 'cccc9999-0000-0000-0000-000000000001';
      const res = await w.team1.super.client
        .from('chats')
        .insert({ id: chatId, created_by: w.team1.super.id });
      expectSuccess(res);
      await w.adminClient.from('chats').delete().eq('id', chatId);
    });

    it('Cannot create chat with someone else as creator', async () => {
      const res = await w.team1.super.client
        .from('chats')
        .insert({ created_by: w.team1.texter.id })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Deactivated user cannot create chat', async () => {
      execSQL(`UPDATE public.users SET is_active = false WHERE id = '${w.team1.super.id}';`);
      try {
        const res = await w.team1.super.client
          .from('chats')
          .insert({ created_by: w.team1.super.id })
          .select()
          .single();
        expectRLSError(res);
      } finally {
        execSQL(`UPDATE public.users SET is_active = true WHERE id = '${w.team1.super.id}';`);
      }
    });
  });

  // ------------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------------
  describe('UPDATE', () => {
    it('Creator can update chat metadata', async () => {
      // superToTexter was created_by super1
      const res = await w.team1.super.client
        .from('chats')
        .update({ name: 'Updated Chat Name' })
        .eq('id', w.chats.superToTexter)
        .select();
      expectRows(res, 1);
      await w.adminClient
        .from('chats')
        .update({ name: 'Super-Texter Chat' })
        .eq('id', w.chats.superToTexter);
    });

    it('Non-creator member cannot update chat', async () => {
      // texter1 is member of superToTexter but not creator
      const res = await w.team1.texter.client
        .from('chats')
        .update({ name: 'Hacked' })
        .eq('id', w.chats.superToTexter)
        .select();
      expectBlocked(res);
    });
  });
});
