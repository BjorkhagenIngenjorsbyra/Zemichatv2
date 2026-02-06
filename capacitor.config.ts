import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zemichat.app',
  appName: 'Zemichat',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: 'keystore.jks',
      keystoreAlias: 'zemichat',
    },
    allowMixedContent: false,
    backgroundColor: '#FFFFFF',
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#4F46E5',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
