import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetShareLinkCache, threadShareLink } from './shareLinks'

const SHARED = '058d6661-0720-46ae-aa0f-a90fc2065e72'
const OTHER = '11111111-2222-3333-4444-555555555555'

function mockIndex(response: Promise<Response>) {
  const fetchMock = vi.fn(() => response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('threadShareLink', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetShareLinkCache()
  })

  it('uses the share page for threads that have one', async () => {
    mockIndex(Promise.resolve(new Response(JSON.stringify({ [SHARED]: '/share/enyimba-first-win-2026-27.html' }))))
    expect(await threadShareLink(SHARED)).toBe('https://abiaconnect.com/share/enyimba-first-win-2026-27.html')
    expect(await threadShareLink(OTHER)).toBe(`https://abiaconnect.com/thread/${OTHER}`)
  })

  it('ignores entries that point anywhere else', async () => {
    mockIndex(Promise.resolve(new Response(JSON.stringify({ [SHARED]: 'https://evil.example/x.html' }))))
    expect(await threadShareLink(SHARED)).toBe(`https://abiaconnect.com/thread/${SHARED}`)
  })

  it('falls back to the thread link when the list cannot be read, and retries later', async () => {
    const failing = mockIndex(Promise.reject(new Error('offline')))
    expect(await threadShareLink(SHARED)).toBe(`https://abiaconnect.com/thread/${SHARED}`)
    expect(failing).toHaveBeenCalledTimes(1)
    mockIndex(Promise.resolve(new Response(JSON.stringify({ [SHARED]: '/share/enyimba-first-win-2026-27.html' }))))
    expect(await threadShareLink(SHARED)).toBe('https://abiaconnect.com/share/enyimba-first-win-2026-27.html')
  })

  it('reads the list once', async () => {
    const fetchMock = mockIndex(Promise.resolve(new Response(JSON.stringify({ [SHARED]: '/share/a.html' }))))
    await threadShareLink(SHARED)
    await threadShareLink(OTHER)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
