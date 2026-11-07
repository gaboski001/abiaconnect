import { afterEach, describe, expect, it, vi } from 'vitest'
import { isDatabaseRead, keepDatabaseReadsFresh } from './freshDatabaseReads'

const REST = 'https://example.supabase.co/rest/v1/threads?select=id'
const realFetch = window.fetch

afterEach(() => {
  window.fetch = realFetch
})

describe('fresh database reads', () => {
  it('covers database reads only', () => {
    expect(isDatabaseRead(REST, undefined)).toBe(true)
    expect(isDatabaseRead(REST, 'POST')).toBe(false)
    expect(isDatabaseRead('https://example.supabase.co/auth/v1/user', 'GET')).toBe(false)
    expect(isDatabaseRead('https://abiaconnect.com/assets/a.js', 'GET')).toBe(false)
  })

  it('skips the browser copy for a read and keeps its headers', async () => {
    const spy = vi.fn().mockResolvedValue(new Response('[]'))
    window.fetch = spy
    keepDatabaseReadsFresh()
    await window.fetch(REST, { headers: { apikey: 'k' } })
    expect(spy.mock.calls[0][1]).toEqual({ headers: { apikey: 'k' }, cache: 'no-store' })
  })

  it('leaves everything else untouched', async () => {
    const spy = vi.fn().mockResolvedValue(new Response('{}'))
    window.fetch = spy
    keepDatabaseReadsFresh()
    const init = { method: 'POST', body: '{}' }
    await window.fetch(REST, init)
    expect(spy.mock.calls[0][1]).toBe(init)
  })
})
