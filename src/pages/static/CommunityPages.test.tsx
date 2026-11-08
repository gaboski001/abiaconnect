import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const rpc = vi.fn()
let signedIn = true

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: signedIn ? { id: 'me' } : null }) }))
vi.mock('@/hooks/useSignedUrl', () => ({ useSignedUrl: () => null }))
vi.mock('@/components/layout/StaticPage', () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))
const toastSuccess = vi.fn()
vi.mock('@/lib/toast', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }))

import SuccessStories from './SuccessStories'
import MemberSpotlight from './MemberSpotlight'
import Events from './Events'

const wrap = (ui: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  signedIn = true
  rpc.mockReset()
  toastSuccess.mockReset()
  rpc.mockResolvedValue({ data: [], error: null })
})

describe('Success Stories', () => {
  it('shows an honest empty state instead of made-up people', async () => {
    wrap(<SuccessStories />)
    expect(await screen.findByText('No stories yet')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('list_success_stories', { _limit: 50 })
  })

  it('shows published stories', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'list_success_stories'
        ? { data: [{ id: 's1', title: 'Aba shoemaker exports to Ghana', story: 'A long true story.', tag: 'Business', person_name: 'Chinedu', published_at: '2026-11-01T10:00:00Z' }], error: null }
        : { data: [], error: null },
    )
    wrap(<SuccessStories />)
    expect(await screen.findByText('Aba shoemaker exports to Ghana')).toBeInTheDocument()
    expect(screen.getByText('About Chinedu')).toBeInTheDocument()
  })

  it('asks visitors to sign in before sharing', async () => {
    signedIn = false
    wrap(<SuccessStories />)
    expect(await screen.findByRole('link', { name: 'Sign in to share a story' })).toHaveAttribute('href', '/login')
  })
})

describe('Member Spotlight', () => {
  it('saves a nomination by username', async () => {
    wrap(<MemberSpotlight />)
    expect(await screen.findByText('Our first Member of the Month is coming soon')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Their username'), { target: { value: '@ikenna' } })
    fireEvent.change(screen.getByLabelText('Why do they deserve it?'), { target: { value: 'Always welcomes newcomers and answers their questions.' } })
    fireEvent.click(screen.getByRole('button', { name: /Send nomination/ }))
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('submit_spotlight_nomination', { _username: '@ikenna', _reason: 'Always welcomes newcomers and answers their questions.' }),
    )
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
  })
})

describe('Events', () => {
  it('lists upcoming events by month', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'list_upcoming_events'
        ? {
            data: [{ id: 'e1', title: 'Umuahia town hall', description: 'A friendly evening.', starts_at: '2027-01-10T17:00:00Z', ends_at: null, place: 'Civic Centre, Umuahia', online_link: null, lga: 'Umuahia North', organiser_name: 'Ada' }],
            error: null,
          }
        : { data: [], error: null },
    )
    wrap(<Events />)
    expect(await screen.findByText('Umuahia town hall')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'January 2027' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Add to my calendar/ })).toHaveAttribute('href', expect.stringMatching(/^data:text\/calendar/))
  })

  it('shows an empty state when nothing is planned', async () => {
    wrap(<Events />)
    expect(await screen.findByText('No upcoming events yet')).toBeInTheDocument()
  })
})
