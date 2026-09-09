import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sparetrack.app',
  appName: 'SpareTrack',
  webDir: 'frontend',
  android: {
    // App talks to the on-device Python server over the loopback
    // interface only (127.0.0.1) — see android/README-OFFLINE.md.
    allowMixedContent: true
  }
};

export default config;
