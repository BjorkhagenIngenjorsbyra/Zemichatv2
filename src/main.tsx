import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import i18n, { detectDeviceLanguage, initI18n } from './i18n';
import { initSentry } from './services/sentry';

// Init Sentry first so any error during the rest of bootstrap is reported.
initSentry();

function renderFallback(message: string) {
  const container = document.getElementById('root');
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
  if (!document.getElementById('root')?.hasChildNodes()) {
    renderFallback('Could not start. Please restart the app.');
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
});

async function bootstrap() {
  try {
    await detectDeviceLanguage();
  } catch (e) {
    console.warn('Language detection failed, using default:', e);
  }

  try {
    await initI18n();
  } catch (e) {
    console.warn('i18n init failed, using fallback:', e);
  }

  // Expose i18n on window for E2E tests (dev only)
  if (import.meta.env.DEV) {
    (window as unknown as { __i18n: typeof i18n }).__i18n = i18n;
  }

  const container = document.getElementById('root');
  const root = createRoot(container!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch((e) => {
  console.error('Bootstrap failed:', e);
  renderFallback('Failed to load app. Please restart.');
});
