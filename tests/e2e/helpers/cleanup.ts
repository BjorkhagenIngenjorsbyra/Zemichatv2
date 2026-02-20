/**
 * Cleanup helpers for two-user E2E tests.
 *
 * Uses the service-role Supabase client (bypasses RLS) to hard-delete
 * test artifacts so repeated runs start clean.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.e2e' });

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.E2E_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing E2E_SUPABASE_URL or E2E_SUPABASE_SERVICE_KEY in .env.e2e');
  _admin = createClient(url, key);
  return _admin;
}

/** Hard-delete messages created after `afterTimestamp` in a given chat. */
export async function deleteTestMessages(chatId: string, afterTimestamp: string): Promise<void> {
  const admin = getAdmin();
  await admin
    .from('messages')
    .delete()
    .eq('chat_id', chatId)
    .gte('created_at', afterTimestamp);
}

/** Delete call_signals, call_logs, and system messages for a chat after a timestamp. */
export async function deleteTestCallLogs(chatId: string, afterTimestamp: string): Promise<void> {
  const admin = getAdmin();

  // Delete call signals
  await admin
    .from('call_signals')
    .delete()
    .eq('chat_id', chatId)
    .gte('created_at', afterTimestamp);

  // Delete call logs
  await admin
    .from('call_logs')
    .delete()
    .eq('chat_id', chatId)
    .gte('created_at', afterTimestamp);

  // Delete system messages (call-related)
  await admin
    .from('messages')
    .delete()
    .eq('chat_id', chatId)
    .eq('type', 'system')
    .gte('created_at', afterTimestamp);
}

/** Reset unread_count to 0 for both participants in a chat. */
export async function resetUnreadCounts(chatId: string): Promise<void> {
  const admin = getAdmin();
  await admin
    .from('chat_participants')
    .update({ unread_count: 0 })
    .eq('chat_id', chatId);
}
