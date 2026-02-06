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

describe('quick_messages RLS', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('User sees own quick messages', async () => {
      await w.adminClient.from('quick_messages').insert({
        user_id: w.team1.super.id,
        created_by: w.team1.super.id,
        content: 'Quick reply',
      });

      const res = await w.team1.super.client
        .from('quick_messages')
        .select('*')
        .eq('user_id', w.team1.super.id);
      expectRows(res, 1);

      await w.adminClient
        .from('quick_messages')
        .delete()
        .eq('user_id', w.team1.super.id);
    });

    it('Owner sees Texters quick messages', async () => {
      await w.adminClient.from('quick_messages').insert({
        user_id: w.team1.texter.id,
        created_by: w.team1.owner.id,
        content: 'For texter',
      });

      const res = await w.team1.owner.client
        .from('quick_messages')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectRows(res, 1);

      await w.adminClient
        .from('quick_messages')
        .delete()
        .eq('user_id', w.team1.texter.id);
    });

    it('Super cannot see Texters quick messages', async () => {
      await w.adminClient.from('quick_messages').insert({
        user_id: w.team1.texter.id,
        created_by: w.team1.owner.id,
        content: 'For texter',
      });

      const res = await w.team1.super.client
        .from('quick_messages')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectNoRows(res);

      await w.adminClient
        .from('quick_messages')
        .delete()
        .eq('user_id', w.team1.texter.id);
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Super can create quick message for self', async () => {
      const res = await w.team1.super.client
        .from('quick_messages')
        .insert({
          user_id: w.team1.super.id,
          created_by: w.team1.super.id,
          content: 'My quick msg',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('quick_messages').delete().eq('id', res.data.id);
      }
    });

    it('Owner can create quick message for self', async () => {
      const res = await w.team1.owner.client
        .from('quick_messages')
        .insert({
          user_id: w.team1.owner.id,
          created_by: w.team1.owner.id,
          content: 'Owner quick msg',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('quick_messages').delete().eq('id', res.data.id);
      }
    });

    it('Owner can create quick message for their Texter', async () => {
      const res = await w.team1.owner.client
        .from('quick_messages')
        .insert({
          user_id: w.team1.texter.id,
          created_by: w.team1.owner.id,
          content: 'For texter from owner',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('quick_messages').delete().eq('id', res.data.id);
      }
    });

    it('Texter CANNOT create quick messages for self', async () => {
      const res = await w.team1.texter.client
        .from('quick_messages')
        .insert({
          user_id: w.team1.texter.id,
          created_by: w.team1.texter.id,
          content: 'Texter msg',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Owner cannot create quick message for other teams Texter', async () => {
      const res = await w.team1.owner.client
        .from('quick_messages')
        .insert({
          user_id: w.team2.texter.id,
          created_by: w.team1.owner.id,
          content: 'Cross team',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Deactivated Super cannot create quick messages', async () => {
      execSQL(`UPDATE public.users SET is_active = false WHERE id = '${w.team1.super.id}';`);
      try {
        const res = await w.team1.super.client
          .from('quick_messages')
          .insert({
            user_id: w.team1.super.id,
            created_by: w.team1.super.id,
            content: 'Should fail',
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
  // UPDATE + DELETE
  // ------------------------------------------------------------------
  describe('UPDATE', () => {
    it('Creator can update quick message', async () => {
      const { data: qm } = await w.adminClient
        .from('quick_messages')
        .insert({
          user_id: w.team1.super.id,
          created_by: w.team1.super.id,
          content: 'Original',
        })
        .select()
        .single();

      const res = await w.team1.super.client
        .from('quick_messages')
        .update({ content: 'Updated' })
        .eq('id', qm!.id)
        .select();
      expectRows(res, 1);

      await w.adminClient.from('quick_messages').delete().eq('id', qm!.id);
    });

    it('Non-creator cannot update quick message', async () => {
      const { data: qm } = await w.adminClient
        .from('quick_messages')
        .insert({
          user_id: w.team1.texter.id,
          created_by: w.team1.owner.id,
          content: 'By owner',
        })
        .select()
        .single();

      const res = await w.team1.texter.client
        .from('quick_messages')
        .update({ content: 'Hacked' })
        .eq('id', qm!.id)
        .select();
      expectBlocked(res);

      await w.adminClient.from('quick_messages').delete().eq('id', qm!.id);
    });
  });

  describe('DELETE', () => {
    it('Creator can delete quick message', async () => {
      const { data: qm } = await w.adminClient
        .from('quick_messages')
        .insert({
          user_id: w.team1.super.id,
          created_by: w.team1.super.id,
          content: 'To delete',
        })
        .select()
        .single();

      const res = await w.team1.super.client
        .from('quick_messages')
        .delete()
        .eq('id', qm!.id)
        .select();
      expectRows(res, 1);
    });
  });
});
