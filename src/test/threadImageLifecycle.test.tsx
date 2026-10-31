import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { ThreadEditor } from '@/components/thread/ThreadEditor'

const storage = vi.hoisted(() => ({ remove: vi.fn().mockResolvedValue({ error: null }) }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: () => storage } } }))

const html = '<figure data-type="image"><img src="https://example.com/storage/v1/object/sign/thread-attachments/u1/photo.webp?token=old" alt="Photo"></figure><p>A photo story</p>'
describe('thread photo lifecycle', () => {
  it('restores the image source from captioned image HTML instead of losing its link', async () => {
    const { container, unmount } = render(<ThreadEditor value={html} onChange={vi.fn()} />)
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toContain('u1/photo.webp'))
    unmount()
  })
  it('clearing after posting does not delete the posted image', async () => {
    const onChange = vi.fn()
    const { container, rerender, unmount } = render(<ThreadEditor value={html} onChange={onChange} />)
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    rerender(<ThreadEditor value="" onChange={onChange} />)
    await waitFor(() => expect(container.querySelector('img')).toBeNull())
    unmount()
    expect(storage.remove).not.toHaveBeenCalled()
  })
})