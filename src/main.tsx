import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { detectDeviceLanguage, initI18n } from './i18n';

async function bootstrap() {
  await detectDeviceLanguage();
  await initI18n();

  const container = document.getElementById('root');
  const root = createRoot(container!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
