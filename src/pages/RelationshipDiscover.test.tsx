import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const api = vi.hoisted(() => ({
  reactToProfile: vi.fn(),
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
  fireEvent.click(await screen.findByRole('tab', { name: /discover/i }))
}

// hidden: true so the card is still found while a dialog marks the page aria-hidden.
const currentName = () => screen.getByRole('link', { name: /tap card to view full profile/i, hidden: true }).textContent ?? ''

describe('Discover', () => {
  beforeEach(() => {
    api.reactToProfile.mockReset()
    api.reacted = new Set()
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
})
