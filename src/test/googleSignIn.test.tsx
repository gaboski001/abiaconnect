import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const oauth = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }))
vi.mock('@/integrations/lovable/index', () => ({ lovable: { auth: oauth } }))

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('@/lib/toast', () => ({ toast }))

const auth = vi.hoisted(() => ({ session: null as unknown, loading: false }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }))

import {
  GOOGLE_RETURN_KEY,
  GoogleSignInButton,
  GoogleSignInLanding,
  clearGoogleReturnTo,
  rememberGoogleReturnTo,
} from '@/components/auth/GoogleSignInButton'

function Where() {
  const loc = useLocation()
  return <span data-testid="where">{loc.pathname}</span>
}

function renderAuth(ui: React.ReactNode, initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      {ui}
      <Routes>
        <Route path="/" element={<Where />} />
        <Route path="/dashboard" element={<Where />} />
        <Route path="/welcome" element={<Where />} />
        <Route path="/login" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  oauth.signInWithOAuth.mockReset()
  toast.error.mockReset()
  clearGoogleReturnTo()
  auth.session = null
  auth.loading = false
})

describe('Google sign-in button', () => {
  it('hands the sign-in to Google with a public same-origin return URL', async () => {
    oauth.signInWithOAuth.mockResolvedValue({ error: null, redirected: true })
    const { getByRole } = renderAuth(<GoogleSignInButton afterSignIn="/dashboard" />)
    fireEvent.click(getByRole('button', { name: /continue with google/i }))
    await waitFor(() => expect(oauth.signInWithOAuth).toHaveBeenCalled())
    const [provider, opts] = oauth.signInWithOAuth.mock.calls[0]
    expect(provider).toBe('google')
    // Must be the plain origin — never a members-only page, which Google
    // cannot write a session for on its own.
    expect(opts.redirect_uri).toBe(window.location.origin)
    expect(opts.redirect_uri).not.toContain('/dashboard')
  })

  it('parks the destination while the browser is away at Google', async () => {
    oauth.signInWithOAuth.mockResolvedValue({ error: null, redirected: true })
    const { getByRole } = renderAuth(<GoogleSignInButton afterSignIn="/dashboard" />)
    fireEvent.click(getByRole('button', { name: /continue with google/i }))
    await waitFor(() => expect(oauth.signInWithOAuth).toHaveBeenCalled())
    expect(JSON.parse(sessionStorage.getItem(GOOGLE_RETURN_KEY) as string).path).toBe('/dashboard')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('goes straight to the destination when the session arrives without a redirect', async () => {
    oauth.signInWithOAuth.mockResolvedValue({
      tokens: { access_token: 'a', refresh_token: 'r' },
      error: null,
      redirected: false,
    })
    const { getByRole, getByTestId } = renderAuth(<GoogleSignInButton afterSignIn="/welcome" />)
    fireEvent.click(getByRole('button', { name: /continue with google/i }))
    await waitFor(() => expect(getByTestId('where').textContent).toBe('/welcome'))
    expect(sessionStorage.getItem(GOOGLE_RETURN_KEY)).toBeNull()
  })

  it('tells the member when Google sign-in could not be completed and forgets the parked page', async () => {
    oauth.signInWithOAuth.mockResolvedValue({ error: new Error('Popup was blocked'), redirected: false })
    const { getByRole } = renderAuth(<GoogleSignInButton afterSignIn="/dashboard" />)
    fireEvent.click(getByRole('button', { name: /continue with google/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(String(toast.error.mock.calls[0][0])).toMatch(/blocked the Google window/i)
    expect(sessionStorage.getItem(GOOGLE_RETURN_KEY)).toBeNull()
  })

  it('does not send the member anywhere when they cancel', async () => {
    oauth.signInWithOAuth.mockResolvedValue({ error: new Error('Sign in was cancelled'), redirected: false })
    const { getByRole, getByTestId } = renderAuth(<GoogleSignInButton afterSignIn="/dashboard" />)
    fireEvent.click(getByRole('button', { name: /continue with google/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(getByTestId('where').textContent).toBe('/')
  })
})

describe('returning from Google', () => {
  it('takes the member to the page they were aiming for once they are signed in', async () => {
    auth.session = { user: { id: 'u1' } }
    rememberGoogleReturnTo('/dashboard')
    const { getByTestId } = renderAuth(<GoogleSignInLanding />)
    await waitFor(() => expect(getByTestId('where').textContent).toBe('/dashboard'))
    expect(sessionStorage.getItem(GOOGLE_RETURN_KEY)).toBeNull()
  })

  it('moves the member off the login screen when Google signs them in there (the app)', async () => {
    auth.session = { user: { id: 'u1' } }
    rememberGoogleReturnTo('/')
    const { getByTestId } = renderAuth(<GoogleSignInLanding />, '/login')
    await waitFor(() => expect(getByTestId('where').textContent).toBe('/'))
  })

  it('leaves a signed-in member on the login screen alone when no Google sign-in is under way', async () => {
    auth.session = { user: { id: 'u1' } }
    const { getByTestId } = renderAuth(<GoogleSignInLanding />, '/login')
    await new Promise((r) => setTimeout(r, 30))
    expect(getByTestId('where').textContent).toBe('/login')
  })

  it('waits while no session exists yet', async () => {
    auth.session = null
    auth.loading = true
    rememberGoogleReturnTo('/dashboard')
    const { getByTestId } = renderAuth(<GoogleSignInLanding />)
    await new Promise((r) => setTimeout(r, 30))
    expect(getByTestId('where').textContent).toBe('/')
  })

  it('ignores a parked address that points outside the site', async () => {
    auth.session = { user: { id: 'u1' } }
    sessionStorage.setItem(GOOGLE_RETURN_KEY, JSON.stringify({ path: '//evil.example', at: Date.now() }))
    const { getByTestId } = renderAuth(<GoogleSignInLanding />)
    await new Promise((r) => setTimeout(r, 30))
    expect(getByTestId('where').textContent).toBe('/')
  })

  it('ignores a parked page from a sign-in attempt that has gone stale', async () => {
    auth.session = { user: { id: 'u1' } }
    sessionStorage.setItem(
      GOOGLE_RETURN_KEY,
      JSON.stringify({ path: '/dashboard', at: Date.now() - 11 * 60 * 1000 }),
    )
    const { getByTestId } = renderAuth(<GoogleSignInLanding />)
    await new Promise((r) => setTimeout(r, 30))
    expect(getByTestId('where').textContent).toBe('/')
  })
})
