import { afterEach, describe, expect, it, vi } from 'vitest'
import { liveReason } from './live'

const purchase = vi.hoisted(() => ({ allowed: true }))
vi.mock('@/lib/monetization/api', () => ({ canPurchaseHere: () => purchase.allowed }))

afterEach(() => {
  purchase.allowed = true
})

describe('liveReason', () => {
  it('turns the server reasons into plain words', () => {
    expect(liveReason('cannot_host:level_or_plan')).toMatch(/Level 5.*Premium/)
    expect(liveReason('stage_full')).toMatch(/stage is full/)
  })

  it('does not mention paid plans inside the Android app', () => {
    purchase.allowed = false
    expect(liveReason('cannot_host:level_or_plan')).toBe('Reach Level 5 (Influencer) to host.')
  })

  it('never shows that the monthly free minutes ran out', () => {
    expect(liveReason('month_used_up')).toBe(liveReason('busy'))
  })

  it('falls back to a general message', () => {
    expect(liveReason('something_new')).toMatch(/Something went wrong/)
    expect(liveReason(undefined)).toMatch(/Something went wrong/)
  })
})
