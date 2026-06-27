# AbiaConnect Premium Android Redesign Deliverable — V2

## What was updated

This package includes a broader premium Android redesign pass across the mobile experience:

- **Login** refined visually and updated to refresh auth state immediately after sign-in, reducing the stuck-on-sign-in issue on native builds.
- **Registration** kept in the premium multi-step style from the first pass.
- **Dashboard** remains upgraded with the premium hero, action cards, and cleaner native mobile layout.
- **Onboarding** refreshed to match the premium mobile design direction and stronger messaging around chat, calling, and alerts.
- **Homepage** rebuilt with a more professional premium forum-home layout, stronger hierarchy, upgraded highlight panels, and a cleaner discovery experience.
- **Forum categories** redesigned on both the homepage category grid and the dedicated category page with better cards, stats, and thread presentation.
- **Messages / chat** improved with a more polished inbox, stronger conversation layout, safer flex sizing for mobile, a cleaner composer, and more professional chat surfaces.
- **Notifications** redesigned with a cleaner premium notification center and tighter mobile spacing.
- **Profile** redesigned with premium cards, improved metrics layout, and stronger visual consistency.
- **Bottom navigation** upgraded to a more premium floating Android treatment with safer bottom spacing.
- **Call overlay** redesigned to look more professional and native.
- **Push / realtime call routing** updated to use in-app navigation flow instead of hard reload navigation, improving reliability when opening notifications or calls from native contexts.
- **Android native notification handling** remains updated for stronger incoming-call and high-priority notification behavior when the app is backgrounded or closed.

## Key files touched

- `src/pages/Home.tsx`
- `src/components/forum/CategoryList.tsx`
- `src/components/forum/SidebarWidgets.tsx`
- `src/pages/Category.tsx`
- `src/pages/Login.tsx`
- `src/contexts/AuthContext.tsx`
- `src/hooks/usePushNotifications.ts`
- `src/pages/Messages.tsx`
- `src/pages/Notifications.tsx`
- `src/pages/Profile.tsx`
- `src/components/mobile/MobileBottomNav.tsx`
- `src/components/mobile/MobileOnboarding.tsx`
- `src/components/call/CallOverlay.tsx`
- `src/lib/webrtcCall.ts`
- `android/app/src/main/java/com/abiaconnect/app/BaseActivity.java`
- `android/app/src/main/java/com/abiaconnect/app/MainActivity.java`
- `android/app/src/main/java/com/abiaconnect/app/MyFirebaseMessagingService.java`
- `scripts/capture-premium-screenshots.mjs`

## Included screenshots

The package contains generated screenshots in `design-screenshots/`:

- `onboarding-mobile.png`
- `home-mobile.png`
- `category-mobile.png`
- `login-mobile.png`
- `register-mobile.png`
- `dashboard-mobile.png`
- `messages-mobile.png`
- `notifications-mobile.png`
- `profile-mobile.png`

## Verification status

- Production build completed successfully with `npm run build`.
- Updated screenshot capture completed successfully against the built preview.
- Native push/call notification code is included, but full device-level Android validation should still be run locally for final release confidence.

## Important note

Capacitor Android sync/build still requires **Node.js 22+** locally for the native workflow. The sandbox validated the web build and generated the redesign screenshots, but final native packaging, APK/AAB creation, and device testing should be run on your machine with Node 22 LTS and Android Studio installed.
