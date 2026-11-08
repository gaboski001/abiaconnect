import { describe, expect, it } from 'vitest'
import { NO_NETWORK_MESSAGE, isNetworkFailure, redact } from './redactError'

describe('redact', () => {
  it('turns "no internet" failures into plain words', () => {
    expect(redact(new TypeError('Failed to fetch'))).toBe(NO_NETWORK_MESSAGE)
    expect(redact('net::ERR_INTERNET_DISCONNECTED')).toBe(NO_NETWORK_MESSAGE)
    expect(redact(new Error('Failed to send a request to the Edge Function'))).toBe(NO_NETWORK_MESSAGE)
    expect(isNetworkFailure(new TypeError('Load failed'))).toBe(true)
  })

  it('leaves other messages alone', () => {
    expect(redact('Please write something first.')).toBe('Please write something first.')
    expect(isNetworkFailure(new Error('page failed'))).toBe(false)
  })
})
