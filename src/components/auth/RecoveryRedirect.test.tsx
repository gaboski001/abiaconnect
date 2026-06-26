import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RecoveryRedirect } from './RecoveryRedirect'

function LocationProbe() {
  const loc = useLocation()
  return (
    <div data-testid="probe">
      {loc.pathname}|{loc.hash}|{loc.search}
    </div>
  )
}

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <RecoveryRedirect />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const RECOVERY_HASH = '#access_token=abc.def.ghi&type=recovery&refresh_token=xyz'

function setWindowUrl(pathname: string, hash = '', search = '') {
  // RecoveryRedirect inspects window.location.hash/search directly.
  window.history.replaceState(null, '', pathname + search + hash)
}

describe('RecoveryRedirect', () => {
  const originalUrl = window.location.href

  beforeEach(() => {
    setWindowUrl('/', '', '')
  })

  afterEach(() => {
    window.history.replaceState(null, '', originalUrl)
  })

  it.each([
    ['/'],
    ['/dashboard'],
    ['/login'],
    ['/profile'],
    ['/subgroups/abc-123'],
    ['/admin/dashboard'],
  ])('forwards recovery hash on %s to /reset-password', (path) => {
    setWindowUrl(path, RECOVERY_HASH)
    renderAt(path + RECOVERY_HASH)

    const probe = screen.getByTestId('probe').textContent ?? ''
    const [pathname, hash] = probe.split('|')
    expect(pathname).toBe('/reset-password')
    expect(hash).toContain('type=recovery')
    expect(hash).toContain('access_token=')
  })

  it('forwards query-string recovery (?type=recovery) to /reset-password', () => {
    setWindowUrl('/', '', '?type=recovery&token_hash=abc')
    renderAt('/?type=recovery&token_hash=abc')

    const probe = screen.getByTestId('probe').textContent ?? ''
    const [pathname, , search] = probe.split('|')
    expect(pathname).toBe('/reset-password')
    expect(search).toContain('type=recovery')
  })

  it('does not redirect when already on /reset-password', () => {
    setWindowUrl('/reset-password', RECOVERY_HASH)
    renderAt('/reset-password' + RECOVERY_HASH)

    const probe = screen.getByTestId('probe').textContent ?? ''
    expect(probe.split('|')[0]).toBe('/reset-password')
  })

  it('ignores non-recovery hashes', () => {
    setWindowUrl('/dashboard', '#section=overview')
    renderAt('/dashboard#section=overview')

    const probe = screen.getByTestId('probe').textContent ?? ''
    expect(probe.split('|')[0]).toBe('/dashboard')
  })

  it('ignores recovery type without access_token in hash', () => {
    setWindowUrl('/dashboard', '#type=recovery')
    renderAt('/dashboard#type=recovery')

    const probe = screen.getByTestId('probe').textContent ?? ''
    expect(probe.split('|')[0]).toBe('/dashboard')
  })
})
