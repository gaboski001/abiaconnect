import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MainLayout } from './MainLayout'

vi.mock('./Navbar', () => ({ Navbar: () => <nav data-testid="navbar">desktop nav</nav> }))
vi.mock('./Footer', () => ({ Footer: () => <footer data-testid="footer" /> }))
vi.mock('@/components/mobile/MobileBottomNav', () => ({
  MobileBottomNav: () => <div data-testid="mobile-bottom-nav" />,
}))
vi.mock('@/components/mobile/MobileTopBar', () => ({
  MobileTopBar: () => <header data-testid="mobile-top-bar">mobile top</header>,
}))
vi.mock('@/components/pwa/InstallAppPrompt', () => ({ InstallAppPrompt: () => null }))
vi.mock('@/hooks/useSiteSettings', () => ({
  useSiteSettings: () => ({ settings: { theme: 'default' } }),
}))

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<div>Home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('MainLayout — responsive top bar', () => {
  it('renders MobileTopBar and wraps Navbar in a mobile-hidden container', () => {
    renderLayout()

    // MobileTopBar is always rendered on non-auth pages
    expect(screen.getByTestId('mobile-top-bar')).toBeInTheDocument()

    // Navbar is rendered but inside a wrapper that hides it below md
    const navbar = screen.getByTestId('navbar')
    const wrapper = navbar.parentElement as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.className).toMatch(/\bhidden\b/)
    expect(wrapper.className).toMatch(/\bmd:block\b/)
  })

  it('keeps MobileTopBar visible (no responsive-hide classes on its mount point)', () => {
    renderLayout()
    const mobileBar = screen.getByTestId('mobile-top-bar')
    // The mock itself shouldn't be wrapped in a hidden container by the layout.
    const parent = mobileBar.parentElement as HTMLElement
    expect(parent.className).not.toMatch(/\bhidden\b/)
  })
})
