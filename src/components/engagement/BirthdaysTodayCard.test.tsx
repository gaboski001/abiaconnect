import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const rpc = vi.fn()
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
let dob: string | null = null
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ data: { dob, display_name: 'Ada Obi' } }) }))

import { BirthdaysTodayCard } from './BirthdaysTodayCard'
import { BirthdayGreeting } from './BirthdayGreeting'

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  rpc.mockReset()
  dob = null
})

describe('Birthdays today card', () => {
  it('shows nothing when nobody is celebrating', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const { container } = wrap(<BirthdaysTodayCard />)
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('birthdays_today', undefined))
    expect(container).toBeEmptyDOMElement()
  })

  it('lets a member send a ready-made wish', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'birthdays_today'
        ? { data: [{ id: 'u1', name: 'Chidi Okafor', username: 'chidi', avatar_url: null, wishes: 2, wished: false }], error: null }
        : { data: { ok: true, already: false }, error: null },
    )
    wrap(<BirthdaysTodayCard />)
    expect(await screen.findByText('A birthday today')).toBeInTheDocument()
    expect(screen.getByText('2 wishes so far')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send wishes' }))
    expect(await screen.findByText(/Wish Chidi a happy birthday/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ụbọchị ọmụmụ ọma/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /Send wishes/ }).at(-1)!)
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('send_birthday_wish', { _to: 'u1', _message: 'Ụbọchị ọmụmụ ọma! 🎂 Chukwu gọzie gị.' }),
    )
  })

  it('shows “Wished” once a member has sent their wish', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'u1', name: 'Chidi', username: null, avatar_url: null, wishes: 1, wished: true }], error: null })
    wrap(<BirthdaysTodayCard />)
    expect(await screen.findByText('Wished')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send wishes' })).toBeNull()
  })
})

describe('Birthday card for the member celebrating', () => {
  it('lists the wishes they received, the team’s first', async () => {
    const t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
    dob = `1990-${t.slice(5)}`
    rpc.mockResolvedValue({
      data: [
        { from_id: 'a', name: 'The AbiaConnect team', avatar_url: null, message: 'From all of us', from_team: true, created_at: '' },
        { from_id: 'b', name: 'Chidi', avatar_url: null, message: 'Happy birthday!', from_team: false, created_at: '' },
      ],
      error: null,
    })
    wrap(<BirthdayGreeting />)
    expect(await screen.findByText(/2 people have sent you birthday wishes/)).toBeInTheDocument()
    expect(screen.getByText('From all of us')).toBeInTheDocument()
    expect(screen.getByText('Happy birthday!')).toBeInTheDocument()
  })
})
