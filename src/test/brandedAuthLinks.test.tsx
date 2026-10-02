import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { brandedAuthLink } from '../../supabase/functions/_shared/auth-link'

const verifyOtp = vi.fn()
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { verifyOtp: (...a: unknown[]) => verifyOtp(...a) } } }))

const SUPA = 'https://tnwgnowjmrbjugheorkv.supabase.co/auth/v1/verify'
const HASH = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8'

describe('email links use abiaconnect.com only', () => {
  it('turns the backend verify link into an abiaconnect.com link', () => {
    const link = brandedAuthLink(`${SUPA}?token=${HASH}&type=signup&redirect_to=https://abiaconnect.com/`)
    expect(link).toBe(`https://abiaconnect.com/auth/confirm?token_hash=${HASH}&type=signup&next=%2F`)
    expect(link).not.toMatch(/supabase|lovable/)
  })

  it('sends password resets to the reset page', () => {
    const link = brandedAuthLink(`${SUPA}?token=${HASH}&type=recovery&redirect_to=https://abiaconnect.com/reset-password`)
    expect(new URL(link).searchParams.get('next')).toBe('/reset-password')
  })

  it('keeps the page a member was going to, but never another website', () => {
    const keep = brandedAuthLink(`${SUPA}?token=${HASH}&type=magiclink&redirect_to=https://www.abiaconnect.com/thread/123?x=1`)
    expect(new URL(keep).searchParams.get('next')).toBe('/thread/123?x=1')
    for (const evil of ['https://evil.example/', 'https://abiaconnect.lovable.app/', '//evil.example/x', 'javascript:alert(1)']) {
      const link = brandedAuthLink(`${SUPA}?token=${HASH}&type=signup&redirect_to=${encodeURIComponent(evil)}`)
      expect(new URL(link).searchParams.get('next'), evil).toBe('/')
      expect(new URL(link).origin).toBe('https://abiaconnect.com')
    }
  })

  it('covers every email type', () => {
    for (const type of ['signup', 'invite', 'magiclink', 'recovery', 'email_change']) {
      expect(brandedAuthLink(`${SUPA}?token=${HASH}&type=${type}`)).toMatch(/^https:\/\/abiaconnect\.com\/auth\/confirm\?/)
    }
  })

  it('falls back to the original link rather than sending a broken one', () => {
    expect(brandedAuthLink('not a url')).toBe('not a url')
    expect(brandedAuthLink(`${SUPA}?type=signup`)).toBe(`${SUPA}?type=signup`)
    expect(brandedAuthLink(`${SUPA}?token=${HASH}&type=weird`)).toBe(`${SUPA}?token=${HASH}&type=weird`)
  })
})

describe('/auth/confirm page', () => {
  beforeEach(() => verifyOtp.mockReset())

  const renderAt = async (url: string) => {
    const { default: AuthConfirm } = await import('@/pages/AuthConfirm')
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/" element={<div>home page</div>} />
          <Route path="/reset-password" element={<div>reset page</div>} />
          <Route path="/thread/:id" element={<div>thread page</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('verifies the link on our own site and continues to the page', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    await renderAt(`/auth/confirm?token_hash=${HASH}&type=signup&next=%2Fthread%2F7`)
    await screen.findByText('thread page')
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: HASH, type: 'signup' })
  })

  it('takes password resets to the reset page', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    await renderAt(`/auth/confirm?token_hash=${HASH}&type=recovery&next=%2F`)
    await screen.findByText('reset page')
  })

  it('never continues to another website', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    await renderAt(`/auth/confirm?token_hash=${HASH}&type=signup&next=%2F%2Fevil.example`)
    await screen.findByText('home page')
  })

  it('shows a friendly message for an expired link, without backend details', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid at https://tnwgnowjmrbjugheorkv.supabase.co' } })
    await renderAt(`/auth/confirm?token_hash=${HASH}&type=signup`)
    await waitFor(() => expect(screen.getByText('Link invalid or expired')).toBeInTheDocument())
    expect(document.body.textContent).not.toMatch(/supabase/i)
  })
})
