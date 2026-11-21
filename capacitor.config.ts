import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meditime.app',
  appName: 'MediTime',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
