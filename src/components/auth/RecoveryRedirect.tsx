import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Supabase password-recovery links append `#access_token=...&type=recovery`
 * to whatever URL the project's "Site URL" resolves to. If the user's
 * `redirectTo` isn't in the allow list, Supabase falls back to the Site URL
 * (often `/`), so the user lands on Home/Dashboard instead of the reset page.
 *
 * This guard runs on every navigation and, whenever it sees a recovery hash
 * on any path other than `/reset-password`, forwards the user there with the
 * hash intact so ResetPassword can complete the flow.
 */
export function RecoveryRedirect() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    const isRecovery =
      (hash.includes('type=recovery') && hash.includes('access_token=')) ||
      search.includes('type=recovery')

    if (isRecovery && location.pathname !== '/reset-password') {
      navigate({ pathname: '/reset-password', hash, search }, { replace: true })
    }
  }, [location.pathname, location.hash, location.search, navigate])

  return null
}
