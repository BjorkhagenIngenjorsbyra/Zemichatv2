import { describe, it, beforeAll } from 'vitest';
import {
  getTestWorld,
  expectRows,
  expectNoRows,
  expectSuccess,
  expectRLSError,
  expectBlocked,
  execSQL,
  IDS,
  type TestWorld,
} from './helpers/setup';

let w: TestWorld;

beforeAll(async () => {
  w = await getTestWorld();
});

describe('sos_alerts RLS — CRITICAL', () => {
  // ------------------------------------------------------------------
  // SELECT
  // ------------------------------------------------------------------
  describe('SELECT', () => {
    it('Texter sees own SOS alerts', async () => {
      // Seed an SOS alert
      await w.adminClient
        .from('sos_alerts')
        .insert({ texter_id: w.team1.texter.id });

      const res = await w.team1.texter.client
        .from('sos_alerts')
        .select('*')
        .eq('texter_id', w.team1.texter.id);
      expectRows(res, 1);

      await w.adminClient
        .from('sos_alerts')
        .delete()
        .eq('texter_id', w.team1.texter.id);
    });

    it('Owner sees their Texters SOS alerts', async () => {
      await w.adminClient
        .from('sos_alerts')
        .insert({ texter_id: w.team1.texter.id });

      const res = await w.team1.owner.client
        .from('sos_alerts')
        .select('*')
        .eq('texter_id', w.team1.texter.id);
      expectRows(res, 1);

      await w.adminClient
        .from('sos_alerts')
        .delete()
        .eq('texter_id', w.team1.texter.id);
    });

    it('Other team Owner cannot see SOS alerts', async () => {
      await w.adminClient
        .from('sos_alerts')
        .insert({ texter_id: w.team1.texter.id });

      const res = await w.team2.owner.client
        .from('sos_alerts')
        .select('*')
        .eq('texter_id', w.team1.texter.id);
      expectNoRows(res);

      await w.adminClient
        .from('sos_alerts')
        .delete()
        .eq('texter_id', w.team1.texter.id);
    });

    it('Super cannot see SOS alerts', async () => {
      await w.adminClient
        .from('sos_alerts')
        .insert({ texter_id: w.team1.texter.id });

      const res = await w.team1.super.client
        .from('sos_alerts')
        .select('*')
        .eq('texter_id', w.team1.texter.id);
      expectNoRows(res);

      await w.adminClient
        .from('sos_alerts')
        .delete()
        .eq('texter_id', w.team1.texter.id);
    });
  });

  // ------------------------------------------------------------------
  // INSERT — CRITICAL: SOS can NEVER be disabled
  // ------------------------------------------------------------------
  describe('INSERT', () => {
    it('Texter can send SOS alert', async () => {
      const res = await w.team1.texter.client
        .from('sos_alerts')
        .insert({ texter_id: w.team1.texter.id })
        .select()
        .single();
      expectSuccess(res);
      if (res.data) {
        await w.adminClient.from('sos_alerts').delete().eq('id', res.data.id);
      }
    });

    it('DEACTIVATED Texter CAN still send SOS — CRITICAL SAFETY', async () => {
      execSQL(`UPDATE public.users SET is_active = false WHERE id = '${w.team1.texter.id}';`);
      try {
        const res = await w.team1.texter.client
          .from('sos_alerts')
          .insert({ texter_id: w.team1.texter.id })
          .select()
          .single();
        expectSuccess(res);
        if (res.data) {
          await w.adminClient.from('sos_alerts').delete().eq('id', res.data.id);
        }
      } finally {
        execSQL(`UPDATE public.users SET is_active = true WHERE id = '${w.team1.texter.id}';`);
      }
    });

    it('Owner CANNOT send SOS alert', async () => {
      const res = await w.team1.owner.client
        .from('sos_alerts')
        .insert({ texter_id: w.team1.owner.id })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Super CANNOT send SOS alert', async () => {
      const res = await w.team1.super.client
        .from('sos_alerts')
        .insert({ texter_id: w.team1.super.id })
        .select()
        .single();
      expectRLSError(res);
    });

    it('Texter cannot send SOS as someone else', async () => {
      const res = await w.team1.texter.client
        .from('sos_alerts')
        .insert({ texter_id: w.team2.texter.id })
        .select()
        .single();
      expectRLSError(res);
    });
  });

  // ------------------------------------------------------------------
  // UPDATE (acknowledge)
  // ------------------------------------------------------------------
  describe('UPDATE acknowledge', () => {
    it('Owner can acknowledge SOS for their Texter', async () => {
      const { data: alert } = await w.adminClient
        .from('sos_alerts')
        .insert({ texter_id: w.team1.texter.id })
        .select()
        .single();

      const res = await w.team1.owner.client
        .from('sos_alerts')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: w.team1.owner.id,
        })
        .eq('id', alert!.id)
        .select();
      expectRows(res, 1);

      await w.adminClient.from('sos_alerts').delete().eq('id', alert!.id);
    });

    it('Texter cannot acknowledge own SOS', async () => {
      const { data: alert } = await w.adminClient
        .from('sos_alerts')
        .insert({ texter_id: w.team1.texter.id })
        .select()
        .single();

      const res = await w.team1.texter.client
        .from('sos_alerts')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: w.team1.texter.id,
        })
        .eq('id', alert!.id)
        .select();
      expectBlocked(res);

      await w.adminClient.from('sos_alerts').delete().eq('id', alert!.id);
    });

    it('Other team Owner cannot acknowledge SOS', async () => {
      const { data: alert } = await w.adminClient
        .from('sos_alerts')
        .insert({ texter_id: w.team1.texter.id })
        .select()
        .single();

      const res = await w.team2.owner.client
        .from('sos_alerts')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: w.team2.owner.id,
        })
        .eq('id', alert!.id)
        .select();
      expectBlocked(res);

      await w.adminClient.from('sos_alerts').delete().eq('id', alert!.id);
    });
  });
});
