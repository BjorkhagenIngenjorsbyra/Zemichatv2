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

describe('call_logs RLS', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('Chat member can see call logs', async () => {
      await w.adminClient.from('call_logs').insert({
        chat_id: w.chats.superToTexter,
        initiator_id: w.team1.super.id,
        type: 'voice',
        status: 'answered',
      });

      const res = await w.team1.texter.client
        .from('call_logs')
        .select('*')
        .eq('chat_id', w.chats.superToTexter);
      expectRows(res, 1);

      await w.adminClient
        .from('call_logs')
        .delete()
        .eq('chat_id', w.chats.superToTexter);
    });

    it('Non-member cannot see call logs', async () => {
      await w.adminClient.from('call_logs').insert({
        chat_id: w.chats.superToTexter,
        initiator_id: w.team1.super.id,
        type: 'voice',
        status: 'answered',
      });

      const res = await w.team2.texter.client
        .from('call_logs')
        .select('*')
        .eq('chat_id', w.chats.superToTexter);
      expectNoRows(res);

      await w.adminClient
        .from('call_logs')
        .delete()
        .eq('chat_id', w.chats.superToTexter);
    });

    it('Owner oversight: sees call logs in Texter chats', async () => {
      await w.adminClient.from('call_logs').insert({
        chat_id: w.chats.superToTexter,
        initiator_id: w.team1.super.id,
        type: 'video',
        status: 'answered',
      });

      const res = await w.team1.owner.client
        .from('call_logs')
        .select('*')
        .eq('chat_id', w.chats.superToTexter);
      expectRows(res, 1);

      await w.adminClient
        .from('call_logs')
        .delete()
        .eq('chat_id', w.chats.superToTexter);
    });

    it('Owner CANNOT see call logs in Super↔Super chat', async () => {
      await w.adminClient.from('call_logs').insert({
        chat_id: w.chats.superToSuper,
        initiator_id: w.team1.super.id,
        type: 'voice',
        status: 'answered',
      });

      const res = await w.team1.owner.client
        .from('call_logs')
        .select('*')
        .eq('chat_id', w.chats.superToSuper);
      expectNoRows(res);

      await w.adminClient
        .from('call_logs')
        .delete()
        .eq('chat_id', w.chats.superToSuper);
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Active chat member can initiate call', async () => {
      const res = await w.team1.super.client
        .from('call_logs')
        .insert({
          chat_id: w.chats.superToTexter,
          initiator_id: w.team1.super.id,
          type: 'voice',
          status: 'answered',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('call_logs').delete().eq('id', res.data.id);
      }
    });

    it('Cannot initiate call as someone else', async () => {
      const res = await w.team1.super.client
        .from('call_logs')
        .insert({
          chat_id: w.chats.superToTexter,
          initiator_id: w.team1.texter.id,
          type: 'voice',
          status: 'answered',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Non-member cannot initiate call', async () => {
      const res = await w.team2.texter.client
        .from('call_logs')
        .insert({
          chat_id: w.chats.superToTexter,
          initiator_id: w.team2.texter.id,
          type: 'voice',
          status: 'answered',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Deactivated user cannot initiate call', async () => {
      execSQL(`UPDATE public.users SET is_active = false WHERE id = '${w.team1.super.id}';`);
      try {
        const res = await w.team1.super.client
          .from('call_logs')
          .insert({
            chat_id: w.chats.superToTexter,
            initiator_id: w.team1.super.id,
            type: 'voice',
            status: 'missed',
          })
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
    it('Chat member can update call log (ended_at, duration)', async () => {
      const { data: call } = await w.adminClient
        .from('call_logs')
        .insert({
          chat_id: w.chats.superToTexter,
          initiator_id: w.team1.super.id,
          type: 'voice',
          status: 'answered',
        })
        .select()
        .single();

      const res = await w.team1.texter.client
        .from('call_logs')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: 120,
        })
        .eq('id', call!.id)
        .select();
      expectRows(res, 1);

      await w.adminClient.from('call_logs').delete().eq('id', call!.id);
    });

    it('Non-member cannot update call log', async () => {
      const { data: call } = await w.adminClient
        .from('call_logs')
        .insert({
          chat_id: w.chats.superToTexter,
          initiator_id: w.team1.super.id,
          type: 'voice',
          status: 'answered',
        })
        .select()
        .single();

      const res = await w.team2.texter.client
        .from('call_logs')
        .update({ duration_seconds: 999 })
        .eq('id', call!.id)
        .select();
      expectBlocked(res);

      await w.adminClient.from('call_logs').delete().eq('id', call!.id);
    });
  });
});
