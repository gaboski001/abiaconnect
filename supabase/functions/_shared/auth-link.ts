// Builds the link members click in sign-up, password-reset, magic-link,
// invite and email-change emails, on AbiaConnect's own address.
// Pure TypeScript (no Deno APIs) so it is unit tested in src/test.
//
// Supabase gives the email hook a link on the backend's address:
//   https://<project>.supabase.co/auth/v1/verify?token=<hash>&type=signup&redirect_to=https://abiaconnect.com/
// We turn it into:
//   https://abiaconnect.com/auth/confirm?token_hash=<hash>&type=signup&next=/
// and the website's /auth/confirm page finishes the verification itself
// (supabase.auth.verifyOtp), so members only ever see abiaconnect.com.

export const SITE_URL = 'https://abiaconnect.com'

const TYPES = new Set(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'])

/** Same-site path to continue to after verifying (never another website). */
function safeNext(redirectTo: string | null, type: string): string {
  if (type === 'recovery') return '/reset-password'
  if (!redirectTo) return '/'
  try {
    const u = new URL(redirectTo, SITE_URL)
    const host = u.hostname.replace(/^www\./, '')
    if (host !== 'abiaconnect.com') return '/'
    const path = u.pathname + u.search
    return path.startsWith('/') && !path.startsWith('//') ? path : '/'
  } catch {
    return '/'
  }
}

/**
 * Returns the AbiaConnect-branded link, or the original link if it is not
 * in the expected shape (so a member is never left without a working link).
 */
export function brandedAuthLink(originalUrl: string): string {
  try {
    const u = new URL(originalUrl)
    const tokenHash = u.searchParams.get('token') ?? u.searchParams.get('token_hash')
    const type = u.searchParams.get('type') ?? ''
    if (!tokenHash || !/^[A-Za-z0-9_-]{8,512}$/.test(tokenHash) || !TYPES.has(type)) return originalUrl
    const out = new URL('/auth/confirm', SITE_URL)
    out.searchParams.set('token_hash', tokenHash)
    out.searchParams.set('type', type)
    out.searchParams.set('next', safeNext(u.searchParams.get('redirect_to'), type))
    return out.toString()
  } catch {
    return originalUrl
  }
}
