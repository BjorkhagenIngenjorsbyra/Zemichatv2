import { describe, it, beforeAll } from 'vitest';
import {
  getTestWorld,
  expectRows,
  expectNoRows,
  expectSuccess,
  expectRLSError,
  expectBlocked,
  type TestWorld,
} from './helpers/setup';

let w: TestWorld;

beforeAll(async () => {
  w = await getTestWorld();
});

describe('chat_members RLS', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('Chat member can see fellow members', async () => {
      const res = await w.team1.texter.client
        .from('chat_members')
        .select('*')
        .eq('chat_id', w.chats.superToTexter);
      expectRows(res, 2); // super1 + texter1
    });

    it('Non-member cannot see chat members', async () => {
      const res = await w.team2.texter.client
        .from('chat_members')
        .select('*')
        .eq('chat_id', w.chats.superToTexter);
      expectNoRows(res);
    });

    it('Owner oversight: sees members of Texter chat', async () => {
      const res = await w.team1.owner.client
        .from('chat_members')
        .select('*')
        .eq('chat_id', w.chats.superToTexter);
      expectRows(res, 2);
    });

    it('Owner CANNOT see members of Super↔Super chat', async () => {
      const res = await w.team1.owner.client
        .from('chat_members')
        .select('*')
        .eq('chat_id', w.chats.superToSuper);
      expectNoRows(res);
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Chat creator can add members', async () => {
      // super1 created superToTexter, can add owner1
      const res = await w.team1.super.client
        .from('chat_members')
        .insert({ chat_id: w.chats.superToTexter, user_id: w.team1.owner.id })
        .select()
        .single();
      expectSuccess(res);
      // Cleanup
      if (res.data) {
        await w.adminClient
          .from('chat_members')
          .delete()
          .eq('id', res.data.id);
      }
    });

    it('Non-creator cannot add members', async () => {
      // texter1 is member of superToTexter but not creator
      const res = await w.team1.texter.client
        .from('chat_members')
        .insert({ chat_id: w.chats.superToTexter, user_id: w.team2.super.id })
        .select()
        .single();
      expectRLSError(res);
    });
  });

  // ------------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------------
  describe('UPDATE', () => {
    it('Member can update own settings (mute)', async () => {
      const res = await w.team1.texter.client
        .from('chat_members')
        .update({ is_muted: true })
        .eq('chat_id', w.chats.superToTexter)
        .eq('user_id', w.team1.texter.id)
        .select();
      expectRows(res, 1);
      // Restore
      await w.adminClient
        .from('chat_members')
        .update({ is_muted: false })
        .eq('chat_id', w.chats.superToTexter)
        .eq('user_id', w.team1.texter.id);
    });

    it('Member can update own settings (pin)', async () => {
      const res = await w.team1.texter.client
        .from('chat_members')
        .update({ is_pinned: true })
        .eq('chat_id', w.chats.superToTexter)
        .eq('user_id', w.team1.texter.id)
        .select();
      expectRows(res, 1);
      await w.adminClient
        .from('chat_members')
        .update({ is_pinned: false })
        .eq('chat_id', w.chats.superToTexter)
        .eq('user_id', w.team1.texter.id);
    });

    it('Member cannot update another member settings', async () => {
      const res = await w.team1.texter.client
        .from('chat_members')
        .update({ is_muted: true })
        .eq('chat_id', w.chats.superToTexter)
        .eq('user_id', w.team1.super.id)
        .select();
      expectBlocked(res);
    });
  });
});
