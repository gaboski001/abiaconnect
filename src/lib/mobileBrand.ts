// Native dark palette aligned with the web project's dark forest green
// (web --secondary: #1B3D1B). Ink/surface tones step down/up from that base.
export const MOBILE_BRAND = {
  ink: '#0B1F0B',         // deepest forest — app background
  inkSoft: '#102A10',     // slightly raised surface
  surface: '#163516',     // card surface
  surfaceSoft: '#1B3D1B', // matches web --secondary
  outline: 'rgba(255,255,255,0.08)',
  text: '#F8FAFC',
  textSoft: 'rgba(226,232,240,0.74)',
  blue: '#1CA9D9',
  green: '#1B3D1B',
  greenDeep: '#0B1F0B',
  gold: '#F8C301',
  goldWarm: '#E87015',
  goldSoft: '#FFD65A',
  success: '#34D399',
}

export const GOLD_GRADIENT = `linear-gradient(135deg, ${MOBILE_BRAND.goldWarm} 0%, ${MOBILE_BRAND.gold} 52%, ${MOBILE_BRAND.goldSoft} 100%)`
export const GOLD_GRADIENT_SOFT = `linear-gradient(135deg, rgba(232,112,21,0.20) 0%, rgba(248,195,1,0.20) 100%)`
export const BLUE_GOLD_GRADIENT = `linear-gradient(135deg, ${MOBILE_BRAND.blue} 0%, ${MOBILE_BRAND.goldWarm} 46%, ${MOBILE_BRAND.gold} 100%)`

/** The app's top bar and page headers: brand green, a little brighter on the right. */
export const APP_HEADER_GRADIENT = 'linear-gradient(90deg, #0B3D1E 0%, #14532D 55%, #1F7A45 100%)'

export const PREMIUM_SHADOW = '0 30px 80px -36px rgba(11,31,11,0.95)'
export const GOLD_SHADOW = '0 18px 45px -18px rgba(248,195,1,0.48)'

export const AUTH_HIGHLIGHTS = [
  'Real-time community updates',
  'Premium native motion and feedback',
  'Secure sign-in with biometrics',
]
