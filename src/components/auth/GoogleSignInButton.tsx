import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'
import { lovable } from '@/integrations/lovable/index'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import {
  GOOGLE_RETURN_EVENT,
  canUseNativeGoogle,
  finishNativeGoogle,
  startNativeGoogle,
} from '@/lib/nativeGoogle'

/**
 * "Continue with Google".
 *
 * AbiaConnect owns its accounts, so the sign-in is handed to the auth service
 * and the session comes back here. Google sign-in usually leaves the site and
 * returns, so the page the member was aiming for is parked in sessionStorage
 * and picked up again by <GoogleSignInLanding /> once a session exists.
 */

/** Where the member wanted to go is parked between leaving and coming back. */
export const GOOGLE_RETURN_KEY = 'abia_google_return'
const MAX_AGE_MS = 10 * 60 * 1000

/** False only in older installed apps, where Google would refuse the sign-in. */
export function googleSignInAvailable() {
  return !isNativeApp() || canUseNativeGoogle()
}

function isSafePath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
}

export function rememberGoogleReturnTo(path: string) {
  if (!isSafePath(path)) return
  try {
    sessionStorage.setItem(GOOGLE_RETURN_KEY, JSON.stringify({ path, at: Date.now() }))
  } catch {
    // Storage can be unavailable (private mode) — sign-in itself still works.
  }
}

export function clearGoogleReturnTo() {
  try {
    sessionStorage.removeItem(GOOGLE_RETURN_KEY)
  } catch {
    // Nothing to clear.
  }
}

function takeGoogleReturnTo(): string | null {
  try {
    const raw = sessionStorage.getItem(GOOGLE_RETURN_KEY)
    if (!raw) return null
    sessionStorage.removeItem(GOOGLE_RETURN_KEY)
    const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown }
    if (!isSafePath(parsed.path)) return null
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > MAX_AGE_MS) return null
    return parsed.path
  } catch {
    return null
  }
}

function friendlyError(message: string) {
  const m = (message || '').toLowerCase()
  if (m.includes('popup')) return 'Your browser blocked the Google window. Allow pop-ups for this site, then try again.'
  if (m.includes('cancel')) return 'Google sign-in was cancelled.'
  if (m.includes('timed out') || m.includes('timeout')) return 'Google sign-in took too long. Please try again.'
  return message || 'Google sign-in didn’t work. Please try again.'
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px] shrink-0" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  )
}

export function GoogleSignInButton({
  afterSignIn = '/',
  label = 'Continue with Google',
  busyLabel = 'Opening Google…',
  disabled,
  className,
}: {
  afterSignIn?: string
  label?: string
  busyLabel?: string
  disabled?: boolean
  className?: string
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function onClick() {
    if (busy) return
    setBusy(true)
    rememberGoogleReturnTo(afterSignIn)
    if (isNativeApp()) {
      startNativeGoogle()
      setBusy(false)
      return
    }
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        // Always a public same-origin URL: Google sends the member back here,
        // and the parked destination is applied once a session exists.
        redirect_uri: window.location.origin,
      })
      if (result.error) {
        clearGoogleReturnTo()
        toast.error(friendlyError(result.error.message))
        return
      }
      if (result.redirected) return // The browser is on its way to Google.
      clearGoogleReturnTo()
      navigate(afterSignIn)
    } catch (err) {
      clearGoogleReturnTo()
      toast.error(friendlyError(err instanceof Error ? err.message : 'Google sign-in didn’t work.'))
    } finally {
      setBusy(false)
    }
  }

  if (!googleSignInAvailable()) return null

  return (
    <Button type="button" variant="outline" className={className} disabled={disabled || busy} onClick={onClick}>
      <GoogleMark />
      {busy ? busyLabel : label}
    </Button>
  )
}

/**
 * Picks up the parked destination after Google sends the member back. Renders
 * nothing; mount it once inside the router.
 */
export function GoogleSignInLanding() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  // The installed app: pick up a sign-in the browser handed back.
  useEffect(() => {
    if (!canUseNativeGoogle()) return
    const finish = async () => {
      const result = await finishNativeGoogle()
      if (result === 'failed') toast.error('Google sign-in didn’t work. Please try again.')
    }
    void finish()
    window.addEventListener(GOOGLE_RETURN_EVENT, finish)
    return () => window.removeEventListener(GOOGLE_RETURN_EVENT, finish)
  }, [])

  useEffect(() => {
    if (loading || !session) return
    const path = takeGoogleReturnTo()
    if (path && path !== '/') navigate(path, { replace: true })
  }, [loading, session, navigate])

  return null
}
