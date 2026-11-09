import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const rpc = vi.fn()
let signedIn = true
let admin = false

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => Promise.resolve({ data: [{ id: 'g1', name: 'Bende Union' }], error: null }),
      }
      return q
    },
  },
}))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: signedIn ? { id: 'me' } : null, isAdmin: admin, loading: false }),
}))
vi.mock('@/components/SEO', () => ({ SEO: () => null }))
vi.mock('@/components/mobile/NativeAuthLayout', () => ({ isNativeApp: () => false }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const savePdf = vi.fn(async () => {})
vi.mock('@/lib/contestPdf', async (orig) => ({
  ...(await orig<typeof import('@/lib/contestPdf')>()),
  certificatePages: () => ['page'],
  slipPages: () => ['page'],
  savePdf: (...a: unknown[]) => savePdf(...(a as [])),
  clearContestPrints: async () => {},
}))

import ContestDetail from './ContestDetail'
import ContestNew from './ContestNew'
import { positionWinners } from '@/lib/engagement'

const wrap = (ui: ReactNode, path = '/contests/c1') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/contests/new" element={ui} />
          <Route path="/contests/:contestId" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

const contest = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  title: 'Bende Union Executive 2026',
  description: null,
  subgroup_id: 'g1',
  subgroup_name: 'Bende Union',
  status: 'approved',
  phase: 'open',
  allow_group_voters: true,
  allow_code_voters: false,
  results_visibility: 'after_close',
  members_before_open: true,
  min_account_days: 0,
  is_public: true,
  created_at: '2026-11-01T10:00:00Z',
  starts_at: '2026-11-01T10:00:00Z',
  ends_at: '2099-11-20T10:00:00Z',
  review_note: null,
  is_manager: false,
  signed_in: true,
  positions: [
    { id: 'p1', title: 'Chairman', max_choices: 1 },
    { id: 'p2', title: 'Committee', max_choices: 2 },
  ],
  candidates: [
    { id: 'a', position_id: 'p1', name: 'Ada', bio: null, photo_url: null },
    { id: 'b', position_id: 'p1', name: 'Chidi', bio: null, photo_url: null },
    { id: 'x', position_id: 'p2', name: 'Obi', bio: null, photo_url: null },
    { id: 'y', position_id: 'p2', name: 'Uche', bio: null, photo_url: null },
    { id: 'z', position_id: 'p2', name: 'Kelechi', bio: null, photo_url: null },
  ],
  has_voted: false,
  eligible_by_group: true,
  group_block: null,
  turnout: 12,
  eligible_members: 40,
  results: null,
  results_announced_at: null,
  codes: null,
  ...over,
})

beforeEach(() => {
  signedIn = true
  admin = false
  rpc.mockReset()
})

describe('positionWinners', () => {
  const votes: Record<string, number> = { a: 5, b: 3, c: 3, d: 1 }
  const v = (id: string) => votes[id] ?? 0
  it('picks the top person, or the top N', () => {
    expect(positionWinners(['a', 'b', 'd'], v, 1)).toEqual({ winners: ['a'], tie: false })
    expect(positionWinners(['a', 'b', 'd'], v, 2)).toEqual({ winners: ['a', 'b'], tie: false })
  })
  it('flags a tie for the last winning place', () => {
    expect(positionWinners(['a', 'b', 'c'], v, 2)).toEqual({ winners: ['a'], tie: true })
    expect(positionWinners(['b', 'c'], v, 1)).toEqual({ winners: [], tie: true })
  })
  it('names nobody when there are no votes', () => {
    expect(positionWinners(['a', 'b'], () => 0, 1)).toEqual({ winners: [], tie: false })
  })
})

