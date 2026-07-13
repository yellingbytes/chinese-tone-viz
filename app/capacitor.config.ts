import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

// appId is the reverse-DNS bundle identifier used by the App Store / Play Store.
// Change it before submitting if you want a different namespace — it's hard to
// change after a store listing exists.
const config: CapacitorConfig = {
  appId: 'bytes.yelling.tonecanvas',
  appName: 'Tone Canvas',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      // Don't resize the web view when the keyboard shows — the bottom dock is
      // fixed and should stay put (hidden behind the keyboard) rather than
      // being pushed up. The app centres the editing block above the keyboard.
      resize: KeyboardResize.None,
    },
  },
};

export default config;
