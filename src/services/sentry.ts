// Crash + error reporting via Sentry. Initialised once from main.tsx
// before React mounts so we capture early bootstrap errors too.

import * as Sentry from '@sentry/capacitor';
import * as SentryReact from '@sentry/react';

const APP_VERSION = '1.5.11';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info('[sentry] VITE_SENTRY_DSN not set — skipping init');
    }
    return;
  }

  Sentry.init(
    {
      dsn,
      environment: import.meta.env.DEV ? 'development' : 'production',
      enabled: !import.meta.env.DEV,
      release: `zemichat@${APP_VERSION}`,
      // Sample 10% of traces and 100% of errors. Bump up traces if we
      // need more performance data later.
      tracesSampleRate: 0.1,
      // Capture session replays only on errors — privacy-sensitive app
      // (kids' messages), so no all-session replay.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    },
    SentryReact.init,
  );
}
