import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, matchPath } from 'react-router-dom'

const auth = vi.hoisted(() => ({
  user: { id: 'me', email: 'me@example.com' } as null | { id: string; email: string },
  role: 'member',
  isAdmin: true,
  signOut: vi.fn(),
}))

vi.mock('@/lib/volunteerTeam', () => ({ useVolunteerPowers: () => ({ data: undefined }) }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }) }))
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ data: { display_name: 'Ada Obi', username: 'ada' } }) }))
vi.mock('@/hooks/useSiteSettings', () => ({ useSiteSettings: () => ({ settings: { store_link: 'https://store.example.com' } }) }))
vi.mock('@/hooks/useAppUpdate', () => ({ useAppUpdate: () => ({ hasUpdate: false }) }))
vi.mock('@/components/messages/MessagesBell', () => ({ useUnreadMessagesCount: () => 3 }))
vi.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: () => <a href="/notifications" aria-label="Notifications" />,
}))
vi.mock('@/components/layout/SiteLogo', () => ({ SiteLogo: () => <span /> }))
vi.mock('@/components/ui/UserAvatar', () => ({ UserAvatar: () => <span /> }))
vi.mock('@/lib/callPreferences', () => ({
  areCallsEnabled: () => true,
  hydrateCallsEnabledFromProfile: vi.fn(),
  setCallsEnabled: vi.fn(),
  subscribeCallsEnabled: () => () => undefined,
}))

import { MobileBottomNav } from './MobileBottomNav'
import { MobileTopBar } from './MobileTopBar'

/** Every route path declared in App.tsx. */
const ROUTES = Array.from(
  readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8').matchAll(/path="([^"]+)"/g),
  (m) => '/' + m[1].replace(/^\//, ''),
).filter((p) => p !== '/*')

function isKnownRoute(href: string) {
  if (href === '/') return true
  return ROUTES.some((r) => matchPath({ path: r, end: true }, href))
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <MobileTopBar />
      <MobileBottomNav />
    </MemoryRouter>,
  )
}

function collectHrefs() {
  return Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')!)
}

describe('app navigation', () => {
  beforeEach(() => {
    auth.user = { id: 'me', email: 'me@example.com' }
    auth.isAdmin = true
  })

  it('has no side menu and five bottom tabs with an unread badge on Messages', () => {
    renderApp()
    expect(screen.queryByRole('button', { name: /open menu|menu/i, hidden: false })).toBeNull()
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getAllByRole('link')).toHaveLength(4)
    expect(within(nav).getByRole('button', { name: 'More' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Messages, 3 unread' })).toBeInTheDocument()
  })

  it('lists every destination once, and every one goes to a real screen', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const hrefs = collectHrefs()
    const internal = hrefs.filter((h) => h.startsWith('/'))
    const dupes = internal.filter((h, i) => internal.indexOf(h) !== i && h !== '/')
    expect(dupes).toEqual([])
    for (const h of internal) expect(isKnownRoute(h.split('?')[0]), `${h} is not a route`).toBe(true)
    // Key features are reachable.
    for (const h of ['/subgroups', '/messages', '/relationship', '/notifications', '/profile', '/dashboard', '/polls', '/admin/dashboard']) {
      expect(internal).toContain(h)
    }
    // Google Play: no in-app donations in the Android app (offered on the website).
    expect(internal).not.toContain('/donate')
  })

  it('explains items in plain words and lets members search the menu', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByText('Listen to or join live voice chats')).toBeInTheDocument()
    expect(collectHrefs()).toEqual(expect.arrayContaining(['/live', '/opportunities']))

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the menu' }), { target: { value: 'job' } })
    const results = screen.getByRole('heading', { name: 'Results' }).parentElement!
    expect(within(results).getByRole('link', { name: /Jobs and services/ })).toHaveAttribute('href', '/opportunities')
    expect(screen.queryByRole('link', { name: /Help centre/ })).toBeNull()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the menu' }), { target: { value: 'zzzz' } })
    expect(screen.getByText(/Nothing found/)).toBeInTheDocument()
  })

  it('offers sign-in to visitors instead of account items', () => {
    auth.user = null
    auth.isAdmin = false
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const hrefs = collectHrefs()
    expect(hrefs).toContain('/login')
    expect(hrefs).toContain('/register')
    expect(hrefs).not.toContain('/dashboard')
    expect(hrefs).not.toContain('/admin/dashboard')
  })
})
