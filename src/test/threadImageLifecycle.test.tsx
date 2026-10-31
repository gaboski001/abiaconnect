import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { ThreadEditor } from '@/components/thread/ThreadEditor'

const storage = vi.hoisted(() => ({
  remove: vi.fn().mockResolvedValue({ error: null }),
  upload: vi.fn().mockResolvedValue({ error: null }),
  createSignedUrl: vi.fn().mockImplementation(async (path: string) => ({ data: { signedUrl: `https://example.com/storage/v1/object/sign/thread-attachments/${path}?token=test` }, error: null })),
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: () => storage } } }))
vi.mock('@/lib/imageCompress', () => ({ compressToWebp: async () => ({ file: new File(['webp'], 'photo.webp', { type: 'image/webp' }), converted: true }) }))

Element.prototype.scrollIntoView = () => {}
const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }
Range.prototype.getBoundingClientRect = () => rect as DOMRect
Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList

const html = '<figure data-type="image"><img src="https://example.com/storage/v1/object/sign/thread-attachments/u1/photo.webp?token=old" alt="Photo"></figure><p>A photo story</p>'
describe('thread photo lifecycle', () => {
  it('restores the image source from captioned image HTML instead of losing its link', async () => {
    const { container, unmount } = render(<ThreadEditor value={html} onChange={vi.fn()} />)
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toContain('u1/photo.webp'))
    unmount()
  })
  it('clearing after posting does not delete the posted image', async () => {
    const onChange = vi.fn()
    const { container, rerender, unmount } = render(<ThreadEditor value="" onChange={onChange} />)
    await waitFor(() => expect(container.querySelector('input[type=file]')).not.toBeNull())
    const input = container.querySelector('input[type=file]')
    if (!input) throw new Error('Missing photo upload')
    fireEvent.change(input, { target: { files: [new File(['original'], 'photo.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull())
    expect(storage.upload).toHaveBeenCalledWith(expect.stringMatching(/\.webp$/), expect.objectContaining({ type: 'image/webp' }), expect.objectContaining({ contentType: 'image/webp' }))
    rerender(<ThreadEditor value="" onChange={onChange} />)
    await waitFor(() => expect(container.querySelector('img')).toBeNull())
    unmount()
    expect(storage.remove).not.toHaveBeenCalled()
  })
})