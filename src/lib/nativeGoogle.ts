import { supabase } from '@/lib/supabase'

/**
 * Google sign-in for the installed app.
 *
 * Google refuses to sign people in inside an app's built-in web view, so the
 * app opens a real browser tab instead. /app-google-return.html then hands the
 * session back to the app, and the one-time code below proves the hand-back
 * belongs to a sign-in this phone started.
 */

interface AuthBridge {
  openGoogle(url: string): void
  takeGoogleReturn(): string | null
}

declare global {
  interface Window {
    AbiaAuthBridge?: AuthBridge
  }
}

const SITE = 'https://abiaconnect.com'
const CODE_KEY = 'abia:google-code'
const MAX_AGE_MS = 10 * 60 * 1000
export const GOOGLE_RETURN_EVENT = 'abia-google-return'

/** Older installed versions don't have the browser hand-off. */
export function canUseNativeGoogle() {
  return typeof window !== 'undefined' && !!window.AbiaAuthBridge
}

function randomCode() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function startNativeGoogle() {
  const code = randomCode()
  localStorage.setItem(CODE_KEY, JSON.stringify({ code, at: Date.now() }))
  const params = new URLSearchParams({
    provider: 'google',
    state: randomCode(),
    redirect_uri: `${SITE}/app-google-return.html?n=${code}`,
  })
  window.AbiaAuthBridge?.openGoogle(`${SITE}/~oauth/initiate?${params.toString()}`)
}

function codeMatches(code: unknown) {
  try {
    const saved = JSON.parse(localStorage.getItem(CODE_KEY) ?? 'null') as { code?: string; at?: number } | null
    if (!saved?.code || saved.code !== code) return false
    return typeof saved.at === 'number' && Date.now() - saved.at <= MAX_AGE_MS
  } catch {
    return false
  }
}

export type GoogleReturnResult = 'none' | 'signed-in' | 'rejected' | 'failed'

/** Finishes a sign-in the browser handed back, if there is one waiting. */
export async function finishNativeGoogle(): Promise<GoogleReturnResult> {
  const raw = window.AbiaAuthBridge?.takeGoogleReturn()
  if (!raw) return 'none'
  let data: { n?: string; at?: string; rt?: string; err?: string }
  try {
    data = JSON.parse(raw)
  } catch {
    return 'failed'
  }
  if (!codeMatches(data.n)) return 'rejected'
  localStorage.removeItem(CODE_KEY)
  if (data.err || !data.at || !data.rt) return 'failed'
  const { error } = await supabase.auth.setSession({ access_token: data.at, refresh_token: data.rt })
  return error ? 'failed' : 'signed-in'
}
