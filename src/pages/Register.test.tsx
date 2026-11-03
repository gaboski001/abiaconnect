import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from: vi.fn(), auth: { signUp: vi.fn(), resend: vi.fn() } } }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/useSiteSettings', () => ({ useSiteSettings: () => ({ settings: {} }) }))
vi.mock('@/hooks/useSignedUrl', () => ({ useSignedUrl: () => null }))
vi.mock('@/components/web/WebAuthLayout', () => ({ WebAuthLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/components/SEO', () => ({ SEO: () => null }))

import Register from './Register'

function renderPage() {
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  )
}

describe('Register (website)', () => {
  beforeEach(() => rpc.mockReset())

  it('says why when the email already has an account', async () => {
    rpc.mockResolvedValue({ data: [{ is_registered: true, is_verified: true }], error: null })
    renderPage()
    const email = document.querySelector('input[type=email]') as HTMLInputElement
    fireEvent.change(email, { target: { value: 'someone@example.com' } })
    fireEvent.blur(email)
    expect(await screen.findByText('This email is already registered')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText(/already has an AbiaConnect account/)).toBeInTheDocument(),
    )
  })

  it('lets people show and hide the password', () => {
    renderPage()
    const box = document.querySelector('input[autocomplete=new-password]') as HTMLInputElement
    expect(box.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(box.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(box.type).toBe('password')
  })
})
