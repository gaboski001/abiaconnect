import { describe, expect, it } from 'vitest'
import { describeCall, parseCallLog } from './Messages'

describe('call log entries', () => {
  it('reads voice and video calls', () => {
    expect(parseCallLog('[call:ended] 42s')).toEqual({ kind: 'ended', durationSec: 42, video: false })
    expect(parseCallLog('[call:ended:video] 75s')).toEqual({ kind: 'ended', durationSec: 75, video: true })
    expect(parseCallLog('[call:missed] No answer')).toEqual({ kind: 'missed', reason: 'No answer', video: false })
    expect(parseCallLog('[call:missed:video] User is busy')).toEqual({ kind: 'missed', reason: 'User is busy', video: true })
    expect(parseCallLog('hello')).toBeNull()
  })
})

describe('describeCall', () => {
  it('reads the same call from each side', () => {
    const missed = parseCallLog('[call:missed:video] No answer')!
    expect(describeCall(missed, false).label).toBe('Missed video call')
    expect(describeCall(missed, true).label).toBe('Cancelled call')
    const ended = parseCallLog('[call:ended] 75s')!
    expect(describeCall(ended, true)).toMatchObject({ label: 'Outgoing voice call', detail: '1:15' })
    expect(describeCall(ended, false).label).toBe('Incoming voice call')
  })
})
