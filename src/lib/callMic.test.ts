import { describe, expect, it } from 'vitest'
import { freshMicWatch, MAX_MIC_RESTARTS, watchMic, type MicWatch } from './callMic'

const live = (energy: number | null, extra: Partial<{ muted: boolean; connected: boolean }> = {}) => ({
  energy,
  muted: false,
  connected: true,
  ...extra,
})

function run(readings: ReturnType<typeof live>[], start: MicWatch = freshMicWatch()) {
  let watch = start
  const restarts: number[] = []
  readings.forEach((r, i) => {
    const out = watchMic(watch, r)
    watch = out.watch
    if (out.restart) restarts.push(i)
  })
  return { watch, restarts }
}

describe('silent microphone during a call', () => {
  it('leaves a working microphone alone', () => {
    expect(run([live(0.1), live(0.2), live(0.3), live(0.4), live(0.5)]).restarts).toEqual([])
  })

  it('restarts it after about 6 seconds of total silence', () => {
    expect(run([live(0.1), live(0.1), live(0.1), live(0.1)]).restarts).toEqual([3])
  })

  it('never restarts while the member has muted themselves', () => {
    const readings = Array.from({ length: 8 }, () => live(0.1, { muted: true }))
    expect(run(readings).restarts).toEqual([])
  })

  it('waits until the call is connected', () => {
    const readings = Array.from({ length: 8 }, () => live(0, { connected: false }))
    expect(run(readings).restarts).toEqual([])
  })

  it('does nothing when the phone does not report sound levels', () => {
    expect(run(Array.from({ length: 8 }, () => live(null))).restarts).toEqual([])
  })

  it('gives up after a couple of tries', () => {
    const readings = Array.from({ length: 40 }, () => live(0.1))
    expect(run(readings).restarts).toHaveLength(MAX_MIC_RESTARTS)
  })

  it('starts counting again once sound comes back', () => {
    expect(run([live(0.1), live(0.1), live(0.1), live(0.2), live(0.2), live(0.2)]).restarts).toEqual([])
  })
})
