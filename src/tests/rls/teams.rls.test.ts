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

describe('teams RLS', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('Owner can see own team', async () => {
      const res = await w.team1.owner.client
        .from('teams')
        .select('*')
        .eq('id', w.team1.id);
      expectRows(res, 1);
    });

    it('Super can see own team', async () => {
      const res = await w.team1.super.client
        .from('teams')
        .select('*')
        .eq('id', w.team1.id);
      expectRows(res, 1);
    });

    it('Texter can see own team', async () => {
      const res = await w.team1.texter.client
        .from('teams')
        .select('*')
        .eq('id', w.team1.id);
      expectRows(res, 1);
    });

    it('Owner cannot see other team', async () => {
      const res = await w.team1.owner.client
        .from('teams')
        .select('*')
        .eq('id', w.team2.id);
      expectNoRows(res);
    });

    it('Texter cannot see other team', async () => {
      const res = await w.team1.texter.client
        .from('teams')
        .select('*')
        .eq('id', w.team2.id);
      expectNoRows(res);
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Owner can create team with self as owner', async () => {
      // Note: .select() would fail because the new team doesn't match
      // teams_select_member (user's team_id is their existing team).
      // This is a known PostgREST behaviour — INSERT succeeds, but the
      // returning SELECT is blocked by RLS. So we test without .select().
      const teamId = crypto.randomUUID();
      const res = await w.team1.owner.client
        .from('teams')
        .insert({ id: teamId, name: 'New Team', owner_id: w.team1.owner.id, plan: 'free' });
      expectSuccess(res);
      // Cleanup
      await w.adminClient.from('teams').delete().eq('id', teamId);
    });

    it('Cannot create team with someone else as owner', async () => {
      const res = await w.team1.owner.client
        .from('teams')
        .insert({ name: 'Hijack Team', owner_id: w.team2.owner.id, plan: 'free' });
      expectRLSError(res);
    });

    it('Texter can create team with self as owner (becomes owner of new team)', async () => {
      // The policy only checks owner_id = auth.uid(), not role
      const teamId = crypto.randomUUID();
      const res = await w.team1.texter.client
        .from('teams')
        .insert({ id: teamId, name: 'Texter Team', owner_id: w.team1.texter.id, plan: 'free' });
      expectSuccess(res);
      await w.adminClient.from('teams').delete().eq('id', teamId);
    });
  });

  // ------------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------------
  describe('UPDATE', () => {
    it('Owner can update own team', async () => {
      const res = await w.team1.owner.client
        .from('teams')
        .update({ name: 'Team Alpha Updated' })
        .eq('id', w.team1.id)
        .select();
      expectRows(res, 1);
      // Restore
      await w.adminClient
        .from('teams')
        .update({ name: 'Team Alpha' })
        .eq('id', w.team1.id);
    });

    it('Super cannot update team', async () => {
      const res = await w.team1.super.client
        .from('teams')
        .update({ name: 'Hacked' })
        .eq('id', w.team1.id)
        .select();
      expectBlocked(res);
    });

    it('Texter cannot update team', async () => {
      const res = await w.team1.texter.client
        .from('teams')
        .update({ name: 'Hacked' })
        .eq('id', w.team1.id)
        .select();
      expectBlocked(res);
    });
  });
});
