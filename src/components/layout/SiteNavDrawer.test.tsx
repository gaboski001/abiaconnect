import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  role: 'member' as string,
  isAdmin: false,
  signOut: vi.fn(),
}))

vi.mock('@/lib/volunteerTeam', () => ({ useVolunteerPowers: () => ({ data: undefined }) }))
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ data: { display_name: 'Ada', avatar_url: null } }) }))
vi.mock('@/hooks/useSiteSettings', () => ({
  useSiteSettings: () => ({ settings: { site_name: 'AbiaConnect', store_link: 'https://store.example.com' } }),
}))
vi.mock('@/hooks/useSignedUrl', () => ({ useSignedUrl: () => null }))
vi.mock('@/lib/journey', () => ({ useJourney: () => ({ data: null }), isNewcomer: () => false }))
vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) } },
}))
vi.mock('@/components/ui/UserAvatar', () => ({ UserAvatar: () => <span data-testid="avatar" /> }))

import { SiteNavDrawer } from './SiteNavDrawer'

function openDrawerAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SiteNavDrawer />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
}

describe('SiteNavDrawer', () => {
  beforeEach(() => {
    authState.user = null
    authState.isAdmin = false
  })

  it('shows grouped sections, a logo fallback and sign-in actions for guests', () => {
    openDrawerAt('/')
    expect(screen.getByText('Explore')).toBeInTheDocument()
    expect(screen.getByText('Community')).toBeInTheDocument()
    expect(screen.queryByText('Account')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin Portal')).not.toBeInTheDocument()
    expect(screen.queryByText('AC')).not.toBeInTheDocument() // no placeholder badge
    expect(screen.getByText('AbiaConnect')).toBeInTheDocument() // name only when no logo is set
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /store/i })).toHaveAttribute('target', '_blank')
  })

  it('highlights the current page', () => {
    openDrawerAt('/polls')
    expect(screen.getByRole('link', { name: 'Polls' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Forums' })).not.toHaveAttribute('aria-current')
  })

  it('shows account and admin sections only to admins', () => {
    authState.user = { id: 'u1', email: 'ada@example.com' }
    authState.isAdmin = true
    openDrawerAt('/')
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Admin Portal' })).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
