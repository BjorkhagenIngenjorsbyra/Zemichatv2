/**
 * Simulation scenario: client-assigned message ids enable optimistic, idempotent
 * sends. This is the reliability property the outbox/retry layer relies on — a
 * retried send (same client id) must never create a duplicate.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { getSimWorld, type SimWorld } from './agent';

let sim: SimWorld;

beforeAll(async () => {
  sim = await getSimWorld();
});

describe('Optimistic / idempotent send', () => {
  it('A message can be sent with a client-generated id', async () => {
    const chat = sim.world.chats.superToTexter;
    const clientId = crypto.randomUUID();

    const res = await sim.team1.texter.sendMessage(chat, 'sim-outbox: med klient-id', {
      id: clientId,
    });
    expect(res.error).toBeNull();
    expect(res.data?.id).toBe(clientId);
  });

  it('Re-sending the SAME client id does not create a duplicate', async () => {
    const chat = sim.world.chats.superToTexter;
    const clientId = crypto.randomUUID();
    const body = 'sim-outbox: skickas två gånger';

    const first = await sim.team1.texter.sendMessage(chat, body, { id: clientId });
    expect(first.error).toBeNull();

    // Simulate a retry of the exact same logical message (e.g. the first
    // response was lost on a flaky network). The DB must reject the duplicate id.
    const retry = await sim.team1.texter.sendMessage(chat, body, { id: clientId });
    expect(retry.error).not.toBeNull(); // unique-violation; the app layer maps this to success

    // Exactly one message with that id exists.
    const view = await sim.team1.texter.waitForMessages(chat, (msgs) =>
      msgs.some((m) => m.id === clientId),
    );
    expect(view.filter((m) => m.id === clientId)).toHaveLength(1);
  });
});
