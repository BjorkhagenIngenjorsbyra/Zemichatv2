import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zemichat.app',
  appName: 'Zemichat',
  version: '1.2.1',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: 'keystore.jks',
      keystoreAlias: 'zemichat',
    },
    allowMixedContent: false,
    backgroundColor: '#FFFFFF',
  },
  ios: {
    backgroundColor: '#FFFFFF',
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0a0d17',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
