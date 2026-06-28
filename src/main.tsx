import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import i18n, { detectDeviceLanguage, initI18n } from './i18n';
import { initSentry, captureException } from './services/sentry';

// Init Sentry first so any error during the rest of bootstrap is reported.
initSentry();

// Set once the React app has actually mounted, so the global error handler
// below doesn't paint the fallback over a running app on a late runtime error.
let appMounted = false;

function renderFallback(message: string) {
  // Fall back to <body> if #root is missing (corrupted index.html / WebView
  // quirk) so the user still sees a message instead of a blank screen.
  const container = document.getElementById('root') ?? document.body;
  if (container) {
    container.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:1rem;font-family:-apple-system,sans-serif;text-align:center;color:#0a0d17;background:#fff;">' +
      '<h2 style="margin:0 0 0.5rem">ZemiChat</h2>' +
      '<p style="margin:0;color:#666;font-size:0.95rem;">' +
      message +
      '</p></div>';
  }
}

// Catch any uncaught error during module evaluation or async bootstrap so
// the user never sees a blank white screen on iOS/Android.
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error || e.message);
  captureException(e.error || e.message, { context: 'window.error' });
  // Only paint the fallback if the app hasn't mounted yet — otherwise a late
  // error from a third-party script would clobber a working UI.
  if (!appMounted && !document.getElementById('root')?.hasChildNodes()) {
    renderFallback('Could not start. Please restart the app.');
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
  captureException(e.reason, { context: 'unhandledrejection' });
});

async function bootstrap() {
  try {
    await detectDeviceLanguage();
  } catch (e) {
    console.warn('Language detection failed, using default:', e);
    captureException(e, { context: 'bootstrap.detectDeviceLanguage' });
  }

  try {
    await initI18n();
  } catch (e) {
    console.warn('i18n init failed, using fallback:', e);
    captureException(e, { context: 'bootstrap.initI18n' });
  }

  // Expose i18n on window for E2E tests (dev only)
  if (import.meta.env.DEV) {
    (window as unknown as { __i18n: typeof i18n }).__i18n = i18n;
  }

  const container = document.getElementById('root');
  if (!container) {
    // #root genuinely absent — createRoot would throw. Report and show a
    // body-level fallback instead of a blank screen.
    captureException(new Error('Root element #root not found'), { context: 'bootstrap.noRoot' });
    renderFallback('Could not start. Please restart the app.');
    return;
  }
  // A non-fatal global error during the async bootstrap window may have
  // injected the fallback markup; clear it so React 18's createRoot mounts
  // into a clean container instead of alongside the "Could not start" text.
  container.innerHTML = '';
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  appMounted = true;
}

bootstrap().catch((e) => {
  console.error('Bootstrap failed:', e);
  captureException(e, { context: 'bootstrap' });
  renderFallback('Failed to load app. Please restart.');
});
