import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressToWebp } from '@/lib/imageCompress'

afterEach(() => vi.restoreAllMocks())
describe('required WebP uploads', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
    it(`encodes ${type} as actual WebP bytes and filename`, async () => {
      vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 200, height: 100, close: vi.fn() }))
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['converted'], { type: 'image/webp' })))
      const result = await compressToWebp(new File(['source'], 'photo.png', { type }), { requireWebp: true })
      expect(result.file.type).toBe('image/webp')
      expect(result.file.name).toBe('photo.webp')
    })
  }
  it('rejects browsers that silently encode PNG rather than uploading non-WebP', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 100, height: 100, close: vi.fn() }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })))
    await expect(compressToWebp(new File(['source'], 'photo.png', { type: 'image/png' }), { requireWebp: true })).rejects.toThrow(/cannot convert/)
  })
})