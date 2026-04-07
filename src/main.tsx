import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import i18n, { detectDeviceLanguage, initI18n } from './i18n';

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
    (window as any).__i18n = i18n;
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
  // Render a minimal error UI so the screen is never blank
  const container = document.getElementById('root');
  if (container) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p>Failed to load app. Please restart.</p></div>';
  }
});
