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

describe('reports RLS', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('Reporter can see own reports', async () => {
      await w.adminClient.from('reports').insert({
        reporter_id: w.team1.texter.id,
        reported_user_id: w.team2.texter.id,
        reason: 'Spam',
        status: 'pending',
      });

      const res = await w.team1.texter.client
        .from('reports')
        .select('*')
        .eq('reporter_id', w.team1.texter.id);
      expectRows(res, 1);

      await w.adminClient
        .from('reports')
        .delete()
        .eq('reporter_id', w.team1.texter.id);
    });

    it('Owner can see reports involving their team members (as reporter)', async () => {
      await w.adminClient.from('reports').insert({
        reporter_id: w.team1.texter.id,
        reported_user_id: w.team2.texter.id,
        reason: 'Spam',
        status: 'pending',
      });

      const res = await w.team1.owner.client
        .from('reports')
        .select('*')
        .eq('reporter_id', w.team1.texter.id);
      expectRows(res, 1);

      await w.adminClient
        .from('reports')
        .delete()
        .eq('reporter_id', w.team1.texter.id);
    });

    it('Owner can see reports where team member is reported', async () => {
      await w.adminClient.from('reports').insert({
        reporter_id: w.team2.texter.id,
        reported_user_id: w.team1.texter.id,
        reason: 'Bullying',
        status: 'pending',
      });

      const res = await w.team1.owner.client
        .from('reports')
        .select('*')
        .eq('reported_user_id', w.team1.texter.id);
      expectRows(res, 1);

      await w.adminClient
        .from('reports')
        .delete()
        .eq('reported_user_id', w.team1.texter.id);
    });

    it('Stranger cannot see report', async () => {
      await w.adminClient.from('reports').insert({
        reporter_id: w.team1.texter.id,
        reported_user_id: w.team2.texter.id,
        reason: 'Spam',
        status: 'pending',
      });

      const res = await w.team1.super.client
        .from('reports')
        .select('*')
        .eq('reporter_id', w.team1.texter.id);
      expectNoRows(res);

      await w.adminClient
        .from('reports')
        .delete()
        .eq('reporter_id', w.team1.texter.id);
    });
  });

  // ------------------------------------------------------------------
  // INSERT
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Active user can create report (reporter = self, status = pending)', async () => {
      const res = await w.team1.texter.client
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          reported_user_id: w.team2.texter.id,
          reason: 'Inappropriate content',
          status: 'pending',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('reports').delete().eq('id', res.data.id);
      }
    });

    it('Cannot create report as someone else', async () => {
      const res = await w.team1.texter.client
        .from('reports')
        .insert({
          reporter_id: w.team1.super.id, // impersonation
          reported_user_id: w.team2.texter.id,
          reason: 'Test',
          status: 'pending',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Cannot create report with non-pending status', async () => {
      const res = await w.team1.texter.client
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          reported_user_id: w.team2.texter.id,
          reason: 'Test',
          status: 'reviewed',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Deactivated user cannot create report', async () => {
      execSQL(`UPDATE public.users SET is_active = false WHERE id = '${w.team1.texter.id}';`);
      try {
        const res = await w.team1.texter.client
          .from('reports')
          .insert({
            reporter_id: w.team1.texter.id,
            reported_user_id: w.team2.texter.id,
            reason: 'Test',
            status: 'pending',
          })
          .select()
          .single();
        expectRLSError(res);
      } finally {
        execSQL(`UPDATE public.users SET is_active = true WHERE id = '${w.team1.texter.id}';`);
      }
    });
  });

  // ------------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------------
  describe('UPDATE', () => {
    it('Owner can mark report as reviewed', async () => {
      const { data: report } = await w.adminClient
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          reported_user_id: w.team2.texter.id,
          reason: 'Test',
          status: 'pending',
        })
        .select()
        .single();

      const res = await w.team1.owner.client
        .from('reports')
        .update({ status: 'reviewed', reviewed_by: w.team1.owner.id })
        .eq('id', report!.id)
        .select();
      expectRows(res, 1);

      await w.adminClient.from('reports').delete().eq('id', report!.id);
    });

    it('Non-owner cannot update report', async () => {
      const { data: report } = await w.adminClient
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          reported_user_id: w.team2.texter.id,
          reason: 'Test',
          status: 'pending',
        })
        .select()
        .single();

      const res = await w.team1.super.client
        .from('reports')
        .update({ status: 'reviewed', reviewed_by: w.team1.super.id })
        .eq('id', report!.id)
        .select();
      expectBlocked(res);

      await w.adminClient.from('reports').delete().eq('id', report!.id);
    });
  });
});
