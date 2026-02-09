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

    it('Texter with can_voice_call=false CANNOT initiate voice call', async () => {
      await w.adminClient
        .from('texter_settings')
        .update({ can_voice_call: false })
        .eq('user_id', w.team1.texter.id);
      try {
        const res = await w.team1.texter.client
          .from('call_logs')
          .insert({
            chat_id: w.chats.superToTexter,
            initiator_id: w.team1.texter.id,
            type: 'voice',
            status: 'missed',
          })
          .select()
          .single();
        expectRLSError(res);
      } finally {
        await w.adminClient
          .from('texter_settings')
          .update({ can_voice_call: true })
          .eq('user_id', w.team1.texter.id);
      }
    });

    it('Texter with can_video_call=false CANNOT initiate video call', async () => {
      await w.adminClient
        .from('texter_settings')
        .update({ can_video_call: false })
        .eq('user_id', w.team1.texter.id);
      try {
        const res = await w.team1.texter.client
          .from('call_logs')
          .insert({
            chat_id: w.chats.superToTexter,
            initiator_id: w.team1.texter.id,
            type: 'video',
            status: 'missed',
          })
          .select()
          .single();
        expectRLSError(res);
      } finally {
        await w.adminClient
          .from('texter_settings')
          .update({ can_video_call: true })
          .eq('user_id', w.team1.texter.id);
      }
    });

    it('Texter with can_voice_call=true CAN initiate voice call', async () => {
      const res = await w.team1.texter.client
        .from('call_logs')
        .insert({
          chat_id: w.chats.superToTexter,
          initiator_id: w.team1.texter.id,
          type: 'voice',
          status: 'missed',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('call_logs').delete().eq('id', res.data.id);
      }
    });

    it('Texter with can_video_call=true CAN initiate video call', async () => {
      const res = await w.team1.texter.client
        .from('call_logs')
        .insert({
          chat_id: w.chats.superToTexter,
          initiator_id: w.team1.texter.id,
          type: 'video',
          status: 'missed',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('call_logs').delete().eq('id', res.data.id);
      }
    });

    it('Owner can always initiate call regardless of texter_settings', async () => {
      const res = await w.team1.owner.client
        .from('call_logs')
        .insert({
          chat_id: w.chats.ownerToTexter,
          initiator_id: w.team1.owner.id,
          type: 'voice',
          status: 'missed',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('call_logs').delete().eq('id', res.data.id);
      }
    });

    it('Super can always initiate call', async () => {
      const res = await w.team1.super.client
        .from('call_logs')
        .insert({
          chat_id: w.chats.superToTexter,
          initiator_id: w.team1.super.id,
          type: 'video',
          status: 'missed',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('call_logs').delete().eq('id', res.data.id);
      }
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
