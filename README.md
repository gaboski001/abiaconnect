# AbiaConnect

A community forum for Abians worldwide — built with React, Vite, Tailwind, and Supabase.

## Quick Start (Development)

1. Clone this repo
2. Run: `npm install`
3. Copy `.env.example` to `.env` and fill in your Supabase values
4. Run the SQL schema from the docs on your Supabase project
5. Run: `npm run dev`
6. Open: http://localhost:3000

## Production Deployment

### Option A — Render / Railway
1. Push code to GitHub
2. Create new Web Service on Render or Railway
3. Build command: `npm run build:prod`
4. Start command: `node server.js`
5. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Option B — Netlify
1. Push to GitHub, connect on Netlify
2. Build command: `npm run build:prod`
3. Publish directory: `dist`
4. Add environment variables in Netlify dashboard
5. SPA routing handled by `public/_redirects`

### Option C — Vercel
1. Push to GitHub, import on Vercel
2. Framework preset: Vite
3. Add environment variables in Vercel dashboard
4. SPA routing handled by `vercel.json`

### Option D — VPS with Nginx
1. `npm run build:prod` on server
2. Serve `dist/` with Nginx using `try_files $uri /index.html`
3. Or run: `node server.js` (binds to `PORT` env var)

### Option E — Docker
1. `docker build -t abiaconnect .`
2. `docker run -p 3000:3000 -e VITE_SUPABASE_URL=... -e VITE_SUPABASE_ANON_KEY=... abiaconnect`

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build:prod` — type-check and build for production
- `npm run serve` — serve the prebuilt `dist/` via Express
- `npm start` — build then serve in one step
- `npm run cap:reset` — wipe `android/` & `ios/`, rebuild web, re-add Android, and sync Capacitor

## Push notifications — how it works and how to test

The app uses **Firebase Cloud Messaging (FCM)** for real-time delivery. 

### Implementation Details
- **Payloads**: The backend (`send-push` edge function) sends **data-only** messages. This ensures the native `MyFirebaseMessagingService.java` always handles the display, allowing for premium heads-up banners and custom call handling even when the app is force-closed.
- **Deep Linking**: Tapping a notification sends the `url` extra to `MainActivity`, which dispatches a `abiaconnect-native-notification` event to the React layer.
- **Battery Optimization**: Android users are prompted once to disable battery optimization for AbiaConnect to prevent background service kills by OEMs.

### How to Test

#### 1. Foreground / Background State
1. Open the app or put it in the background.
2. Trigger a test push (via Admin panel or Supabase console).
3. **Verify**: Notification appears in tray with Gold icon and sound.

#### 2. Killed / Force-Closed State
1. Swipe the app away from the task switcher.
2. Run this adb command to verify the service is ready:
   ```bash
   adb logcat | grep AbiaConnectFCM
   ```
3. Trigger a test push.
4. **Verify**: `onMessageReceived` fires (see logcat) and notification appears in the system tray.

#### 3. Deep Link Test
1. Tap the received notification.
2. **Verify**: App opens and navigates directly to the target URL (e.g., `/messages/123`).

#### 4. Incoming Call (Lockscreen)
1. Lock the phone screen.
2. Trigger a push with `type: "call"`.
3. **Verify**: The phone wakes up, plays the ringtone, and shows the full-screen call UI.

