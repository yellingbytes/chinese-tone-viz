# Tone Canvas — native apps (iOS & Android via Capacitor)

The web build (`dist/`) is wrapped with [Capacitor](https://capacitorjs.com) into
native iOS and Android apps. One codebase → website + PWA + store apps.

- **App name:** Tone Canvas
- **Bundle id (appId):** `bytes.yelling.tonecanvas` — change in `capacitor.config.ts`
  *before* you create store listings (it can't change afterward).

## Everyday workflow

```bash
npm run build        # build the web app into dist/
npx cap sync         # copy dist/ + plugins into ios/ and android/
# or the shortcuts:
npm run ios          # build + sync + open Xcode
npm run android      # build + sync + open Android Studio
```

After any web code change: `npm run build && npx cap sync`.

## One-time prerequisites (not installed on this machine yet)

### iOS
1. Install CocoaPods: `brew install cocoapods` (or `sudo gem install cocoapods`).
2. `cd ios/App && pod install` (or just `npx cap sync ios`).
3. `npx cap open ios` → in Xcode: select the **App** target → **Signing & Capabilities**
   → pick your Team (needs a **paid Apple Developer account, $99/yr** for devices/stores).
4. Run on a simulator or device. Mic dictation needs a **real device** (simulators
   have no microphone). The first Record tap prompts for Microphone + Speech permission
   (strings already set in `ios/App/App/Info.plist`).

### Android
1. Install **Android Studio** (bundles the SDK + a JDK).
2. `npx cap open android` → let Gradle sync → Run on an emulator or device.
3. `RECORD_AUDIO` permission + the speech-service `<queries>` are already in
   `android/app/src/main/AndroidManifest.xml`. First Record tap prompts for the mic.
4. **Google Play Developer account ($25 one-time)** to publish.

## How dictation differs on native

WebView has no Web Speech API, so on iOS/Android the app uses
`@capacitor-community/speech-recognition` (see `startNativeDictation` in `src/App.tsx`).
The web/PWA build keeps using the browser's Web Speech API. Same UI, chosen at runtime
via `Capacitor.isNativePlatform()`.

> Native speech wiring is implemented but **not yet tested on a device** from here —
> verify on a real iPhone/Android once CocoaPods / Android Studio are installed.

## Store assets still to add
App icons + splash screens (use `@capacitor/assets`), then Xcode/Play Console listings.
