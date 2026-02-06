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

describe('texter_settings RLS', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('Texter can see own settings', async () => {
      const res = await w.team1.texter.client
        .from('texter_settings')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectRows(res, 1);
    });

    it('Owner can see their Texters settings', async () => {
      const res = await w.team1.owner.client
        .from('texter_settings')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectRows(res, 1);
    });

    it('Super cannot see Texter settings', async () => {
      const res = await w.team1.super.client
        .from('texter_settings')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectNoRows(res);
    });

    it('Other team Owner cannot see Texter settings', async () => {
      const res = await w.team2.owner.client
        .from('texter_settings')
        .select('*')
        .eq('user_id', w.team1.texter.id);
      expectNoRows(res);
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Owner can create settings for their Texter', async () => {
      // First need a texter without settings — use texter2
      const res = await w.team2.owner.client
        .from('texter_settings')
        .insert({ user_id: w.team2.texter.id })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('texter_settings').delete().eq('id', res.data.id);
      }
    });

    it('Texter cannot create own settings', async () => {
      const res = await w.team2.texter.client
        .from('texter_settings')
        .insert({ user_id: w.team2.texter.id })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Owner cannot create settings for other teams Texter', async () => {
      const res = await w.team1.owner.client
        .from('texter_settings')
        .insert({ user_id: w.team2.texter.id })
        .select()
        .single();
      expectRLSError(res);
    });
  });

  // ------------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------------
  describe('UPDATE', () => {
    it('Owner can update their Texters settings', async () => {
      const res = await w.team1.owner.client
        .from('texter_settings')
        .update({ can_send_images: false })
        .eq('user_id', w.team1.texter.id)
        .select();
      expectRows(res, 1);
      // Restore
      await w.adminClient
        .from('texter_settings')
        .update({ can_send_images: true })
        .eq('user_id', w.team1.texter.id);
    });

    it('Texter cannot update own settings', async () => {
      const res = await w.team1.texter.client
        .from('texter_settings')
        .update({ can_send_images: false })
        .eq('user_id', w.team1.texter.id)
        .select();
      expectBlocked(res);
    });
  });
});
