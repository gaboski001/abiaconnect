// Client-side compression + upload helpers for chat attachments.
// - Images are re-encoded to WebP and downscaled to max 1600px.
// - Final payload must be <= 2MB after compression.

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024 // 2 MB
export const ATTACHMENT_TTL_HOURS = 48

const MAX_IMAGE_DIM = 1600

export function isImage(file: File) {
  return file.type.startsWith('image/')
}

export async function compressImageToWebp(file: File, quality = 0.82): Promise<File> {
  if (!isImage(file) || file.type === 'image/gif') return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  let blob: Blob
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    blob = await canvas.convertToBlob({ type: 'image/webp', quality })
  } else {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('encode failed'))),
        'image/webp',
        quality,
      )
    })
  }

  bitmap.close?.()
  const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
  return new File([blob], name, { type: 'image/webp' })
}
