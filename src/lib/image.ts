// Image utilities: convert uploaded images to WebP and provide a safe fallback
// for broken image links.

const TRANSPARENT_PIXEL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="hsl(220 14% 92%)"/></svg>',
  )

/**
 * Convert any browser-decodable image File/Blob to a WebP File.
 * Falls back to the original file if conversion is not supported (e.g. SVG, GIF
 * animations, or the browser cannot encode WebP).
 */
export async function toWebP(file: File, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/webp') return file
  // Skip formats we shouldn't rasterise.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file

  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close?.()

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    )
    if (!blob) return file

    const base = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${base}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}

/** Inline placeholder used by <img onError> when a remote image fails to load. */
export const IMAGE_FALLBACK = TRANSPARENT_PIXEL

/** onError handler that swaps the broken image for a neutral placeholder once. */
export function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  if (img.dataset.fallback === '1') return
  img.dataset.fallback = '1'
  img.src = IMAGE_FALLBACK
}
