/**
 * Centralized display name resolution with consistent fallback chain:
 * displayName → zemiNumber → 'User'
 *
 * Prevents "Utan namn" / "?" from appearing across the app.
 */

interface UserLike {
  id?: string | null;
  display_name?: string | null;
  zemi_number?: string | null;
}

/** Get display name with fallback to Zemi-nummer */
export const getDisplayName = (user: UserLike | null | undefined): string => {
  if (!user) return 'User';
  return user.display_name || user.zemi_number || 'User';
};

/** Get avatar initial from display name (never returns '?') */
export const getInitial = (user: UserLike | null | undefined): string => {
  const name = getDisplayName(user);
  return name.charAt(0).toUpperCase();
};

/**
 * Generate a consistent avatar gradient color based on user identity.
 * Same user always gets the same color — no randomness.
 */
const AVATAR_COLORS = [
  'linear-gradient(135deg, #7c3aed, #a855f7)', // purple
  'linear-gradient(135deg, #2563eb, #60a5fa)', // blue
  'linear-gradient(135deg, #059669, #34d399)', // green
  'linear-gradient(135deg, #d97706, #fbbf24)', // amber
  'linear-gradient(135deg, #dc2626, #f87171)', // red
  'linear-gradient(135deg, #db2777, #f472b6)', // pink
  'linear-gradient(135deg, #0891b2, #22d3ee)', // cyan
  'linear-gradient(135deg, #7c2d12, #ea580c)', // orange
];

export const getAvatarColor = (user: UserLike | null | undefined): string => {
  // Hash by stable identifier (user.id or zemi_number) so the same user
  // always gets the same color, even if display_name is missing in some
  // contexts (e.g. /new-chat resolves names differently than chat list).
  const seed = user?.id || user?.zemi_number || getDisplayName(user);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
