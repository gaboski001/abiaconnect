import { supabase } from '@/lib/supabase'

export interface ScanResult {
  clean: boolean
  stats?: Record<string, number>
  error?: string
  /** True when VirusTotal was unavailable and we allowed the file through. */
  fallback?: boolean
}

/**
 * Scans a file already uploaded to a Supabase Storage bucket using VirusTotal.
 * If the verdict is not clean, the caller MUST delete the object from storage.
 * If `fallback` is true, the scan service was unavailable but the file is allowed.
 */
export async function scanStorageObject(
  bucket: string,
  path: string,
): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke('scan-attachment', {
    body: { bucket, path },
  })
  if (error) {
    console.warn('scan-attachment invoke failed, falling back', error)
    return { clean: true, fallback: true, error: error.message }
  }
  return data as ScanResult
}

/**
 * Convenience: upload then scan. On a flagged verdict the object is removed and
 * the result is returned to the caller, who should surface an error to the user.
 */
export async function uploadAndScan(
  bucket: string,
  path: string,
  file: File | Blob,
  opts: { contentType?: string; upsert?: boolean } = {},
): Promise<ScanResult & { uploaded: boolean }> {
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: opts.contentType, upsert: opts.upsert })
  if (upErr) return { clean: false, uploaded: false, error: upErr.message }
  const result = await scanStorageObject(bucket, path)
  if (!result.clean) {
    await supabase.storage.from(bucket).remove([path])
    return { ...result, uploaded: false }
  }
  return { ...result, uploaded: true }
}
