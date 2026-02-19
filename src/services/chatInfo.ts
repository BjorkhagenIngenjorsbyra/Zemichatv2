// Zemichat v2 – Chat info service

import { supabase } from './supabase';

/**
 * Update a group chat's name.
 */
export async function updateChatName(chatId: string, name: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('chats')
    .update({ name } as never)
    .eq('id', chatId);

  return { error: error ? new Error(error.message) : null };
}

/**
 * Update a group chat's description.
 */
export async function updateChatDescription(chatId: string, description: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('chats')
    .update({ description } as never)
    .eq('id', chatId);

  return { error: error ? new Error(error.message) : null };
}

/**
 * Get shared media (images) from a chat.
 */
export async function getSharedMedia(chatId: string, limit = 30): Promise<{ urls: string[] }> {
  const { data } = await supabase
    .from('messages')
    .select('media_url')
    .eq('chat_id', chatId)
    .eq('type', 'image')
    .is('deleted_at', null)
    .not('media_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  const urls = (data || []).map((m: { media_url: string | null }) => m.media_url).filter(Boolean) as string[];
  return { urls };
}

/**
 * Leave a group chat (set left_at on chat_members).
 */
export async function leaveChat(chatId: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error('Not authenticated') };

  const { error } = await supabase
    .from('chat_members')
    .update({ left_at: new Date().toISOString() } as never)
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  return { error: error ? new Error(error.message) : null };
}

/**
 * Add a member to a chat.
 */
export async function addMemberToChat(chatId: string, userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('chat_members')
    .insert({ chat_id: chatId, user_id: userId } as never);

  return { error: error ? new Error(error.message) : null };
}
