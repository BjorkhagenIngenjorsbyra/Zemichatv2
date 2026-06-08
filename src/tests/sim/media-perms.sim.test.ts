/**
 * Simulation: server-side enforcement of per-texter media permissions.
 *
 * The owner's media toggles must hold even against a direct API call (not just
 * the UI). Verifies the messages INSERT policy rejects a disallowed media type
 * for a texter, allows plain text regardless, and never restricts non-texters.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSimWorld, type SimWorld } from './agent';

let sim: SimWorld;
// owner↔texter chat (texter1 + owner1 are members).
const CHAT = 'cccc0004-0000-0000-0000-000000000004';

async function setVoice(allowed: boolean) {
  await sim.world.adminClient
    .from('texter_settings')
    .update({ can_send_voice: allowed } as never)
    .eq('user_id', sim.team1.texter.id);
}

beforeAll(async () => {
  sim = await getSimWorld();
});

afterAll(async () => {
  await setVoice(true);
});

describe('server-side media permission enforcement', () => {
  it('texter CANNOT insert a voice message when can_send_voice is false', async () => {
    await setVoice(false);
    const res = await sim.team1.texter.sendMessage(CHAT, 'blocked voice', { type: 'voice' });
    expect(res.error).not.toBeNull();
  });

  it('texter CAN still send a plain text message when voice is disabled', async () => {
    const res = await sim.team1.texter.sendMessage(CHAT, 'allowed text', { type: 'text' });
    expect(res.error).toBeNull();
  });

  it('texter CAN insert a voice message once can_send_voice is true', async () => {
    await setVoice(true);
    const res = await sim.team1.texter.sendMessage(CHAT, 'allowed voice', { type: 'voice' });
    expect(res.error).toBeNull();
  });

  it('owner is never restricted by texter media toggles', async () => {
    await setVoice(false);
    const res = await sim.team1.owner.sendMessage(CHAT, 'owner voice', { type: 'voice' });
    expect(res.error).toBeNull();
  });
});
