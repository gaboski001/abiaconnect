import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const profile = { current: null as null | Record<string, unknown> }
const saveProfile = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ data: profile.current, isLoading: false }) }))
vi.mock('@/lib/profileUpdate', () => ({ saveProfile: (...a: unknown[]) => saveProfile(...a) }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AddBirthdayPrompt } from './AddBirthdayPrompt'

const renderPrompt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AddBirthdayPrompt />
    </QueryClientProvider>,
  )

describe('AddBirthdayPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
    saveProfile.mockReset()
  })

  it('asks members without a birthday to add one, and saves it', async () => {
    profile.current = { id: 'u1', dob: null }
    saveProfile.mockResolvedValue({ error: null })
    renderPrompt()
    expect(screen.getByText(/Add your birthday so we can celebrate you/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1995-10-03' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save birthday' }))
    await waitFor(() => expect(saveProfile).toHaveBeenCalledWith('u1', { dob: '1995-10-03' }))
    await waitFor(() => expect(screen.queryByText(/Add your birthday/)).not.toBeInTheDocument())
  })

  it('stays hidden for members who already have a birthday', () => {
    profile.current = { id: 'u1', dob: '1990-01-15' }
    renderPrompt()
    expect(screen.queryByText(/Add your birthday/)).not.toBeInTheDocument()
  })

  it('"Not now" hides it and remembers that on this device', () => {
    profile.current = { id: 'u1', dob: null }
    const first = renderPrompt()
    fireEvent.click(screen.getAllByRole('button', { name: 'Not now' })[0])
    expect(screen.queryByText(/Add your birthday/)).not.toBeInTheDocument()
    first.unmount()
    renderPrompt()
    expect(screen.queryByText(/Add your birthday/)).not.toBeInTheDocument()
  })
})
