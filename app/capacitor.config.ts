import type { CapacitorConfig } from '@capacitor/cli';

// appId is the reverse-DNS bundle identifier used by the App Store / Play Store.
// Change it before submitting if you want a different namespace — it's hard to
// change after a store listing exists.
const config: CapacitorConfig = {
  appId: 'bytes.yelling.tonecanvas',
  appName: 'Tone Canvas',
  webDir: 'dist',
};

export default config;
