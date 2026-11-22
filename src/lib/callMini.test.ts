import { describe, expect, it } from 'vitest'
import { canMinimiseCall, clampMini, formatCallTime, MINI_MARGIN, snapMini, startMini } from './callMini'

const view = { width: 400, height: 800 }
const box = { width: 120, height: 170 }

describe('floating call window', () => {
  it('stays on screen', () => {
    expect(clampMini({ left: -50, top: -50 }, box, view)).toEqual({ left: MINI_MARGIN, top: MINI_MARGIN })
    expect(clampMini({ left: 999, top: 999 }, box, view)).toEqual({
      left: 400 - 120 - MINI_MARGIN,
      top: 800 - 170 - MINI_MARGIN,
    })
  })

  it('keeps clear of the status bar and gesture bar', () => {
    const spot = clampMini({ left: 0, top: 0 }, box, { ...view, safeTop: 30, safeBottom: 20 })
    expect(spot.top).toBe(MINI_MARGIN + 30)
    expect(clampMini({ left: 0, top: 999 }, box, { ...view, safeBottom: 20 }).top).toBe(800 - 170 - MINI_MARGIN - 20)
  })

  it('slides to the nearer side after a drag', () => {
    expect(snapMini({ left: 100, top: 300 }, box, view).left).toBe(MINI_MARGIN)
    expect(snapMini({ left: 220, top: 300 }, box, view).left).toBe(400 - 120 - MINI_MARGIN)
    expect(snapMini({ left: 220, top: 300 }, box, view).top).toBe(300)
  })

  it('starts top right, under the header', () => {
    expect(startMini(box, view)).toEqual({ left: 400 - 120 - MINI_MARGIN, top: 72 })
  })

  it('only minimises a call that is going, never one still ringing in', () => {
    expect(canMinimiseCall('connected', 'outgoing')).toBe(true)
    expect(canMinimiseCall('calling', 'outgoing')).toBe(true)
    expect(canMinimiseCall('connecting', 'incoming')).toBe(true)
    expect(canMinimiseCall('ringing', 'incoming')).toBe(false)
    expect(canMinimiseCall('ended', 'outgoing')).toBe(false)
    expect(canMinimiseCall('idle', null)).toBe(false)
  })
})

describe('formatCallTime', () => {
  it('shows minutes and seconds, and hours when needed', () => {
    expect(formatCallTime(65_000)).toBe('1:05')
    expect(formatCallTime(3_723_000)).toBe('1:02:03')
    expect(formatCallTime(-5)).toBe('0:00')
  })
})
