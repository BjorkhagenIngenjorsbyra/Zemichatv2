import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import i18n, { detectDeviceLanguage, initI18n } from './i18n';

async function bootstrap() {
  await detectDeviceLanguage();
  await initI18n();

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

bootstrap();
