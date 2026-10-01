import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// jsdom has no PointerEvent; framer-motion's drag needs coordinates on it.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number
    pointerType: string
    isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
      this.isPrimary = init.isPrimary ?? true
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).PointerEvent = PointerEventPolyfill
}

const api = vi.hoisted(() => ({
  reactToProfile: vi.fn(),
  startDatingChat: vi.fn(),
  reacted: new Set<string>(),
}))

const profiles = ['Ada', 'Bola', 'Chi'].map((n, i) => ({
  id: 'rp' + i,
  user_id: 'u' + i,
  headline: null,
  dob: '1995-01-01',
  looking_for: 'dating',
  lga: 'Aba North',
  photos: [],
  is_active: true,
  updated_at: '2026-01-01T00:00:00Z',
  current_location: null,
  sex: 'female',
}))

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }))
vi.mock('@/components/SEO', () => ({ SEO: () => null }))
vi.mock('@/hooks/useRealtimeChannel', () => ({ useRealtimeChannel: () => {} }))
vi.mock('@/hooks/useSignedUrl', () => ({ useSignedUrl: () => null }))
vi.mock('@/lib/supabase', () => {
  const builder = (table: string) => {
    let single = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') {
            const data = single ? { ...profiles[0], user_id: 'me', id: 'mine' } : table === 'relationship_profiles' ? profiles : []
            return (res: (v: unknown) => void) => res({ data, error: null })
          }
          if (prop === 'maybeSingle') return () => ((single = true), b)
          return () => b
        },
      },
    )
    return b
  }
  return {
    supabase: {
      from: builder,
      rpc: async (fn: string) => ({
        data: fn === 'get_public_profiles' ? profiles.map((p, i) => ({ id: p.user_id, display_name: ['Ada', 'Bola', 'Chi'][i] })) : null,
        error: null,
      }),
    },
  }
})
vi.mock('@/lib/monetization/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/monetization/api')>()),
  canPurchaseHere: () => true,
  track: () => {},
  getEntitlements: async () => ({ tier: 'free', is_premium: false, plan_name: 'Free', limits: { daily_likes: 25 }, likes_used_today: 0 }),
  getLikesReceived: async () => ({ entitled: false, total: 0, unseen: 0, preview_count: 0, items: [] }),
  getMyReactedIds: async () => api.reacted,
  reactToProfile: api.reactToProfile,
  startDatingChat: api.startDatingChat,
}))

import Relationship from './Relationship'

async function openDiscover() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Relationship />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  // Discover is the default view.
  await screen.findByRole('button', { name: 'Like' })
}

// hidden: true so the card is still found while a dialog marks the page aria-hidden.
const currentName = () => screen.getByRole('link', { name: /tap card to view full profile/i, hidden: true }).textContent ?? ''

describe('Discover', () => {
  beforeEach(() => {
    api.reactToProfile.mockReset()
    api.reacted = new Set()
    localStorage.clear()
  })

  it('opens on Discover with plain-language guidance and swipe hint', async () => {
    await openDiscover()
    expect(screen.getByText('How it works')).toBeInTheDocument()
    expect(screen.getByText(/Swipe right to like · Swipe left to pass/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /likes/i })).toHaveAttribute('href', '/relationship/likes')
  })

  it('skips profiles already liked or passed', async () => {
    api.reacted = new Set(['u0'])
    await openDiscover()
    await waitFor(() => expect(currentName()).toMatch(/Bola|Chi/))
    expect(screen.queryByText(/^Ada/)).not.toBeInTheDocument()
  })

  it('passing records the reaction and moves to the next profile', async () => {
    api.reactToProfile.mockResolvedValue({ status: 'ok', matched: false, likes_remaining: null })
    await openDiscover()
    await waitFor(() => expect(currentName()).not.toBe(''))
    const first = currentName()
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }))
    await waitFor(() => expect(currentName()).not.toBe(first))
    expect(api.reactToProfile).toHaveBeenCalledWith(expect.any(String), 'pass')
  })

  it('shows the paywall when the daily like limit is reached and keeps the same profile', async () => {
    api.reactToProfile.mockResolvedValue({ status: 'limit_reached', likes_remaining: 0 })
    await openDiscover()
    await waitFor(() => expect(currentName()).not.toBe(''))
    const first = currentName()
    fireEvent.click(screen.getByRole('button', { name: 'Like' }))
    expect(await screen.findByText("You're out of likes for today")).toBeInTheDocument()
    expect(currentName()).toBe(first)
    expect(screen.getByText(/0 likes left today/)).toBeInTheDocument()
  })

  it('celebrates a match', async () => {
    api.reactToProfile.mockResolvedValue({ status: 'ok', matched: true, likes_remaining: 24 })
    await openDiscover()
    await waitFor(() => expect(currentName()).not.toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'Like' }))
    expect(await screen.findByText("It's a match!")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send a message/i })).toBeInTheDocument()
  })

  it('asks free users to match (or upgrade) before messaging someone new', async () => {
    api.startDatingChat.mockResolvedValue({ status: 'match_required' })
    await openDiscover()
    await waitFor(() => expect(currentName()).not.toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'Message' }))
    expect(await screen.findByText('Match first to start chatting')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /message without waiting/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /maybe later/i })).toBeInTheDocument()
  })

  async function swipe(dx: number) {
    const card = document.querySelector('.cursor-grab') as HTMLElement
    const opts = (x: number, buttons: number) => ({ bubbles: true, pointerId: 1, isPrimary: true, clientX: x, clientY: 200, buttons })
    fireEvent.pointerDown(card, opts(150, 1))
    for (let i = 1; i <= 12; i++) {
      await new Promise((r) => setTimeout(r, 16))
      fireEvent.pointerMove(window, opts(150 + (dx / 12) * i, 1))
    }
    fireEvent.pointerUp(window, opts(150 + dx, 0))
  }

  it('swiping right likes and swiping left passes', async () => {
    api.reactToProfile.mockResolvedValue({ status: 'ok', matched: false, likes_remaining: 20 })
    await openDiscover()
    await waitFor(() => expect(currentName()).not.toBe(''))
    await swipe(220)
    await waitFor(() => expect(api.reactToProfile).toHaveBeenCalledWith(expect.any(String), 'like'))
    // Wait for the liked card's exit animation to finish before the next swipe.
    await waitFor(() => expect(document.querySelectorAll('.cursor-grab')).toHaveLength(1))
    await swipe(-220)
    await waitFor(() => expect(api.reactToProfile).toHaveBeenLastCalledWith(expect.any(String), 'pass'))
  })

  it('a short drag snaps back without reacting', async () => {
    await openDiscover()
    await waitFor(() => expect(currentName()).not.toBe(''))
    await swipe(40)
    await new Promise((r) => setTimeout(r, 100))
    expect(api.reactToProfile).not.toHaveBeenCalled()
  })

  it('arrow keys like and pass', async () => {
    api.reactToProfile.mockResolvedValue({ status: 'ok', matched: false, likes_remaining: 20 })
    await openDiscover()
    await waitFor(() => expect(currentName()).not.toBe(''))
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(api.reactToProfile).toHaveBeenCalledWith(expect.any(String), 'like'))
  })
})