describe('Contest page', () => {
  it('one ballot for every position, with a confirm step listing the choices', async () => {
    rpc.mockImplementation(async (fn: string) => (fn === 'get_contest' ? { data: contest(), error: null } : { data: { ok: true }, error: null }))
    wrap(<ContestDetail />)
    const chairman = await screen.findByRole('region', { name: 'Chairman' })
    fireEvent.click(within(chairman).getByRole('radio', { name: /Ada/ }))
    const committee = screen.getByRole('region', { name: 'Committee' })
    fireEvent.click(within(committee).getByRole('checkbox', { name: /Obi/ }))
    fireEvent.click(within(committee).getByRole('checkbox', { name: /Uche/ }))
    // A third pick in "up to 2" is refused.
    fireEvent.click(within(committee).getByRole('checkbox', { name: /Kelechi/ }))
    expect(within(committee).getByRole('checkbox', { name: /Kelechi/ })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/12/)).toBeInTheDocument()
    expect(screen.getByText(/of 40 members who can \(30%\)/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cast my vote' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Ada')).toBeInTheDocument()
    expect(within(dialog).getByText('Obi, Uche')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit vote' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('cast_contest_ballot', { _contest: 'c1', _choices: ['a', 'x', 'y'], _code: null }))
  })

  it('explains in plain words why a late joiner cannot vote', async () => {
    rpc.mockResolvedValue({ data: contest({ eligible_by_group: false, group_block: 'joined_too_late' }), error: null })
    wrap(<ContestDetail />)
    expect(await screen.findByText(/already members of the group when this contest was created/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cast my vote|Choose a candidate/ })).toBeNull()
  })

  it('lets guests follow a public contest and invites them to sign in', async () => {
    signedIn = false
    rpc.mockResolvedValue({ data: contest({ signed_in: false, eligible_by_group: false, group_block: 'sign_in' }), error: null })
    wrap(<ContestDetail />)
    expect(await screen.findByText(/Following as a guest/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('shows the official result, with print and PDF, when voting has closed', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'get_contest'
        ? {
            data: contest({
              phase: 'closed',
              results: [
                { candidate_id: 'a', position_id: 'p1', votes: 9 },
                { candidate_id: 'b', position_id: 'p1', votes: 3 },
                { candidate_id: 'x', position_id: 'p2', votes: 7 },
                { candidate_id: 'y', position_id: 'p2', votes: 4 },
                { candidate_id: 'z', position_id: 'p2', votes: 4 },
              ],
            }),
            error: null,
          }
        : { data: true, error: null },
    )
    wrap(<ContestDetail />)
    expect(await screen.findByText('Official result')).toBeInTheDocument()
    expect(screen.getByText('Ada (9)')).toBeInTheDocument()
    expect(screen.getByText(/Obi \(7\) · tie to settle/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Print certificate/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Save certificate as PDF/ }))
    await waitFor(() => expect(savePdf).toHaveBeenCalledWith(['page'], 'bende-union-executive-2026-results.pdf'))
  })
})

describe('New contest', () => {
  it('a template fills in the positions, and the fairness settings are sent', async () => {
    admin = true
    rpc.mockResolvedValue({ data: 'new-id', error: null })
    wrap(<ContestNew />, '/contests/new')
    fireEvent.click(await screen.findByRole('button', { name: /Town union or association election/ }))
    expect(screen.getByLabelText('Position 1 name')).toHaveValue('President / Chairman')
    expect(screen.getByLabelText('Position 6 name')).toHaveValue('Public Relations Officer')
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'g1' } })
    for (let i = 1; i <= 6; i++) {
      const name = (screen.getByLabelText(`Position ${i} name`) as HTMLInputElement).value
      fireEvent.change(screen.getByLabelText(`${name} candidate 1 name`), { target: { value: `Person ${i}A` } })
      fireEvent.change(screen.getByLabelText(`${name} candidate 2 name`), { target: { value: `Person ${i}B` } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Publish contest' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('create_election', expect.anything()))
    const sent = rpc.mock.calls.find((c) => c[0] === 'create_election')![1]._c
    expect(sent.members_before_open).toBe(true)
    expect(sent.is_public).toBe(true)
    expect(sent.positions).toHaveLength(6)
    expect(sent.positions[0]).toEqual({ title: 'President / Chairman', max_choices: 1, candidates: [{ name: 'Person 1A' }, { name: 'Person 1B' }] })
  })
})
