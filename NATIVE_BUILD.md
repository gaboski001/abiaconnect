# Building & Installing the AbiaConnect Native App

Follow these steps every time you pull new changes from GitHub and want to run the updated app on an Android device/emulator or an iOS device/simulator.

## Prerequisites (one-time setup)

- **Node.js 22 LTS** and **npm 10+**
- **Git**
- **Android**: [Android Studio](https://developer.android.com/studio) with Android SDK + **JDK 17**
- **iOS** (macOS only): **Xcode 15+** and **CocoaPods** (`sudo gem install cocoapods`)
- Capacitor CLI is already in `devDependencies` — no global install needed

---

## 1. Pull the latest code

```bash
git pull
```

## 2. Install JS dependencies

```bash
npm install
```

## 3. Build the web bundle

```bash
npm run build
```

This produces the `dist/` folder that Capacitor copies into the native projects.

## 4. Add native platforms (first time only)

Skip this step if `android/` and/or `ios/` folders already exist.

```bash
npx cap add android      # Android
npx cap add ios          # iOS (macOS only)
```

## 5. Sync web bundle + plugins into native projects

Run this **every time** after `npm run build` or after installing/updating a Capacitor plugin (e.g. push notifications):

```bash
npx cap sync
```

To sync just one platform:

```bash
npx cap sync android
npx cap sync ios
```

## 6. Android push notification checklist

Use this after any Firebase or notification-related change:

```bash
npm install
npm run build
npx cap sync android
npx cap open android
```

Then in Android Studio / on device:

1. Confirm `android/app/google-services.json` exists
2. Install the app on a **physical Android phone**
3. Sign in with a real account
4. Open the admin **Push Setup Checklist** screen
5. Confirm token registration succeeds and the token is stored in `device_push_tokens`
6. Send a test push from the admin **Send Test Push** panel
7. Verify delivery in all states:
   - foreground
   - background
   - app relaunched from a terminated state

> Note: swiping the app away from Recent Apps is supported. If Android system settings are used to **Force stop** the app, push delivery is blocked by the OS until the user opens the app again.

## 7. Run the app

### Android

Easiest — directly on a connected device or running emulator:

```bash
npx cap run android
```

Or open in Android Studio and press **Run**:

```bash
npx cap open android
```

In Android Studio: **File → Sync Project with Gradle Files**, then **Build → Make Project**, then click the green **Run** ▶ button.

### iOS (macOS only)

```bash
npx cap run ios
```

Or open in Xcode:

```bash
npx cap open ios
```

In Xcode: select your device/simulator at the top, then press the **Run** ▶ button. The first build will prompt you to select a signing **Team** under **Signing & Capabilities**.

---

## Clean rebuild (when things go wrong)

If you hit Gradle errors, stale plugin issues, or app-id mismatches:

```bash
npm run cap:reset
```

This wipes `android/` and `ios/`, rebuilds the web bundle, re-adds Android, and re-syncs Capacitor. Then re-add iOS if you need it:

```bash
npx cap add ios
npx cap sync ios
```

---

## 8. Quick reference — full update cycle

```bash
git pull
npm install
npm run build
npx cap sync
npx cap run android      # or: npx cap run ios
```

---

## 9. Shipping a release build to testers

Push a semver tag and the GitHub Actions workflow (`.github/workflows/build-and-upload-native.yml`) will build a debug APK (and IPA if signing secrets are configured) and upload it to the admin **App Releases** section automatically:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Testers can then download the latest APK/IPA from the in-app **App Releases** page.
