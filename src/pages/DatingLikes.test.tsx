import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { LikesReceived } from '@/lib/monetization/api'

const state = vi.hoisted(() => ({ likes: null as unknown as LikesReceived }))

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }))
vi.mock('@/components/ui/UserAvatar', () => ({ UserAvatar: () => <span data-testid="avatar" /> }))
vi.mock('@/components/SEO', () => ({ SEO: () => null }))
vi.mock('@/lib/monetization/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/monetization/api')>()),
  canPurchaseHere: () => true,
  track: () => {},
  getLikesReceived: async () => state.likes,
  getMatches: async () => [],
  markLikesSeen: async () => {},
  reactToProfile: async () => ({ status: 'ok' }),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: () => Promise.resolve({ data: null, error: null }) } }))

import DatingLikes from './DatingLikes'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/relationship/likes']}>
        <DatingLikes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Likes you', () => {
  beforeEach(() => {
    state.likes = { entitled: false, total: 2, unseen: 2, preview_count: 2, items: [] }
  })

  it('free users see a count and a locked preview, never identities', async () => {
    renderPage()
    expect(await screen.findByText('2 people like you')).toBeInTheDocument()
    expect(screen.getByText('Upgrade to see who they are.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /see who likes you/i })).toBeInTheDocument()
    expect(screen.queryByTestId('avatar')).not.toBeInTheDocument()
  })

  it('premium users see who liked them and can like back', async () => {
    state.likes = {
      entitled: true,
      total: 1,
      unseen: 1,
      preview_count: 0,
      items: [
        {
          user_id: 'u2',
          liked_at: new Date().toISOString(),
          unseen: true,
          display_name: 'Ada',
          username: 'ada',
          avatar_url: null,
          headline: null,
          dob: null,
          lga: 'Umuahia North',
          photo: null,
        },
      ],
    }
    renderPage()
    expect(await screen.findByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Umuahia North')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /like back/i })).toBeInTheDocument()
  })
})
