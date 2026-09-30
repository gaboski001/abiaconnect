/**
 * Client-side image compression → WebP.
 * - Skips animated GIFs (canvas would freeze them to one frame).
 * - Downscales so the longest edge is ≤ maxEdge (default 1600px).
 * - Falls back to the original file if the browser can't encode WebP
 *   or the "compressed" output is somehow larger.
 */
export async function compressToWebp(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<{ file: File; converted: boolean }> {
  const maxEdge = opts.maxEdge ?? 1600
  const quality = opts.quality ?? 0.82

  if (file.type === 'image/gif') return { file, converted: false }
  if (!/^image\//.test(file.type)) return { file, converted: false }

  const bitmap = await loadBitmap(file)
  if (!bitmap) return { file, converted: false }

  const { width, height } = bitmap
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { file, converted: false }
  ctx.drawImage(bitmap, 0, 0, w, h)
  if ('close' in bitmap) (bitmap as ImageBitmap).close()

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  )
  if (!blob || blob.size === 0) return { file, converted: false }
  if (blob.size >= file.size && file.type === 'image/webp') {
    return { file, converted: false }
  }

  const base = file.name.replace(/\.[^./\\]+$/, '') || 'image'
  const out = new File([blob], `${base}.webp`, { type: 'image/webp' })
  return { file: out, converted: true }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      return await createImageBitmap(file)
    }
  } catch {
    // fall through to <img> path
  }
  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}
