import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const createSignedUrl = vi.fn(async (path: string) => ({ data: { signedUrl: `https://x.supabase.co/storage/v1/object/sign/private/${path}?token=t` } }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        }),
        createSignedUrl,
      }),
    },
  },
}))

import { useSignedUrl } from './useSignedUrl'

describe('useSignedUrl', () => {
  it('uses the public URL for avatars without calling createSignedUrl', () => {
    createSignedUrl.mockClear()
    const { result } = renderHook(() => useSignedUrl('user-1/123.webp', 'avatars'))
    expect(result.current).toBe('https://x.supabase.co/storage/v1/object/public/avatars/user-1/123.webp')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('converts an old signed avatar URL into the public URL', () => {
    const old = 'https://x.supabase.co/storage/v1/object/sign/avatars/user-1/123.webp?token=abc'
    const { result } = renderHook(() => useSignedUrl(old, 'avatars'))
    expect(result.current).toBe('https://x.supabase.co/storage/v1/object/public/avatars/user-1/123.webp')
  })

  it('uses the public URL for site assets', () => {
    const { result } = renderHook(() => useSignedUrl('logos/logo.webp', 'site-assets'))
    expect(result.current).toBe('https://x.supabase.co/storage/v1/object/public/site-assets/logos/logo.webp')
  })

  it('still signs URLs for private buckets', async () => {
    createSignedUrl.mockClear()
    const { result } = renderHook(() => useSignedUrl('conv-1/file.png', 'chat-attachments'))
    await waitFor(() => expect(result.current).toContain('/object/sign/'))
    expect(createSignedUrl).toHaveBeenCalledOnce()
  })
})
