// Checks that an uploaded app release really is an Android APK or iOS IPA.
// Pure TypeScript (no Deno APIs) so it is unit tested in src/test.
//
// APK and IPA files are ZIP archives. We never trust the file name or the
// Content-Type the client sends; instead we read the ZIP's own index (the
// "central directory" at the end of the file) and require the entries every
// real package has: AndroidManifest.xml + classes.dex for Android, and
// Payload/<App>.app/Info.plist for iOS.

export type ReleasePlatform = 'android' | 'ios'

export const RELEASE_MAX_BYTES = 100 * 1024 * 1024 // 100 MB (current APK is ~12 MB)
export const RELEASE_MIN_BYTES = 4 * 1024
export const RELEASE_EXT: Record<ReleasePlatform, string> = { android: 'apk', ios: 'ipa' }
export const RELEASE_CONTENT_TYPE: Record<ReleasePlatform, string> = {
  android: 'application/vnd.android.package-archive',
  ios: 'application/octet-stream',
}
export const SEMVER_RE = /^\d{1,4}\.\d{1,4}\.\d{1,6}(-[0-9A-Za-z.]{1,20})?$/

export type PackageCheck = { ok: true; entries: number } | { ok: false; reason: string }

const ZIP_LOCAL_HEADER = 0x04034b50
const ZIP_CENTRAL_HEADER = 0x02014b50
const ZIP_END_OF_DIR = 0x06054b50
const MAX_ENTRIES = 65_000

function u16(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8)
}
function u32(b: Uint8Array, o: number) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
}

/** Reads the file names listed in a ZIP's central directory, or explains why it can't. */
export function listZipEntries(bytes: Uint8Array): { ok: true; names: string[] } | { ok: false; reason: string } {
  if (bytes.length < 22 || u32(bytes, 0) !== ZIP_LOCAL_HEADER) {
    return { ok: false, reason: 'not a ZIP-based app package' }
  }
  // The end-of-directory record sits in the last 22 bytes + up to 64 KB of comment.
  const stop = Math.max(0, bytes.length - 22 - 0xffff)
  let eocd = -1
  for (let i = bytes.length - 22; i >= stop; i--) {
    if (u32(bytes, i) === ZIP_END_OF_DIR) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return { ok: false, reason: 'damaged package (no ZIP index)' }

  const count = u16(bytes, eocd + 10)
  const dirSize = u32(bytes, eocd + 12)
  const dirOffset = u32(bytes, eocd + 16)
  if (count === 0xffff || dirOffset === 0xffffffff) return { ok: false, reason: 'unsupported package format' }
  if (count === 0 || count > MAX_ENTRIES) return { ok: false, reason: 'damaged package (bad entry count)' }
  if (dirOffset + dirSize > eocd) return { ok: false, reason: 'damaged package (index out of range)' }

  const names: string[] = []
  const dec = new TextDecoder('utf-8', { fatal: false })
  let p = dirOffset
  for (let n = 0; n < count; n++) {
    if (p + 46 > eocd || u32(bytes, p) !== ZIP_CENTRAL_HEADER) {
      return { ok: false, reason: 'damaged package (bad index entry)' }
    }
    const nameLen = u16(bytes, p + 28)
    const extraLen = u16(bytes, p + 30)
    const commentLen = u16(bytes, p + 32)
    const localOffset = u32(bytes, p + 42)
    if (localOffset >= dirOffset) return { ok: false, reason: 'damaged package (entry out of range)' }
    const end = p + 46 + nameLen
    if (end > eocd) return { ok: false, reason: 'damaged package (name out of range)' }
    names.push(dec.decode(bytes.subarray(p + 46, end)))
    p = end + extraLen + commentLen
  }
  return { ok: true, names }
}

/** Unsafe archive paths (absolute, parent directory, drive letters, NUL). */
function unsafeEntry(name: string) {
  return (
    name.length === 0 ||
    name.includes('\0') ||
    name.includes('\\') ||
    name.startsWith('/') ||
    /^[A-Za-z]:/.test(name) ||
    name.split('/').some((part) => part === '..')
  )
}

/** Confirms the bytes are a genuine package for the platform. */
export function checkReleasePackage(platform: ReleasePlatform, bytes: Uint8Array): PackageCheck {
  if (bytes.length < RELEASE_MIN_BYTES) return { ok: false, reason: 'file is too small to be an app package' }
  if (bytes.length > RELEASE_MAX_BYTES) return { ok: false, reason: 'file is larger than 100 MB' }
  const zip = listZipEntries(bytes)
  if (!zip.ok) return zip
  if (zip.names.some(unsafeEntry)) return { ok: false, reason: 'package contains unsafe file paths' }

  if (platform === 'android') {
    const hasManifest = zip.names.includes('AndroidManifest.xml')
    const hasDex = zip.names.some((n) => /^classes\d*\.dex$/.test(n))
    if (!hasManifest || !hasDex) return { ok: false, reason: 'not an Android app (APK) package' }
  } else {
    const hasApp = zip.names.some((n) => /^Payload\/[^/]+\.app\/Info\.plist$/.test(n))
    if (!hasApp) return { ok: false, reason: 'not an iOS app (IPA) package' }
  }
  return { ok: true, entries: zip.names.length }
}

/** The client's file name must at least carry the right extension; it is never used for storage. */
export function extensionMatches(platform: ReleasePlatform, fileName: string | null | undefined) {
  const name = (fileName ?? '').toLowerCase().trim()
  return name.endsWith(`.${RELEASE_EXT[platform]}`)
}

/** Storage path built only from validated values plus a random id: no traversal, no overwrite. */
export function releaseStoragePath(platform: ReleasePlatform, version: string, id: string) {
  if (!SEMVER_RE.test(version)) throw new Error('invalid version')
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('invalid id')
  return `${platform}/abiaconnect-${version}-${id}.${RELEASE_EXT[platform]}`
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
