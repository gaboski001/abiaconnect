import { describe, expect, it } from 'vitest'
import { parseCallLog } from './Messages'

describe('call log entries', () => {
  it('reads voice and video calls', () => {
    expect(parseCallLog('[call:ended] 42s')).toEqual({ kind: 'ended', durationSec: 42, video: false })
    expect(parseCallLog('[call:ended:video] 75s')).toEqual({ kind: 'ended', durationSec: 75, video: true })
    expect(parseCallLog('[call:missed] No answer')).toEqual({ kind: 'missed', reason: 'No answer', video: false })
    expect(parseCallLog('[call:missed:video] User is busy')).toEqual({ kind: 'missed', reason: 'User is busy', video: true })
    expect(parseCallLog('hello')).toBeNull()
  })
})
