import { describe, expect, it, vi, beforeEach } from 'vitest'

const toastFn = vi.hoisted(() => vi.fn())
vi.mock('@/lib/toast', () => ({ toast: toastFn }))

import { buildIn, checkForNewBuild, isBusy } from './freshBuild'

function running(src: string) {
  document.head.innerHTML = `<script type="module" src="${src}"></script>`
}

beforeEach(() => {
  toastFn.mockReset()
  window.history.pushState({}, '', '/')
})

describe('fresh build check', () => {
  it('reads the main script name from the home page', () => {
    expect(buildIn('<script type="module" crossorigin src="/assets/index-Ab_9.js"></script>')).toBe('/assets/index-Ab_9.js')
    expect(buildIn('<html></html>')).toBeNull()
  })

  it('reloads when a newer version is published', async () => {
    running('/assets/index-OLD.js')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<script src="/assets/index-NEW.js"></script>')))
    const reload = vi.fn()
    await checkForNewBuild(reload)
    expect(reload).toHaveBeenCalled()
  })

  it('does nothing when already up to date', async () => {
    running('/assets/index-SAME.js')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<script src="/assets/index-SAME.js"></script>')))
    const reload = vi.fn()
    await checkForNewBuild(reload)
    expect(reload).not.toHaveBeenCalled()
  })

  it('asks first instead of reloading in a live room or while writing', async () => {
    expect(isBusy('/live/abc')).toBe(true)
    expect(isBusy('/create-thread')).toBe(true)
    expect(isBusy('/')).toBe(false)
    window.history.pushState({}, '', '/live/abc')
    running('/assets/index-OLD.js')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<script src="/assets/index-NEW.js"></script>')))
    const reload = vi.fn()
    await checkForNewBuild(reload)
    expect(reload).not.toHaveBeenCalled()
    expect(toastFn).toHaveBeenCalledWith('A new version of AbiaConnect is ready.', expect.objectContaining({ id: 'new-build' }))
  })
})
