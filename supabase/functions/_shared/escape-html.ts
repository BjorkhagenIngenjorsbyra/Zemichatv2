/**
 * Escape user-supplied content before interpolating into HTML email bodies.
 * Covers the five characters that can break out of attribute or text
 * contexts: & < > " '
 *
 * Audit fix #22.
 */
export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate an invitation link is on the production domain before placing
 * it inside a clickable href. Stops Owner-controlled `inviteLink` values
 * from being used as a phishing vector through the Resend-rendered email.
 *
 * Returns the link unchanged when valid, otherwise null.
 */
export function isAllowedInviteLink(link: string | null | undefined): boolean {
  if (typeof link !== 'string' || link.length === 0 || link.length > 1024) {
    return false;
  }
  try {
    const u = new URL(link);
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'app.zemichat.com') return false;
    if (!u.pathname.startsWith('/invite/')) return false;
    return true;
  } catch {
    return false;
  }
}
