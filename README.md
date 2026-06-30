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

## Android (Capacitor) — Clean Rebuild

Use this whenever the native Android project is out of sync or you hit Gradle / app-id errors.

```bash
# 1. Pull latest changes
git pull

# 2. Install JS deps
npm install

# 3. Nuke android/ios, build web, re-add Android, sync native plugins
npm run cap:reset

# 4. Open the freshly generated project in Android Studio
npx cap open android
```

In Android Studio: **File → Sync Project with Gradle Files**, then **Build → Make Project**, then run on a device/emulator.

> Requires Android Studio (with Android SDK + JDK 17) installed locally. iOS builds additionally require macOS + Xcode and `npx cap add ios`.

