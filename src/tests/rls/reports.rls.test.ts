import { describe, it, beforeAll, expect } from 'vitest';
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

    it('Owner can move a report to resolved/dismissed', async () => {
      const { data: report } = await w.adminClient
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          reported_user_id: w.team2.texter.id,
          reason: 'Test',
          category: 'spam',
          status: 'pending',
        })
        .select()
        .single();

      const res1 = await w.team1.owner.client
        .from('reports')
        .update({ status: 'resolved', reviewed_by: w.team1.owner.id })
        .eq('id', report!.id)
        .select();
      expectRows(res1, 1);

      const res2 = await w.team1.owner.client
        .from('reports')
        .update({ status: 'dismissed', reviewed_by: w.team1.owner.id })
        .eq('id', report!.id)
        .select();
      expectRows(res2, 1);

      await w.adminClient.from('reports').delete().eq('id', report!.id);
    });

    it('Owner cannot rewrite a report back to pending via WITH CHECK', async () => {
      const { data: report } = await w.adminClient
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          reported_user_id: w.team2.texter.id,
          reason: 'Test',
          status: 'reviewed',
        })
        .select()
        .single();

      const res = await w.team1.owner.client
        .from('reports')
        .update({ status: 'pending', reviewed_by: w.team1.owner.id })
        .eq('id', report!.id)
        .select();
      // Either RLS-rejected outright or zero rows updated.
      expectBlocked(res);

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

  // ------------------------------------------------------------------
  // CATEGORY + DESCRIPTION + CHAT TARGET (extended schema)
  // ------------------------------------------------------------------
  describe('extended fields', () => {
    it('User can submit a report with category + description', async () => {
      const res = await w.team1.texter.client
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          reported_user_id: w.team2.texter.id,
          category: 'harassment',
          description: 'They keep calling me names',
          reason: 'Harassment',
          status: 'pending',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        // target_type generated column should reflect the user target
        // unless message > chat > user wins (here only user is set).
        expect((res.data as { target_type: string | null }).target_type).toBe('user');
        await w.adminClient.from('reports').delete().eq('id', res.data.id);
      }
    });

    it('Reporter can submit a chat-targeted report', async () => {
      const res = await w.team1.texter.client
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          reported_chat_id: w.chats.texterToTexter,
          category: 'spam',
          reason: 'Spam',
          status: 'pending',
        })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        expect((res.data as { target_type: string | null }).target_type).toBe('chat');
        await w.adminClient.from('reports').delete().eq('id', res.data.id);
      }
    });

    it('Description longer than 2000 chars is rejected', async () => {
      const huge = 'x'.repeat(2001);
      const res = await w.team1.texter.client
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          reported_user_id: w.team2.texter.id,
          category: 'other',
          description: huge,
          reason: 'Other',
          status: 'pending',
        })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Cannot insert a report with NO target at all', async () => {
      const res = await w.team1.texter.client
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          category: 'other',
          reason: 'Other',
          status: 'pending',
        })
        .select()
        .single();
      expectRLSError(res);
    });
  });

  // ------------------------------------------------------------------
  // ESCALATION (3-distinct-reporters threshold)
  // ------------------------------------------------------------------
  describe('escalation trigger', () => {
    it('Three distinct reporters against the same user flips them all to escalated', async () => {
      // Use 3 different reporters: texter1, super1, owner1 (all in
      // team1) reporting team2.texter. The trigger counts distinct
      // reporter_id values, so we need three different users.
      const inserted: string[] = [];

      const res1 = await w.adminClient
        .from('reports')
        .insert({
          reporter_id: w.team1.texter.id,
          reported_user_id: w.team2.texter.id,
          category: 'spam',
          reason: 'Spam',
          status: 'pending',
        })
        .select()
        .single();
      if (res1.data) inserted.push(res1.data.id);

      const res2 = await w.adminClient
        .from('reports')
        .insert({
          reporter_id: w.team1.super.id,
          reported_user_id: w.team2.texter.id,
          category: 'spam',
          reason: 'Spam',
          status: 'pending',
        })
        .select()
        .single();
      if (res2.data) inserted.push(res2.data.id);

      const res3 = await w.adminClient
        .from('reports')
        .insert({
          reporter_id: w.team1.owner.id,
          reported_user_id: w.team2.texter.id,
          category: 'spam',
          reason: 'Spam',
          status: 'pending',
        })
        .select()
        .single();
      if (res3.data) inserted.push(res3.data.id);

      // After the third insert, all reports for team2.texter should be
      // escalated.
      const { data: rows } = await w.adminClient
        .from('reports')
        .select('id, status, escalated_at')
        .eq('reported_user_id', w.team2.texter.id);
      expect(rows).not.toBeNull();
      for (const row of rows ?? []) {
        const r = row as { status: string; escalated_at: string | null };
        expect(r.status).toBe('escalated');
        expect(r.escalated_at).not.toBeNull();
      }

      for (const id of inserted) {
        await w.adminClient.from('reports').delete().eq('id', id);
      }
    });
  });
});
