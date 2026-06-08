/**
 * Centralised date/time formatting that follows the app's selected language
 * instead of the browser/OS locale.
 *
 * Every call to `toLocale*String` must pass a locale — an empty/omitted locale
 * uses the runtime default (the browser), so a Swedish user on an English
 * device saw US-style "03:09 PM" times. Routing all formatting through
 * i18n.language keeps dates and times in the same language as the rest of the UI
 * (e.g. Swedish → 24-hour "15:09").
 */
import i18n from '../i18n';

function locale(): string {
  // i18n.language can be a region-qualified tag ("sv-SE") or bare ("sv"); both
  // are valid BCP-47 inputs for Intl. Fall back to Swedish, the primary market.
  return i18n.language || 'sv';
}

/** Time only, e.g. "15:09" (sv) / "3:09 PM" (en). */
export function formatTimeShort(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(locale(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short date, e.g. "12 juni" (sv) / "Jun 12" (en). */
export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(locale(), {
    month: 'short',
    day: 'numeric',
  });
}

/** Long date with weekday, e.g. "måndag 12 juni" (sv). */
export function formatLongDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(locale(), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Date + time, e.g. "12 juni 15:09". */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(locale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "Today" → time, otherwise short date. Common list/preview pattern. */
export function formatTimeOrDate(dateStr: string): string {
  const date = new Date(dateStr);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday ? formatTimeShort(dateStr) : formatShortDate(dateStr);
}
