import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Journey } from '@/lib/journey'

const journey = { current: null as Journey | null }
const toastSuccess = vi.fn()

vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }))
vi.mock('@/lib/journey', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/journey')>()),
  useJourney: () => ({ data: journey.current }),
  useRefreshJourney: () => vi.fn(),
  loadWelcomeThread: async () => 'w1',
  loadTopics: async () => [],
  claimStarterBonus: vi.fn(),
}))

import { StarterNextBar } from './StarterSteps'

function member(steps: Partial<Journey['steps']>): Journey {
  const now = new Date().toISOString()
  return {
    created_at: now,
    onboarded_at: now,
    lga: 'Umuahia North',
    interests: ['news'],
    lga_group: 'g1',
    bonus_claimed: false,
    steps: { interests: true, group: true, vote: false, hello: false, photo: false, ...steps },
  }
}

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <StarterNextBar />
    </MemoryRouter>,
  )

describe('StarterNextBar', () => {
  beforeEach(() => toastSuccess.mockReset())

  it('shows progress and the next step on the pages the steps lead to', () => {
    journey.current = member({})
    show('/polls')
    expect(screen.getByText('2 of 5 first steps done')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Next: Vote in a poll/ })).toHaveAttribute('href', '/polls')
  })

  it('stays off the home page, which has its own card', () => {
    journey.current = member({})
    show('/')
    expect(screen.queryByText(/first steps done/)).not.toBeInTheDocument()
  })

  it('offers the bonus right away once all 5 are done', () => {
    journey.current = member({ vote: true, hello: true, photo: true })
    show('/profile')
    expect(screen.getByText('All 5 steps done!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Claim 50 points/ })).toBeInTheDocument()
  })

  it('says so when a step has just been done', () => {
    journey.current = member({})
    const view = show('/polls')
    journey.current = member({ vote: true })
    act(() =>
      view.rerender(
        <MemoryRouter initialEntries={['/polls']}>
          <StarterNextBar />
        </MemoryRouter>,
      ),
    )
    expect(toastSuccess).toHaveBeenCalledWith('Step done: vote in a poll ✓', { description: 'Next: say hello' })
    expect(screen.getByText('3 of 5 first steps done')).toBeInTheDocument()
  })

  it('goes away once the bonus is claimed', () => {
    journey.current = { ...member({ vote: true, hello: true, photo: true }), bonus_claimed: true }
    show('/polls')
    expect(screen.queryByText(/steps done/)).not.toBeInTheDocument()
  })
})
