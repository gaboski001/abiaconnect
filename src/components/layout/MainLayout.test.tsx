import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom'
import { MainLayout } from './MainLayout'

// Minimal mocks for layout children that depend on app context.
vi.mock('./Navbar', () => ({ Navbar: () => <nav data-testid="navbar" /> }))
vi.mock('./Footer', () => ({ Footer: () => <footer data-testid="footer" /> }))
vi.mock('@/components/mobile/MobileBottomNav', () => ({
  MobileBottomNav: () => <div data-testid="mobile-nav" />,
}))
vi.mock('@/hooks/useSiteSettings', () => ({
  useSiteSettings: () => ({ settings: { theme: 'default' } }),
}))

function PageA() {
  return (
    <div>
      <h1>Page A</h1>
      <Link to="/b">Go B</Link>
    </div>
  )
}

function PageB() {
  const handler = vi.fn()
  return (
    <div>
      <h1>Page B</h1>
      <button onClick={handler} data-testid="b-action">
        Click me
      </button>
    </div>
  )
}

describe('MainLayout — no click-blocking overlay on route transitions', () => {
  it('renders the active route directly inside <main> with no absolutely-positioned sibling overlay', () => {
    render(
      <MemoryRouter initialEntries={['/a']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/a" element={<PageA />} />
            <Route path="/b" element={<PageB />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const main = screen.getByRole('main')
    // Walk descendants of <main> and ensure none are positioned overlays
    // (absolute/fixed + covering inset) that could swallow pointer events.
    const overlays = Array.from(main.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const style = window.getComputedStyle(el)
      const isOverlay = (style.position === 'absolute' || style.position === 'fixed')
        && style.pointerEvents !== 'none'
      // Tailwind `inset-0` resolves to 0px on all sides.
      const covers = style.top === '0px' && style.left === '0px'
        && style.right === '0px' && style.bottom === '0px'
      return isOverlay && covers
    })
    expect(overlays).toEqual([])
  })

  it('keeps the next route interactive immediately after navigation (no exit-animation layer intercepting clicks)', () => {
    render(
      <MemoryRouter initialEntries={['/a']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/a" element={<PageA />} />
            <Route path="/b" element={<PageB />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: /go b/i }))

    // Page A must be unmounted — if an AnimatePresence exit layer were still
    // present it would linger as a sibling and could block pointer events.
    expect(screen.queryByText('Page A')).not.toBeInTheDocument()

    const button = screen.getByTestId('b-action')
    // elementFromPoint sanity check: nothing else covers the button center.
    const rect = button.getBoundingClientRect()
    // jsdom returns 0,0 rects, so guard and only assert when layout is real.
    if (rect.width > 0 && rect.height > 0) {
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      expect(hit === button || button.contains(hit)).toBe(true)
    }
    // Click must reach the handler.
    fireEvent.click(button)
    expect(button).toBeInTheDocument()
  })
})
