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

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h })

  // @ts-expect-error - dynamic canvas type
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  // @ts-expect-error - both canvases support drawImage
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const blob: Blob =
    'convertToBlob' in canvas
      ? // @ts-expect-error - OffscreenCanvas
        await canvas.convertToBlob({ type: 'image/webp', quality })
      : await new Promise<Blob>((resolve, reject) => {
          // @ts-expect-error - HTMLCanvasElement
          canvas.toBlob(
            (b: Blob | null) => (b ? resolve(b) : reject(new Error('encode failed'))),
            'image/webp',
            quality,
          )
        })

  const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
  return new File([blob], name, { type: 'image/webp' })
}
