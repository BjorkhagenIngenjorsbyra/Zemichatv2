/**
 * E2E Tests for Call Functionality
 *
 * Tests the full call flow against deployed Supabase:
 * 1. Creating call logs (RLS + DB)
 * 2. Getting Agora tokens (Edge Function)
 * 3. Call signaling (Realtime signals)
 * 4. Permission checks (texter restrictions)
 *
 * Run: npm run test:e2e
 * Requires .env.e2e with test credentials.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  isE2EConfigured,
  getE2ETestWorld,
  type E2ETestWorld,
} from './helpers/setup';

// Skip entire suite if E2E not configured
const describeE2E = isE2EConfigured() ? describe : describe.skip;

describeE2E('Call E2E', () => {
  let world: E2ETestWorld;

  // Track IDs for cleanup
  const createdCallLogIds: string[] = [];
  const createdSignalIds: string[] = [];

  beforeAll(async () => {
    world = await getE2ETestWorld();
  });

  afterAll(async () => {
    // Clean up call signals
    if (createdSignalIds.length > 0 && world?.user1?.client) {
      await world.user1.client
        .from('call_signals')
        .delete()
        .in('id', createdSignalIds);
    }

    // Clean up call logs (use service client if available, otherwise user client)
    if (createdCallLogIds.length > 0) {
      const cleanupClient = world?.serviceClient || world?.user1?.client;
      if (cleanupClient) {
        await cleanupClient
          .from('call_logs')
          .delete()
          .in('id', createdCallLogIds);
      }
    }
  });

  // -----------------------------------------------------------------
  // 1. Call Log Creation
  // -----------------------------------------------------------------

  it('user1 can create a voice call log in shared chat', async () => {
    const { data, error } = await world.user1.client
      .from('call_logs')
      .insert({
        chat_id: world.chatId,
        initiator_id: world.user1.id,
        type: 'voice',
        status: 'missed',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBeDefined();
    expect(data!.type).toBe('voice');
    expect(data!.initiator_id).toBe(world.user1.id);

    createdCallLogIds.push(data!.id);
  });

  it('user2 can create a video call log in shared chat', async () => {
    const { data, error } = await world.user2.client
      .from('call_logs')
      .insert({
        chat_id: world.chatId,
        initiator_id: world.user2.id,
        type: 'video',
        status: 'missed',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.type).toBe('video');

    createdCallLogIds.push(data!.id);
  });

  it('user1 cannot create a call log impersonating user2', async () => {
    const { data, error } = await world.user1.client
      .from('call_logs')
      .insert({
        chat_id: world.chatId,
        initiator_id: world.user2.id, // Impersonation
        type: 'voice',
        status: 'missed',
      })
      .select()
      .single();

    // Should be blocked by RLS: initiator_id = auth.uid()
    expect(error).not.toBeNull();
  });

  // -----------------------------------------------------------------
  // 2. Agora Token (Edge Function)
  // -----------------------------------------------------------------

  it('user1 can get an Agora token for the shared chat', async () => {
    const { data, error } = await world.user1.client.functions.invoke(
      'agora-token',
      {
        body: { chatId: world.chatId, callType: 'voice' },
      },
    );

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.token).toBeDefined();
    expect(typeof data.token).toBe('string');
    expect(data.token.startsWith('006')).toBe(true);
    expect(data.appId).toBeDefined();
    expect(data.channel).toBe(world.chatId);
    expect(typeof data.uid).toBe('number');
  });

  it('user2 can get an Agora token for the shared chat', async () => {
    const { data, error } = await world.user2.client.functions.invoke(
      'agora-token',
      {
        body: { chatId: world.chatId, callType: 'video' },
      },
    );

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.token).toBeDefined();
    expect(data.token.startsWith('006')).toBe(true);
  });

  it('rejects invalid chatId format', async () => {
    const { data, error } = await world.user1.client.functions.invoke(
      'agora-token',
      {
        body: { chatId: 'not-a-uuid', callType: 'voice' },
      },
    );

    // Edge Function should return 400
    expect(error).not.toBeNull();
  });

  it('rejects invalid callType', async () => {
    const { data, error } = await world.user1.client.functions.invoke(
      'agora-token',
      {
        body: { chatId: world.chatId, callType: 'hologram' },
      },
    );

    expect(error).not.toBeNull();
  });

  it('user1 and user2 get different UIDs for the same channel', async () => {
    const [res1, res2] = await Promise.all([
      world.user1.client.functions.invoke('agora-token', {
        body: { chatId: world.chatId, callType: 'voice' },
      }),
      world.user2.client.functions.invoke('agora-token', {
        body: { chatId: world.chatId, callType: 'voice' },
      }),
    ]);

    expect(res1.error).toBeNull();
    expect(res2.error).toBeNull();
    expect(res1.data.uid).not.toBe(res2.data.uid);
    // Same channel
    expect(res1.data.channel).toBe(res2.data.channel);
  });

  // -----------------------------------------------------------------
  // 3. Call Signaling
  // -----------------------------------------------------------------

  it('user1 can create a ring signal', async () => {
    // First create a call log for the signal
    const { data: callLog } = await world.user1.client
      .from('call_logs')
      .insert({
        chat_id: world.chatId,
        initiator_id: world.user1.id,
        type: 'voice',
        status: 'missed',
      })
      .select()
      .single();

    expect(callLog).not.toBeNull();
    createdCallLogIds.push(callLog!.id);

    // Create signal
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const { data: signal, error } = await world.user1.client
      .from('call_signals')
      .insert({
        chat_id: world.chatId,
        call_log_id: callLog!.id,
        caller_id: world.user1.id,
        signal_type: 'ring',
        expires_at: expiresAt,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(signal).not.toBeNull();
    expect(signal!.signal_type).toBe('ring');

    createdSignalIds.push(signal!.id);
  });

  it('user2 can see signals in their chat', async () => {
    const { data, error } = await world.user2.client
      .from('call_signals')
      .select('*')
      .eq('chat_id', world.chatId);

    expect(error).toBeNull();
    // Should see at least the signal created above
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it('caller can delete their own signals', async () => {
    if (createdSignalIds.length === 0) return;

    const signalId = createdSignalIds[createdSignalIds.length - 1];
    const { error } = await world.user1.client
      .from('call_signals')
      .delete()
      .eq('id', signalId);

    expect(error).toBeNull();

    // Remove from cleanup list
    createdSignalIds.pop();
  });

  // -----------------------------------------------------------------
  // 4. Call Status Update
  // -----------------------------------------------------------------

  it('call status can be updated to answered', async () => {
    if (createdCallLogIds.length === 0) return;

    const callLogId = createdCallLogIds[0];
    const { error } = await world.user1.client
      .from('call_logs')
      .update({ status: 'answered' })
      .eq('id', callLogId);

    expect(error).toBeNull();

    // Verify the update
    const { data } = await world.user1.client
      .from('call_logs')
      .select('status')
      .eq('id', callLogId)
      .single();

    expect(data?.status).toBe('answered');
  });

  // -----------------------------------------------------------------
  // 5. Call Push (Edge Function)
  // -----------------------------------------------------------------

  it('call-push Edge Function responds to ring action', async () => {
    // Create a call log first
    const { data: callLog } = await world.user1.client
      .from('call_logs')
      .insert({
        chat_id: world.chatId,
        initiator_id: world.user1.id,
        type: 'voice',
        status: 'missed',
      })
      .select()
      .single();

    expect(callLog).not.toBeNull();
    createdCallLogIds.push(callLog!.id);

    const { data, error } = await world.user1.client.functions.invoke(
      'call-push',
      {
        body: {
          chatId: world.chatId,
          callLogId: callLog!.id,
          callType: 'voice',
          action: 'ring',
        },
      },
    );

    // Should succeed (may send 0 pushes if no tokens registered, but no error)
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(typeof data.sent).toBe('number');
  });

  it('call-push Edge Function responds to cancel action', async () => {
    if (createdCallLogIds.length === 0) return;

    const callLogId = createdCallLogIds[createdCallLogIds.length - 1];
    const { data, error } = await world.user1.client.functions.invoke(
      'call-push',
      {
        body: {
          chatId: world.chatId,
          callLogId,
          callType: 'voice',
          action: 'cancel',
        },
      },
    );

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(typeof data.sent).toBe('number');
  });
});
