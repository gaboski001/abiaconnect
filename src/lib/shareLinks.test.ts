import { afterEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))

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
    rpc.mockReset()
  })

  it('uses the share page for threads that have one', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    mockIndex(Promise.resolve(new Response(JSON.stringify({ [SHARED]: '/share/enyimba-first-win-2026-27.html' }))))
    expect(await threadShareLink(SHARED)).toBe('https://abiaconnect.com/share/enyimba-first-win-2026-27.html')
    expect(await threadShareLink(OTHER)).toBe(`https://abiaconnect.com/thread/${OTHER}`)
  })

  it('ignores entries that point anywhere else', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    mockIndex(Promise.resolve(new Response(JSON.stringify({ [SHARED]: 'https://evil.example/x.html' }))))
    expect(await threadShareLink(SHARED)).toBe(`https://abiaconnect.com/thread/${SHARED}`)
  })

  it('falls back to the thread link when the list cannot be read, and retries later', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const failing = mockIndex(Promise.reject(new Error('offline')))
    expect(await threadShareLink(SHARED)).toBe(`https://abiaconnect.com/thread/${SHARED}`)
    expect(failing).toHaveBeenCalledTimes(1)
    mockIndex(Promise.resolve(new Response(JSON.stringify({ [SHARED]: '/share/enyimba-first-win-2026-27.html' }))))
    expect(await threadShareLink(SHARED)).toBe('https://abiaconnect.com/share/enyimba-first-win-2026-27.html')
  })

  it('reads the list once', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const fetchMock = mockIndex(Promise.resolve(new Response(JSON.stringify({ [SHARED]: '/share/a.html' }))))
    await threadShareLink(SHARED)
    await threadShareLink(OTHER)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses the forum share page for a Newsdesk bot thread', async () => {
    mockIndex(Promise.resolve(new Response(JSON.stringify({ [SHARED]: '/share/a.html' }))))
    rpc.mockResolvedValue({ data: `/share/forum-business-commerce.html?t=${OTHER}`, error: null })
    expect(await threadShareLink(OTHER)).toBe(`https://abiaconnect.com/share/forum-business-commerce.html?t=${OTHER}`)
    expect(rpc).toHaveBeenCalledWith('thread_share_path', { _thread_id: OTHER })
  })

  it('ignores a forum share page that is malformed or for another thread, and survives a failed lookup', async () => {
    mockIndex(Promise.resolve(new Response(JSON.stringify({ [SHARED]: '/share/a.html' }))))
    for (const data of ['https://evil.example/share/forum-x.html?t=' + OTHER, `/share/forum-x.html?t=${SHARED}`, '/share/forum-x.html']) {
      rpc.mockResolvedValue({ data, error: null })
      expect(await threadShareLink(OTHER), data).toBe(`https://abiaconnect.com/thread/${OTHER}`)
    }
    rpc.mockRejectedValue(new Error('offline'))
    expect(await threadShareLink(OTHER)).toBe(`https://abiaconnect.com/thread/${OTHER}`)
  })
})
