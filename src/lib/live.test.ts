import { describe, expect, it } from 'vitest'
import { liveReason } from './live'

describe('liveReason', () => {
  it('turns the server reasons into plain words', () => {
    expect(liveReason('cannot_host:level_or_plan')).toMatch(/Level 5/)
    expect(liveReason('stage_full')).toMatch(/stage is full/)
  })

  it('never shows that the monthly free minutes ran out', () => {
    expect(liveReason('month_used_up')).toBe(liveReason('busy'))
  })

  it('falls back to a general message', () => {
    expect(liveReason('something_new')).toMatch(/Something went wrong/)
    expect(liveReason(undefined)).toMatch(/Something went wrong/)
  })
})
