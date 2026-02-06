import { describe, it, beforeAll } from 'vitest';
import {
  getTestWorld,
  expectRows,
  expectNoRows,
  expectSuccess,
  expectRLSError,
  type TestWorld,
} from './helpers/setup';

let w: TestWorld;

beforeAll(async () => {
  w = await getTestWorld();
});

describe('denied_friend_requests RLS', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('Owner can see denied requests for their Texters', async () => {
      // Seed a denied request
      await w.adminClient
        .from('denied_friend_requests')
        .insert({
          texter_id: w.team1.texter.id,
          denied_user_id: w.team2.super.id,
          denied_by: w.team1.owner.id,
        });

      const res = await w.team1.owner.client
        .from('denied_friend_requests')
        .select('*')
        .eq('texter_id', w.team1.texter.id);
      expectRows(res, 1);

      // Cleanup
      await w.adminClient
        .from('denied_friend_requests')
        .delete()
        .eq('texter_id', w.team1.texter.id)
        .eq('denied_user_id', w.team2.super.id);
    });

    it('Texter cannot see their own denied requests', async () => {
      await w.adminClient
        .from('denied_friend_requests')
        .insert({
          texter_id: w.team1.texter.id,
          denied_user_id: w.team2.super.id,
          denied_by: w.team1.owner.id,
        });

      const res = await w.team1.texter.client
        .from('denied_friend_requests')
        .select('*')
        .eq('texter_id', w.team1.texter.id);
      expectNoRows(res);

      await w.adminClient
        .from('denied_friend_requests')
        .delete()
        .eq('texter_id', w.team1.texter.id)
        .eq('denied_user_id', w.team2.super.id);
    });

    it('Other team Owner cannot see denied requests', async () => {
      await w.adminClient
        .from('denied_friend_requests')
        .insert({
          texter_id: w.team1.texter.id,
          denied_user_id: w.team2.super.id,
          denied_by: w.team1.owner.id,
        });

      const res = await w.team2.owner.client
        .from('denied_friend_requests')
        .select('*')
        .eq('texter_id', w.team1.texter.id);
      expectNoRows(res);

      await w.adminClient
        .from('denied_friend_requests')
        .delete()
        .eq('texter_id', w.team1.texter.id)
        .eq('denied_user_id', w.team2.super.id);
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Owner can deny request for their Texter', async () => {
      const res = await w.team1.owner.client
        .from('denied_friend_requests')
        .insert({
          texter_id: w.team1.texter.id,
          denied_user_id: w.team2.owner.id,
          denied_by: w.team1.owner.id,
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient
          .from('denied_friend_requests')
          .delete()
          .eq('id', res.data.id);
      }
    });

    it('Texter cannot deny requests themselves', async () => {
      const res = await w.team1.texter.client
        .from('denied_friend_requests')
        .insert({
          texter_id: w.team1.texter.id,
          denied_user_id: w.team2.owner.id,
          denied_by: w.team1.texter.id,
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Owner cannot deny for other team Texters', async () => {
      const res = await w.team1.owner.client
        .from('denied_friend_requests')
        .insert({
          texter_id: w.team2.texter.id,
          denied_user_id: w.team1.super.id,
          denied_by: w.team1.owner.id,
        })
        .select()
        .single();
      expectRLSError(res);
    });
  });

  // ------------------------------------------------------------------
  // DELETE
  // ------------------------------------------------------------------
  describe('DELETE', () => {
    it('Owner can remove denial for their Texter', async () => {
      const { data: d } = await w.adminClient
        .from('denied_friend_requests')
        .insert({
          texter_id: w.team1.texter.id,
          denied_user_id: w.team2.owner.id,
          denied_by: w.team1.owner.id,
        })
        .select()
        .single();

      const res = await w.team1.owner.client
        .from('denied_friend_requests')
        .delete()
        .eq('id', d!.id)
        .select();
      expectRows(res, 1);
    });
  });
});
