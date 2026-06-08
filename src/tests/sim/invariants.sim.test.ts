/**
 * Simulation scenario: the safety invariants that define ZemiChat's whole point.
 * These must hold no matter what — exercised through real role clients + RLS.
 */
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { getSimWorld, type SimWorld } from './agent';

let sim: SimWorld;

beforeAll(async () => {
  sim = await getSimWorld();
});

describe('Safety invariants', () => {
  it('Super-only chat is NEVER visible to the Owner', async () => {
    const superChat = sim.world.chats.superToSuper;
    // The Supers in the chat can see its messages...
    const superView = await sim.team1.super.visibleMessages(superChat);
    expect(superView.length).toBeGreaterThan(0);
    // ...but the Owner cannot — Super privacy when no Texter is involved.
    const ownerView = await sim.team1.owner.visibleMessages(superChat);
    expect(ownerView.length).toBe(0);
  });

  it("Owner always sees a Texter's deleted message; the Super does not", async () => {
    const chat = sim.world.chats.superToTexter;
    const sent = await sim.team1.texter.sendMessage(chat, 'sim-inv: hemlig rad');
    expect(sent.error).toBeNull();
    const id = sent.data!.id;
    const del = await sim.team1.texter.deleteMessage(id);
    expect(del.error).toBeNull();

    expect(await sim.team1.owner.canSee(id)).toBe(true);
    expect(await sim.team1.super.canSee(id)).toBe(false);
  });

  describe('SOS can NEVER be disabled', () => {
    afterAll(async () => {
      // Restore capabilities + clean up alerts (per-file reset also covers this).
      await sim.world.adminClient
        .from('texter_settings')
        .update({
          can_send_images: true, can_send_voice: true, can_send_video: true,
          can_send_documents: true, can_share_location: true, can_voice_call: true,
          can_video_call: true, can_screen_share: true, can_access_wall: true,
          push_enabled: true,
        })
        .eq('user_id', sim.team1.texter.id);
      await sim.world.adminClient
        .from('sos_alerts')
        .delete()
        .eq('texter_id', sim.team1.texter.id);
    });

    it('Texter can raise SOS even with EVERY capability revoked by the Owner', async () => {
      // Owner strips every togglable capability from the Texter.
      const revoke = await sim.world.adminClient
        .from('texter_settings')
        .update({
          can_send_images: false, can_send_voice: false, can_send_video: false,
          can_send_documents: false, can_share_location: false, can_voice_call: false,
          can_video_call: false, can_screen_share: false, can_access_wall: false,
          push_enabled: false,
        })
        .eq('user_id', sim.team1.texter.id);
      expect(revoke.error).toBeNull();

      // SOS must still go through (location is an optional PostGIS geography).
      const sos = await sim.team1.texter.sendSos();
      expect(sos.error).toBeNull();
      expect(sos.data?.id).toBeTruthy();

      // And the Owner must see it (oversight), via the Owner's own client.
      let ownerSees = 0;
      for (let i = 0; i < 15; i++) {
        const seen = await sim.team1.owner.client
          .from('sos_alerts')
          .select('id')
          .eq('texter_id', sim.team1.texter.id);
        ownerSees = seen.data?.length ?? 0;
        if (ownerSees > 0) break;
        await new Promise((r) => setTimeout(r, 120));
      }
      expect(ownerSees).toBeGreaterThan(0);
    });
  });
});
