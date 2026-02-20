import { supabase } from './supabase';

interface UnreadChatResult {
  /** Number of chats with unread messages */
  count: number;
  /** Total sum of all unread messages (for app badge) */
  total: number;
}

/**
 * Get unread chat count and total unread message count for the current user.
 */
export async function getUnreadChatCount(): Promise<UnreadChatResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { count: 0, total: 0 };

  const { data, error } = await supabase
    .from('chat_members')
    .select('unread_count')
    .eq('user_id', user.id)
    .is('left_at', null);

  if (error || !data) return { count: 0, total: 0 };

  let count = 0;
  let total = 0;

  for (const row of data) {
    const unread = (row as { unread_count: number }).unread_count;
    if (unread > 0) {
      count++;
    }
    total += unread;
  }

  return { count, total };
}

/**
 * Get number of pending incoming friend requests.
 */
export async function getPendingFriendRequestCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('friendships')
    .select('id', { count: 'exact', head: true })
    .eq('addressee_id', user.id)
    .eq('status', 'pending');

  if (error) return 0;
  return count ?? 0;
}

const WALL_LAST_VISITED_KEY = 'zemichat-wall-last-visited';

/**
 * Check if there are new wall posts since the user last visited.
 */
export async function hasNewWallPosts(teamId: string): Promise<boolean> {
  const lastVisited = localStorage.getItem(WALL_LAST_VISITED_KEY);
  if (!lastVisited) return true; // Never visited — show dot

  const { count, error } = await supabase
    .from('wall_posts')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .gt('created_at', lastVisited);

  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * Mark wall as visited (stores current timestamp in localStorage).
 */
export function markWallVisited(): void {
  localStorage.setItem(WALL_LAST_VISITED_KEY, new Date().toISOString());
}
